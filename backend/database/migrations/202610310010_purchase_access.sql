-- Additive purchase/access model. Existing payment/audit history is preserved.
alter table public.orders add column purchase_provider text check(purchase_provider in('mock','razorpay')),
 add column creation_claim uuid, add column creation_claim_until timestamptz;
alter table public.payment_attempts add column provider text check(provider in('mock','razorpay'));
alter table public.lesson_progress add column completed_at timestamptz;
create table public.purchase_access (
 user_id uuid not null references public.profiles(id), course_id uuid not null references public.courses(id),
 order_id uuid not null references public.orders(id), active boolean not null default true,
 purchased_at timestamptz not null default now(), primary key(user_id,course_id)
);
create table public.purchase_lesson_content (
 lesson_id uuid primary key references public.lessons(id), content text not null default '',
 demo_video_url text, is_demo boolean not null default false
);
create table public.purchase_events (
 provider text not null check(provider in('mock','razorpay')), event_key text not null,
 order_id uuid not null references public.orders(id), received_at timestamptz not null default now(),
 primary key(provider,event_key)
);
do $$declare t text;begin foreach t in array array['purchase_access','purchase_lesson_content','purchase_events']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select on public.%I to service_role',t);
end loop;end$$;

create function public.purchase_has_access(p_user uuid,p_course uuid)returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from public.profiles where id=p_user and not blocked)and exists(
 select 1 from public.enrollments e left join public.orders o on o.id=e.order_id
 where e.user_id=p_user and e.course_id=p_course and e.active and e.revoked_at is null
 and(e.source='manual'or(o.status='paid'and o.user_id=p_user and o.course_id=p_course)));
$$;
create function public.purchase_catalog(p_user uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'title',c.title,'description',c.description,
 'price',coalesce(c.sale_price_paise,c.price_paise),'currency','INR','level',c.level,'language',c.language,'thumbnail',c.thumbnail_url,
 'owned',public.purchase_has_access(p_user,c.id),'progress',coalesce((select round(100.0*count(*)filter(where lp.completed)/nullif(count(*),0))
 from public.modules m join public.lessons l on l.module_id=m.id and l.published left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user where m.course_id=c.id),0),
 'modules',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'lessons',coalesce((select jsonb_agg(jsonb_build_object(
 'id',l.id,'title',l.title,'duration',l.duration_seconds,'preview',l.is_preview,'completed',coalesce(lp.completed,false))order by l.position)
 from public.lessons l left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user where l.module_id=m.id and l.published),'[]'::jsonb))order by m.position)
 from public.modules m where m.course_id=c.id),'[]'::jsonb))order by c.created_at),'[]'::jsonb)from public.courses c where c.status='published';
$$;
create function public.purchase_read(p_action text,p_user uuid,p_ref text default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; c uuid;l public.lessons;
begin
 if p_action='catalog' then return public.purchase_catalog(p_user);end if;
 if p_action='course'then select value into result from jsonb_array_elements(public.purchase_catalog(p_user))where value->>'slug'=p_ref or value->>'id'=p_ref;return result;end if;
 if p_action='lesson'then
   select * into l from public.lessons where id=p_ref::uuid and published;
   select m.course_id into c from public.modules m join public.courses cs on cs.id=m.course_id and cs.status='published'where m.id=l.module_id;
   if l.id is null or c is null or(not l.is_preview and not public.purchase_has_access(p_user,c))then raise exception 'Purchase to unlock'using errcode='42501';end if;
   select jsonb_build_object('id',l.id,'title',l.title,'duration',l.duration_seconds,'preview',l.is_preview,'completed',coalesce(lp.completed,false),
    'content',coalesce(pc.content,la.notes,''),'videoUrl',case when pc.is_demo then pc.demo_video_url else null end,'isDemo',coalesce(pc.is_demo,false))into result
   from(select 1)x left join public.purchase_lesson_content pc on pc.lesson_id=l.id left join public.lesson_assets la on la.lesson_id=l.id
   left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=p_user;return result;
 end if;
 if p_user is null then raise exception 'Sign in required'using errcode='42501';end if;
 if p_action in('orders','order')then
   select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'courseId',o.course_id,'slug',coalesce(o.course_snapshot->>'slug',c.slug),
   'courseTitle',coalesce(o.course_snapshot->>'title',c.title),'userId',o.user_id,'amount',o.total_paise,'base',o.base_paise,'tax',o.tax_paise,
   'currency',o.currency,'status',o.status,'provider',o.purchase_provider,'providerOrderId',o.provider_order_id,'createdAt',o.created_at,'paidAt',o.paid_at)order by o.created_at desc),'[]'::jsonb)
   into result from public.orders o join public.courses c on c.id=o.course_id where o.user_id=p_user and o.purchase_provider is not null and(p_action='orders'or o.id::text=p_ref);
   if p_action='order'then return result->0;end if;return result;
 end if;
 raise exception 'Unknown purchase resource'using errcode='22023';
