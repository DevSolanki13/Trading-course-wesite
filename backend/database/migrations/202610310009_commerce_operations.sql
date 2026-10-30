-- Sandbox commerce only. Apply to an authorised, reconciled staging target first.
create table public.billing_documents (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 user_id uuid not null references public.profiles(id), kind text not null check(kind in('receipt','invoice','credit_note')),
 number text not null unique, snapshot jsonb not null, issued_at timestamptz not null default now(),
 unique(order_id,kind)
);
create table public.commerce_jobs (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in('payment','refund')),
 target text not null, state text not null default 'pending' check(state in('pending','running','done','failed')),
 attempts integer not null default 0, claimed_until timestamptz, next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(), unique(kind,target)
);
alter table public.billing_documents enable row level security;
alter table public.commerce_jobs enable row level security;
revoke all on public.billing_documents,public.commerce_jobs from public,anon,authenticated,service_role;
grant select on public.billing_documents,public.commerce_jobs to service_role;
create index commerce_jobs_due on public.commerce_jobs(state,next_attempt_at);
alter table public.notification_outbox add column delivery_started_at timestamptz;
update public.notification_outbox set delivery_started_at=created_at where attempts>0;

create function public.commerce_document(p_order uuid,p_credit boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders; doc jsonb; k text; n text;
begin
 select * into o from public.orders where id=p_order;
 if not found or o.status not in('paid','refunded') then raise exception 'Paid order required' using errcode='22023';end if;
 if p_credit and o.status<>'refunded' then raise exception 'Confirmed refund required' using errcode='22023';end if;
 k:=case when p_credit then 'credit_note'
   when o.gst_enabled and length(coalesce(o.billing_snapshot->>'seller_gstin',''))=15
    and length(coalesce(o.billing_snapshot->>'seller_name',''))>0
    and length(coalesce(o.billing_snapshot->>'seller_address',''))>0 then 'invoice' else 'receipt' end;
 n:='SBX-'||case when p_credit then 'CN-' else 'RC-' end||replace(o.id::text,'-','');
 doc:=jsonb_build_object('orderId',o.id,'courseTitle',coalesce(o.course_snapshot->>'title','Course purchase'),
   'buyerName',coalesce(o.billing_snapshot->>'customer_name',(select full_name from public.profiles where id=o.user_id),''),
   'sellerName',coalesce(o.billing_snapshot->>'seller_name','Market Method (sandbox)'),
   'sellerAddress',coalesce(o.billing_snapshot->>'seller_address',''),
   'sellerGstin',coalesce(o.billing_snapshot->>'seller_gstin',''),
   'buyerAddress',coalesce(o.billing_snapshot->>'customer_address',''),
   'buyerGstin',coalesce(o.billing_snapshot->>'customer_gstin',''),
   'supplyState',coalesce(o.billing_snapshot->>'supply_state',''),
   'basePaise',o.base_paise,'discountPaise',o.discount_paise,'taxPaise',o.tax_paise,
   'totalPaise',o.total_paise,'gstEnabled',o.gst_enabled,'gstRateBps',o.gst_rate_bps,
   'paidAt',o.paid_at,'currency',o.currency,'sandbox',true,
   'taxInvoicePending',o.gst_enabled and k='receipt');
 insert into public.billing_documents(order_id,user_id,kind,number,snapshot)
 values(o.id,o.user_id,k,n,doc) on conflict(order_id,kind)do nothing;
end;$$;

create function public.commerce_order_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' and old.status<>'paid' then
   perform public.commerce_document(new.id,false);
   insert into public.notification_outbox(user_id,dedupe_key,subject,body)values(new.user_id,'purchase:'||new.id,
    'Course payment confirmed','Your course payment has been confirmed. Sign in to your learning space to begin and download the saved billing document. Order reference: '||new.id)
    on conflict(dedupe_key)do nothing;
 elsif new.status in('failed','cancelled') and old.status='pending' then
   insert into public.notification_outbox(user_id,dedupe_key,subject,body)values(new.user_id,'payment-closed:'||new.id,
    'Course checkout update','This checkout was not confirmed. Check your saved order and payment history before retrying. Order reference: '||new.id)
    on conflict(dedupe_key)do nothing;
 elsif new.status='refunded' and old.status='paid' then
   perform public.commerce_document(new.id,true);
 end if;
 return new;
end;$$;
create trigger commerce_order_notifications after update of status on public.orders
for each row execute function public.commerce_order_changed();

create function public.commerce_create_order(p_user uuid,p_session uuid,p_slug text,p_phone text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.courses;s public.site_settings;o public.orders;new_id uuid;snapshot jsonb;base integer;tax integer;billing jsonb;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not public.auth_has_session(p_user,p_session) or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)
 then raise exception 'Verified session required' using errcode='42501';end if;
 if p_phone is null or p_phone!~'^[6-9][0-9]{9}$' then raise exception 'Valid phone required' using errcode='22023';end if;
 select * into c from public.courses where slug=p_slug and status='published' for share;
 if not found then raise exception 'Course unavailable' using errcode='22023';end if;
 if exists(select 1 from public.enrollments e left join public.orders paid on paid.id=e.order_id
 where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null
 and(e.source='manual' or(paid.status='paid' and paid.user_id=p_user and paid.course_id=c.id)))
 then raise exception 'Already enrolled' using errcode='23505';end if;
 select * into o from public.orders where user_id=p_user and course_id=c.id and status='pending'
 and provider_order_id like 'cf_sbx_%' order by created_at desc limit 1;
 if found then return o.id;end if;
 select * into s from public.site_settings where id=true for share;
 if not found then raise exception 'Settings unavailable';end if;
 -- Tax invoices require supplied customer/tax classification; until then this
 -- sandbox flow issues non-GST receipts only. No tax treatment is invented.
 if s.gst_enabled then raise exception 'GST invoice configuration requires approval' using errcode='22023';end if;
 select jsonb_build_object('slug',c.slug,'title',c.title,'version',c.version,
 'duration_seconds',coalesce(sum(l.duration_seconds)filter(where not l.is_preview),0),
 'lessons',coalesce(jsonb_agg(jsonb_build_object('id',l.id,'duration_seconds',l.duration_seconds,'is_preview',l.is_preview)
 order by m.position,l.position)filter(where l.id is not null),'[]'::jsonb)) into snapshot
 from public.modules m join public.lessons l on l.module_id=m.id and l.published where m.course_id=c.id;
 if jsonb_array_length(snapshot->'lessons')=0 or(snapshot->>'duration_seconds')::integer<=0 then raise exception 'Course has no paid lesson duration' using errcode='22023';end if;
 base:=coalesce(c.sale_price_paise,c.price_paise);tax:=0;
 if base<100 then raise exception 'Order must be at least INR 1' using errcode='22023';end if;
 billing:=jsonb_build_object('seller_name',s.business_name,'seller_address',s.business_address,'seller_gstin',s.gstin,
 'customer_name',(select full_name from public.profiles where id=p_user),
 'customer_email',(select email from auth.users where id=p_user),'customer_phone',p_phone);
 new_id:=gen_random_uuid();
 insert into public.orders(id,user_id,course_id,provider_order_id,base_paise,total_paise,gst_enabled,gst_rate_bps,tax_paise,
 idempotency_key,course_snapshot,billing_snapshot,refund_policy_snapshot)
 values(new_id,p_user,c.id,'cf_sbx_'||replace(new_id::text,'-',''),base,base+tax,false,0,tax,
 'cashfree:'||p_user||':'||c.id,snapshot,billing,
 jsonb_build_object('window_days',s.refund_window_days,'watch_limit_percent',s.refund_watch_limit_percent));
 insert into public.commerce_jobs(kind,target)values('payment','cf_sbx_'||replace(new_id::text,'-',''));
 return new_id;
end;$$;

create function public.commerce_settle_payment(p_hash text,p_event jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;attempt public.payment_attempts;s text:=p_event->>'status';pid text:=p_event->>'paymentId';paid timestamptz;attempt_owner uuid;
begin
 if p_hash is null or p_hash!~'^[a-f0-9]{64}$' or coalesce(p_event->>'providerOrderId','')!~'^cf_sbx_[a-f0-9]{32}$'
 or coalesce(p_event->>'currency','')<>'INR' or pid is null or length(pid)not between 1 and 180
 or s is null or s not in('SUCCESS','NOT_ATTEMPTED','FAILED','USER_DROPPED','VOID','CANCELLED','PENDING')
 then raise exception 'Invalid confirmation' using errcode='22023';end if;
 select * into o from public.orders where provider_order_id=p_event->>'providerOrderId' for update;
 if not found or p_event->>'amountPaise' is null or o.total_paise<>(p_event->>'amountPaise')::integer
 then raise exception 'Order mismatch' using errcode='22023';end if;
 select * into attempt from public.payment_attempts where provider_payment_id=pid;
 if found and(attempt.order_id<>o.id or attempt.amount_paise<>o.total_paise)then raise exception 'Payment reused' using errcode='22023';end if;
 insert into public.payment_attempts(order_id,provider_payment_id,status,amount_paise)values(o.id,pid,s,o.total_paise)
 on conflict(provider_payment_id)do update set status=case when public.payment_attempts.status='SUCCESS' then 'SUCCESS' else excluded.status end
 where public.payment_attempts.order_id=excluded.order_id and public.payment_attempts.amount_paise=excluded.amount_paise
 returning order_id into attempt_owner;
 if not found or attempt_owner<>o.id then raise exception 'Payment reused'using errcode='22023';end if;
 if s='SUCCESS' then
   if o.status in('failed','cancelled')then raise exception 'Terminal order requires review' using errcode='22023';end if;
   if o.status='pending' then
     paid:=(p_event->>'paidAt')::timestamptz;
     if paid is null then raise exception 'Paid time required'using errcode='22023';end if;
     if paid>now()+interval '5 minutes' or paid<o.created_at-interval '5 minutes' then raise exception 'Invalid paid time'using errcode='22023';end if;
     update public.orders set status='paid',paid_at=paid where id=o.id;
     insert into public.enrollments(user_id,course_id,order_id,source,active)values(o.user_id,o.course_id,o.id,'purchase',true)
     on conflict(order_id)do nothing;
     insert into public.audit_log(action,target_type,target_id,details)values('cashfree_payment_confirmed','order',o.id::text,jsonb_build_object('environment','sandbox'));
   end if;
 end if;
 insert into public.webhook_events(provider,payload_hash,payload,status,processed_at)values('cashfree',p_hash,p_event,'processed',now())
 on conflict(provider,payload_hash)do update set status='processed',processed_at=now();
end;$$;

create function public.commerce_close_order(p_provider_id text,p_status text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status not in('failed','cancelled')or p_status is null or coalesce(p_provider_id,'')!~'^cf_sbx_[a-f0-9]{32}$'
 then raise exception 'Invalid terminal state'using errcode='22023';end if;
 update public.orders set status=p_status where provider_order_id=p_provider_id and status='pending';
end;$$;

create function public.commerce_refund_state(p_reference text,p_provider_id text,p_amount integer,p_state text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.refund_requests;o public.orders;
begin
 -- Match the order before taking the refund row lock, consistent with checkout.
 select * into o from public.orders where provider_order_id=p_provider_id for update;
 if not found or coalesce(p_provider_id,'')!~'^cf_sbx_[a-f0-9]{32}$' or p_amount is null or o.total_paise<>p_amount
 then raise exception 'Refund amount/order mismatch'using errcode='22023';end if;
 select * into r from public.refund_requests where provider_reference=p_reference and order_id=o.id for update;
 if not found or r.state not in('approved','processing','failed','refunded')then raise exception 'Refund not approved'using errcode='22023';end if;
 if r.state='refunded' then return;end if;
 if p_state='SUCCESS' then perform public.refund_settled(p_reference,true);
 elsif p_state in('CANCELLED','REJECTED')then perform public.refund_settled(p_reference,false);
 elsif p_state in('PENDING','PENDING_APPROVAL','ONHOLD')then
   update public.refund_requests set state='processing',updated_at=now(),version=version+1 where id=r.id and state='approved';
 else raise exception 'Unknown refund state'using errcode='22023';end if;
end;$$;

create function public.commerce_refund_queued()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.state='approved'and old.state<>'approved' and exists(select 1 from public.orders where id=new.order_id and provider_order_id like 'cf_sbx_%')then
   insert into public.commerce_jobs(kind,target)values('refund',new.provider_reference)
   on conflict(kind,target)do update set id=gen_random_uuid(),state='pending',attempts=0,next_attempt_at=now(),claimed_until=null;
 end if;return new;
end;$$;
create trigger commerce_refund_queue after update of state on public.refund_requests for each row execute function public.commerce_refund_queued();

create function public.commerce_claim_jobs()returns setof public.commerce_jobs
language sql security definer set search_path='' as $$
 update public.commerce_jobs set state='running',attempts=attempts+1,claimed_until=now()+interval '5 minutes'
 where id in(select id from public.commerce_jobs where attempts<12 and((state in('pending','failed')and next_attempt_at<=now())or(state='running'and claimed_until<now()))
 order by created_at for update skip locked limit 2)returning *;
$$;
create function public.commerce_finish_job(p_id uuid,p_attempt integer,p_done boolean)returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.commerce_jobs set state=case when p_done then 'done' else 'failed' end,claimed_until=null,
 next_attempt_at=now()+make_interval(secs=>least(3600,30*(2^least(attempts,7))::integer))
 where id=p_id and attempts=p_attempt and state='running'and claimed_until>now();return found;
end;$$;

revoke all on function public.commerce_document(uuid,boolean),public.commerce_order_changed(),public.commerce_create_order(uuid,uuid,text,text),
 public.commerce_settle_payment(text,jsonb),public.commerce_close_order(text,text),public.commerce_refund_state(text,text,integer,text),
 public.commerce_refund_queued(),public.commerce_claim_jobs(),public.commerce_finish_job(uuid,integer,boolean)from public,anon,authenticated;
grant execute on function public.commerce_document(uuid,boolean),public.commerce_create_order(uuid,uuid,text,text),
 public.commerce_settle_payment(text,jsonb),public.commerce_close_order(text,text),public.commerce_refund_state(text,text,integer,text),
 public.commerce_claim_jobs(),public.commerce_finish_job(uuid,integer,boolean)to service_role;

create function public.commerce_ops_summary()returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'exhaustedJobs',(select count(*)from public.commerce_jobs where state<>'done'and attempts>=12),
 'expiredJobs',(select count(*)from public.commerce_jobs where state='running'and claimed_until<now()),
 'exhaustedNotifications',(select count(*)from public.notification_outbox where state<>'sent'and attempts>=8),
 'staleNotificationKeys',(select count(*)from public.notification_outbox where state<>'sent'and delivery_started_at<now()-interval '23 hours'),
 'failedWebhooks',(select count(*)from public.webhook_events where status='failed'or(status='received'and received_at<now()-interval '15 minutes')),
 'stalledRefunds',(select count(*)from public.refund_requests where state in('approved','processing')and updated_at<now()-interval '24 hours'),
 'invalidEntitlements',(select count(*)from public.enrollments e left join public.orders o on o.id=e.order_id
 where e.source='purchase'and e.active and e.revoked_at is null and(o.status is distinct from 'paid'or o.user_id<>e.user_id or o.course_id<>e.course_id)),
 'missingDocuments',(select count(*)from public.orders o where o.status in('paid','refunded')and not exists(select 1 from public.billing_documents d where d.order_id=o.id and d.kind in('invoice','receipt')))
 );
$$;
revoke all on function public.commerce_ops_summary()from public,anon,authenticated;
grant execute on function public.commerce_ops_summary()to service_role;

-- Keep the bounded function batch below its 300s execution budget even when
-- provider and identity requests consume their entire timeout.
create or replace function public.notification_claim()returns setof public.notification_outbox
language sql security definer set search_path='' as $$
 update public.notification_outbox set state='sending',attempts=attempts+1,claimed_until=now()+interval '5 minutes',delivery_started_at=coalesce(delivery_started_at,now())
 where id in(select id from public.notification_outbox where((state in('pending','failed')and next_attempt_at<=now())or(state='sending'and claimed_until<now()))
 and attempts<8 and(delivery_started_at is null or delivery_started_at>now()-interval '23 hours')order by created_at for update skip locked limit 3)returning *;
$$;
