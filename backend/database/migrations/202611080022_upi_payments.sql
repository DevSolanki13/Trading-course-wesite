-- UPI collection uses the existing purchase settlement/access transaction.
alter table public.orders drop constraint orders_purchase_provider_check;
alter table public.orders add constraint orders_purchase_provider_check check(purchase_provider in('mock','razorpay','upi'));
alter table public.payment_attempts drop constraint payment_attempts_provider_check;
alter table public.payment_attempts add constraint payment_attempts_provider_check check(provider in('mock','razorpay','upi'));
alter table public.purchase_events drop constraint purchase_events_provider_check;
alter table public.purchase_events add constraint purchase_events_provider_check check(provider in('mock','razorpay','upi'));

create table public.upi_intents (
 order_id uuid primary key references public.orders(id),
 amount_paise integer not null check(amount_paise>=100),
 vpa text not null, payee_name text not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '60 minutes',
 reusable_after timestamptz not null default clock_timestamp()+interval '8 days'
);
create index upi_intents_amount on public.upi_intents(amount_paise);
create table public.upi_credits (
 utr text primary key,
 amount_paise integer not null check(amount_paise>0),
 received_at timestamptz not null,
 sender text not null, body text not null,
 order_id uuid unique references public.orders(id),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.upi_intents enable row level security;
alter table public.upi_credits enable row level security;
revoke all on public.upi_intents,public.upi_credits from public,anon,authenticated,service_role;
grant select on public.upi_intents,public.upi_credits to service_role;

create or replace function public.purchase_create_order(p_user uuid,p_course text,p_provider text,p_origin text default '')returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.courses;s public.site_settings;o public.orders;new_id uuid;tax integer;base integer;snapshot jsonb;
begin
 perform 1 from public.profiles where id=p_user and not blocked for update;
 if not found then raise exception 'Account denied'using errcode='42501';end if;
 if p_provider not in('mock','razorpay','upi')or p_provider is null then raise exception 'Invalid provider'using errcode='22023';end if;
 select * into c from public.courses where(slug=p_course or public.courses.id::text=p_course)and status='published'for share;
 if not found then raise exception 'Course unavailable'using errcode='22023';end if;
 if public.purchase_has_access(p_user,c.id)then raise exception 'Already enrolled'using errcode='23505';end if;
 update public.orders set status='cancelled' where user_id=p_user and course_id=c.id and status='pending' and purchase_provider='upi' and exists(select 1 from public.upi_intents i where i.order_id=public.orders.id and i.expires_at<=clock_timestamp());
 select * into o from public.orders where user_id=p_user and course_id=c.id and status='pending'and purchase_provider is not null order by created_at desc limit 1;
 if found then
   if o.purchase_provider=p_provider then return o.id;end if;
   if o.purchase_provider in('razorpay','upi')then raise exception 'Check the existing real payment before retrying'using errcode='22023';end if;
   update public.orders set status='cancelled'where public.orders.id=o.id;
 end if;
 select * into s from public.site_settings where public.site_settings.id=true for share;
 if p_provider in('razorpay','upi')and s.gst_enabled then raise exception 'Approved GST invoice configuration required'using errcode='22023';end if;
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

-- Make coupon retries immutable once a bank payment amount has been reserved.
create or replace function public.purchase_create_order(p_user uuid,p_course text,p_provider text,p_origin text,p_coupon text)
returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; c public.courses; d integer; cid uuid; o public.orders;
begin
 oid:=public.purchase_create_order(p_user,p_course,p_provider,p_origin);
 select * into o from public.orders where id=oid for update;
 if o.provider_order_id is not null then
   if coalesce(o.course_snapshot->>'coupon_code','')<>coalesce(upper(trim(p_coupon)),'') then
     raise exception 'Existing checkout has a different coupon' using errcode='22023';
   end if;
   return oid;
 end if;
 if exists(select 1 from public.coupon_redemptions where order_id=oid and state='reserved') then return oid; end if;
 if nullif(trim(p_coupon),'') is null then return oid; end if;
 select * into c from public.courses where id=o.course_id;
 d:=public.coupon_discount(p_user,c.id,o.base_paise,p_coupon);
 if o.base_paise-d+o.tax_paise<100 then raise exception 'Minimum purchase is INR 1' using errcode='22023'; end if;
 select id into cid from public.coupons where code=upper(trim(p_coupon));
 update public.orders set discount_paise=d,total_paise=base_paise-d+tax_paise,
 course_snapshot=course_snapshot||jsonb_build_object('coupon_code',upper(trim(p_coupon)),'discount_paise',d) where id=oid;
 insert into public.coupon_redemptions(coupon_id,order_id,user_id,state)values(cid,oid,p_user,'reserved');
 return oid;
end;$$;

create function public.purchase_upi_reserve(p_user uuid,p_order uuid,p_vpa text,p_payee text)returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders; intent public.upi_intents; n integer; chosen integer;
begin
 -- Same lock order as ingestion; reservations are serialized across all course prices.
 lock table public.upi_intents in share row exclusive mode;
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found or o.purchase_provider<>'upi' or o.status<>'pending' then raise exception 'Invalid UPI order' using errcode='22023'; end if;
 select * into intent from public.upi_intents where order_id=p_order;
 if found then
   if intent.expires_at<=clock_timestamp() then raise exception 'Checkout expired. Contact support before paying.' using errcode='22023'; end if;
   return;
 end if;
 if p_vpa is null or length(p_vpa) not between 5 and 321 or p_payee is null or length(p_payee) not between 1 and 120 then raise exception 'Collection unavailable' using errcode='22023'; end if;
 -- Never charge above the course total. The small adjustment is an explicit discount.
 for n in 0..999 loop
   chosen:=o.total_paise-n;
   exit when chosen<100;
   if not exists(select 1 from public.upi_intents where amount_paise=chosen and reusable_after>clock_timestamp()) then
     insert into public.upi_intents(order_id,amount_paise,vpa,payee_name)values(p_order,chosen,p_vpa,p_payee);
     update public.orders set total_paise=chosen,discount_paise=discount_paise+n,
       course_snapshot=course_snapshot||jsonb_build_object('upi_adjustment_paise',n),
       provider_order_id='upi_'||p_order where id=p_order;
     return;
   end if;
 end loop;
 raise exception 'No payment amount is available. Try later.' using errcode='22023';
end;$$;

alter function public.purchase_read(text,uuid,text) rename to purchase_read_before_upi;
create function public.purchase_read(p_action text,p_user uuid,p_ref text default null)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; intent public.upi_intents;
begin
 result:=public.purchase_read_before_upi(p_action,p_user,p_ref);
 if p_action='order' and result->>'provider'='upi' then
   select * into intent from public.upi_intents where order_id=(result->>'id')::uuid;
   if found then result:=result||jsonb_build_object('upi',jsonb_build_object('vpa',intent.vpa,'payeeName',intent.payee_name,'amount',intent.amount_paise,'expiresAt',intent.expires_at)); end if;
 end if;
 return result;
end;$$;

create function public.purchase_upi_credit(p_utr text,p_amount integer,p_received timestamptz,p_sender text,p_body text)returns uuid
language plpgsql security definer set search_path='' as $$
declare credit public.upi_credits; intent public.upi_intents; oid uuid;
begin
 if p_utr is null or length(p_utr) not between 6 and 32 or p_amount is null or p_amount<1
   or p_received is null or p_received>clock_timestamp()+interval '2 minutes'
   or p_received<clock_timestamp()-interval '7 days' then raise exception 'Invalid bank credit' using errcode='22023'; end if;
 lock table public.upi_intents in share row exclusive mode;
 insert into public.upi_credits(utr,amount_paise,received_at,sender,body)values(p_utr,p_amount,p_received,p_sender,p_body)on conflict(utr)do nothing;
 select * into credit from public.upi_credits where utr=p_utr for update;
 if credit.amount_paise<>p_amount then raise exception 'Reference reused with different amount' using errcode='22023'; end if;
 if credit.order_id is not null then return credit.order_id; end if;
 -- An expired checkout stays unmatched for manual reconciliation, even after a delayed alert.
 select i.* into intent from public.upi_intents i join public.orders o on o.id=i.order_id
 where i.amount_paise=p_amount and i.created_at<=credit.received_at and i.expires_at>clock_timestamp()
   and credit.received_at<=i.expires_at and o.status='pending' and o.purchase_provider='upi';
 if not found then return null; end if;
 oid:=intent.order_id;
 perform public.purchase_settle(jsonb_build_object('provider','upi','providerOrderId','upi_'||oid,
   'providerPaymentId','upi_'||p_utr,'amount',p_amount,'currency','INR','status','paid'));
 update public.upi_credits set order_id=oid where utr=p_utr;
 return oid;
end;$$;
revoke all on function public.purchase_read(text,uuid,text),public.purchase_upi_reserve(uuid,uuid,text,text),
 public.purchase_upi_credit(text,integer,timestamptz,text,text)from public,anon,authenticated;
grant execute on function public.purchase_read(text,uuid,text),public.purchase_upi_reserve(uuid,uuid,text,text),
 public.purchase_upi_credit(text,integer,timestamptz,text,text)to service_role;