end;$$;

create function public.purchase_create_order(p_user uuid,p_course text,p_provider text,p_origin text default '')returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.courses;s public.site_settings;o public.orders;new_id uuid;tax integer;base integer;snapshot jsonb;
begin
 perform 1 from public.profiles where id=p_user and not blocked for update;
 if not found then raise exception 'Account denied'using errcode='42501';end if;
 if p_provider not in('mock','razorpay')or p_provider is null then raise exception 'Invalid provider'using errcode='22023';end if;
 select * into c from public.courses where(slug=p_course or public.courses.id::text=p_course)and status='published'for share;
 if not found then raise exception 'Course unavailable'using errcode='22023';end if;
 if public.purchase_has_access(p_user,c.id)then raise exception 'Already enrolled'using errcode='23505';end if;
 select * into o from public.orders where user_id=p_user and course_id=c.id and status='pending'and purchase_provider is not null order by created_at desc limit 1;
 if found then
   if o.purchase_provider=p_provider then return o.id;end if;
   if o.purchase_provider='razorpay'then raise exception 'Check the existing real payment before retrying'using errcode='22023';end if;
   update public.orders set status='cancelled'where public.orders.id=o.id;
 end if;
 select * into s from public.site_settings where public.site_settings.id=true for share;
 if p_provider='razorpay'and s.gst_enabled then raise exception 'Approved GST invoice configuration required'using errcode='22023';end if;
 base:=coalesce(c.sale_price_paise,c.price_paise);if base<100 then raise exception 'Minimum purchase is INR 1'using errcode='22023';end if;
 tax:=case when s.gst_enabled then floor(base::numeric*s.gst_rate_bps/10000)::integer else 0 end;
 select jsonb_build_object('title',c.title,'slug',c.slug,'duration_seconds',coalesce(sum(l.duration_seconds)filter(where not l.is_preview),0),
 'lessons',coalesce(jsonb_agg(jsonb_build_object('id',l.id,'duration_seconds',l.duration_seconds,'is_preview',l.is_preview)),'[]'::jsonb))into snapshot
 from public.modules m join public.lessons l on l.module_id=m.id and l.published where m.course_id=c.id;
 new_id:=gen_random_uuid();
 insert into public.orders(id,user_id,course_id,purchase_provider,base_paise,tax_paise,total_paise,gst_enabled,gst_rate_bps,course_snapshot,billing_snapshot,refund_policy_snapshot,idempotency_key)
 values(new_id,p_user,c.id,p_provider,base,tax,base+tax,s.gst_enabled,case when s.gst_enabled then s.gst_rate_bps else 0 end,snapshot,
 jsonb_build_object('seller_name',s.business_name,'seller_address',s.business_address,'customer_name',(select full_name from public.profiles where public.profiles.id=p_user),'app_origin',p_origin),
 jsonb_build_object('window_days',s.refund_window_days,'watch_limit_percent',s.refund_watch_limit_percent),'purchase:'||p_user||':'||c.id);
 return new_id;
end;$$;
create function public.purchase_claim_creation(p_user uuid,p_order uuid,p_claim uuid)returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.orders set creation_claim=p_claim,creation_claim_until=now()+interval '2 minutes'
 where id=p_order and user_id=p_user and status='pending'and provider_order_id is null and(creation_claim is null or creation_claim_until<now());
 return found;
end;$$;
create function public.purchase_bind_order(p_user uuid,p_order uuid,p_claim uuid,p_provider_id text)returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_provider_id is null or length(p_provider_id)not between 5 and 100 then raise exception 'Invalid order reference'using errcode='22023';end if;
 update public.orders set provider_order_id=p_provider_id,creation_claim=null,creation_claim_until=null where id=p_order and user_id=p_user and status='pending'and provider_order_id is null and creation_claim=p_claim;
 if not found then raise exception 'Order creation conflict'using errcode='22023';end if;
end;$$;
create function public.purchase_settle(p_event jsonb)returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;pid text:=p_event->>'providerPaymentId';nextstate text:=p_event->>'status';eventkey text;owner uuid;
begin
 select * into o from public.orders where provider_order_id=p_event->>'providerOrderId'for update;
 if not found or o.purchase_provider is distinct from p_event->>'provider' or p_event->>'currency'is distinct from 'INR' or(p_event->>'amount')::integer is distinct from o.total_paise
 or pid is null or length(pid)not between 1 and 180 or nextstate is null or nextstate not in('paid','failed','cancelled','refunded')then raise exception 'Payment mismatch'using errcode='22023';end if;
 eventkey:=pid||':'||nextstate;
 if exists(select 1 from public.purchase_events where provider=o.purchase_provider and event_key=eventkey)then return;end if;
 insert into public.payment_attempts(order_id,provider_payment_id,status,amount_paise,provider)values(o.id,pid,nextstate,o.total_paise,o.purchase_provider)
 on conflict(provider_payment_id)do update set status=case when public.payment_attempts.status in('paid','refunded')and excluded.status in('failed','cancelled')then public.payment_attempts.status else excluded.status end
 where public.payment_attempts.order_id=excluded.order_id and public.payment_attempts.amount_paise=excluded.amount_paise returning order_id into owner;
 if not found or owner<>o.id then raise exception 'Payment identity reused'using errcode='22023';end if;
 if nextstate='paid'and o.status='pending'then
   update public.orders set status='paid',paid_at=now()where id=o.id;
   insert into public.purchase_access(user_id,course_id,order_id,active)values(o.user_id,o.course_id,o.id,true)
   on conflict(user_id,course_id)do update set order_id=excluded.order_id,active=true,purchased_at=now();
   insert into public.enrollments(user_id,course_id,order_id,source,active)values(o.user_id,o.course_id,o.id,'purchase',true)on conflict(order_id)do nothing;
   insert into public.notification_outbox(user_id,dedupe_key,subject,body)values(o.user_id,'purchase:'||o.id,'Your course receipt',
   'Payment confirmed for '||(o.course_snapshot->>'title')||'. Total INR '||to_char(o.total_paise::numeric/100,'FM99999999.00')||'. Order '||o.id||E'\nCourse: '||coalesce(o.billing_snapshot->>'app_origin','')||'/learn/'||(o.course_snapshot->>'slug')||E'\nReceipt: '||coalesce(o.billing_snapshot->>'app_origin','')||'/dashboard/orders/'||o.id||'/receipt')on conflict(dedupe_key)do nothing;
 elsif nextstate in('failed','cancelled')and o.purchase_provider='mock'and o.status='pending'then update public.orders set status=nextstate where id=o.id;
 elsif nextstate='refunded'and o.status='paid'then
   update public.orders set status='refunded'where id=o.id;
   update public.enrollments set active=false,revoked_at=now()where order_id=o.id;
   update public.purchase_access set active=false where order_id=o.id;
 end if;
 insert into public.purchase_events(provider,event_key,order_id)values(o.purchase_provider,eventkey,o.id);
end;$$;
create function public.purchase_complete(p_user uuid,p_lesson uuid,p_completed boolean)returns void
language plpgsql security definer set search_path='' as $$
declare l public.lessons;c uuid;
begin
 select * into l from public.lessons where id=p_lesson and published;
 select m.course_id into c from public.modules m join public.courses cs on cs.id=m.course_id and cs.status='published'where m.id=l.module_id;
 if p_user is null or c is null or not public.purchase_has_access(p_user,c)then raise exception 'Purchase to unlock'using errcode='42501';end if;
 insert into public.lesson_progress(user_id,lesson_id,duration_seconds,completed,completed_at)
 values(p_user,l.id,greatest(1,l.duration_seconds),p_completed,case when p_completed then now()else null end)
 on conflict(user_id,lesson_id)do update set completed=p_completed,completed_at=case when p_completed then coalesce(public.lesson_progress.completed_at,now())else null end,updated_at=now();
end;$$;
-- New providers use the dedicated printable receipt and purchase outbox. Keep
-- existing Cashfree/demo billing behavior intact, without labelling live sales SBX.
create or replace function public.commerce_order_changed()returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.purchase_provider is not null then return new;end if;
 if new.status='paid'and old.status<>'paid'then
 perform public.commerce_document(new.id,false);
 insert into public.notification_outbox(user_id,dedupe_key,subject,body)values(new.user_id,'purchase:'||new.id,'Course payment confirmed','Your course payment has been confirmed. Sign in to your learning space. Order reference: '||new.id)on conflict(dedupe_key)do nothing;
 elsif new.status in('failed','cancelled')and old.status='pending'then
 insert into public.notification_outbox(user_id,dedupe_key,subject,body)values(new.user_id,'payment-closed:'||new.id,'Course checkout update','Payment was not confirmed. Check saved order '||new.id)on conflict(dedupe_key)do nothing;
 elsif new.status='refunded'and old.status='paid'then perform public.commerce_document(new.id,true);end if;return new;
end;$$;
revoke all on function public.purchase_has_access(uuid,uuid),public.purchase_catalog(uuid),public.purchase_read(text,uuid,text),public.purchase_create_order(uuid,text,text,text),
 public.purchase_claim_creation(uuid,uuid,uuid),public.purchase_bind_order(uuid,uuid,uuid,text),public.purchase_settle(jsonb),public.purchase_complete(uuid,uuid,boolean)from public,anon,authenticated;
grant execute on function public.purchase_has_access(uuid,uuid),public.purchase_catalog(uuid),public.purchase_read(text,uuid,text),public.purchase_create_order(uuid,text,text,text),
 public.purchase_claim_creation(uuid,uuid,uuid),public.purchase_bind_order(uuid,uuid,uuid,text),public.purchase_settle(jsonb),public.purchase_complete(uuid,uuid,boolean)to service_role;

create function public.purchase_mail_claim(p_user uuid,p_order uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.notification_outbox;
begin
 update public.notification_outbox set state='sending',attempts=attempts+1,claimed_until=now()+interval '5 minutes',delivery_started_at=coalesce(delivery_started_at,now())
 where user_id=p_user and dedupe_key='purchase:'||p_order and state in('pending','failed')and next_attempt_at<=now()and attempts<8
 and(delivery_started_at is null or delivery_started_at>now()-interval '23 hours')returning *into r;
 if not found then return null;end if;return to_jsonb(r);
end;$$;
create function public.purchase_mail_finish(p_id uuid,p_attempt integer,p_success boolean)returns void
language sql security definer set search_path='' as $$
 update public.notification_outbox set state=case when p_success then 'sent'else 'failed'end,claimed_until=null,next_attempt_at=now()+interval '10 minutes'
 where id=p_id and attempts=p_attempt and state='sending'and claimed_until>now();
$$;
revoke all on function public.purchase_mail_claim(uuid,uuid),public.purchase_mail_finish(uuid,integer,boolean)from public,anon,authenticated;
grant execute on function public.purchase_mail_claim(uuid,uuid),public.purchase_mail_finish(uuid,integer,boolean)to service_role;
create function public.purchase_tax(p_base integer)returns integer language sql stable security definer set search_path='' as $$
 select case when gst_enabled then floor(p_base::numeric*gst_rate_bps/10000)::integer else 0 end from public.site_settings where id=true;
$$;
revoke all on function public.purchase_tax(integer)from public,anon,authenticated;
grant execute on function public.purchase_tax(integer)to service_role;
create function public.purchase_payment_owner(p_provider_id text)returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('orderId',o.id,'user',jsonb_build_object('id',u.id,'name',p.full_name,'email',u.email,'role',p.role))
 from public.orders o join auth.users u on u.id=o.user_id and u.email_confirmed_at is not null join public.profiles p on p.id=u.id
 where o.provider_order_id=p_provider_id and o.status='paid';
$$;
revoke all on function public.purchase_payment_owner(text)from public,anon,authenticated;
grant execute on function public.purchase_payment_owner(text)to service_role;
