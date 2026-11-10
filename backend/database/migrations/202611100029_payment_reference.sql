-- Student references are claims for review, never evidence that settles a payment.
create table public.purchase_payment_references (
 order_id uuid primary key references public.orders(id) on delete cascade,
 reference text not null check(reference ~ '^[A-Z0-9]{6,32}$'),
 submitted_at timestamptz not null default clock_timestamp()
);
alter table public.purchase_payment_references enable row level security;
revoke all on public.purchase_payment_references from public,anon,authenticated,service_role;

create function public.purchase_upi_reference(p_user uuid,p_order uuid,p_reference text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order and user_id=p_user for update;
 if not found then raise exception 'Order not found' using errcode='42501';end if;
 if o.purchase_provider is distinct from 'upi' or o.status not in('pending','cancelled')
  or not exists(select 1 from public.upi_intents where order_id=p_order)
  or p_reference is null or p_reference !~ '^[A-Z0-9]{6,32}$'
 then raise exception 'Invalid payment reference' using errcode='22023';end if;
 insert into public.purchase_payment_references(order_id,reference) values(p_order,p_reference)
 on conflict(order_id) do update set reference=excluded.reference,submitted_at=clock_timestamp()
 where purchase_payment_references.reference is distinct from excluded.reference;
end;$$;

-- Preserve the deployed reader and add private owner-scoped payment details.
alter function public.purchase_read(text,uuid,text) rename to purchase_read_before_payment_reference;
create function public.purchase_read(p_action text,p_user uuid,p_ref text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;details jsonb;
begin
 result:=public.purchase_read_before_payment_reference(p_action,p_user,p_ref);
 if p_action='order' and result is not null then
  select jsonb_build_object(
   'gatewaySavings',coalesce((o.course_snapshot->>'upi_adjustment_paise')::integer,0),
   'couponDiscount',greatest(0,o.discount_paise-coalesce((o.course_snapshot->>'upi_adjustment_paise')::integer,0)),
   'paymentReference',case when r.order_id is not null then jsonb_build_object('reference',r.reference,'submittedAt',r.submitted_at) else null end
  ) into details from public.orders o left join public.purchase_payment_references r on r.order_id=o.id
  where o.id=(result->>'id')::uuid and o.user_id=p_user;
  result:=result||coalesce(details,'{}'::jsonb);
 end if;
 return result;
end;$$;
revoke all on function public.purchase_upi_reference(uuid,uuid,text),public.purchase_read(text,uuid,text),public.purchase_read_before_payment_reference(text,uuid,text) from public,anon,authenticated;
grant execute on function public.purchase_upi_reference(uuid,uuid,text),public.purchase_read(text,uuid,text) to service_role;

-- Keep the claimed reference separate from the verified bank UTR in staff review.
create or replace view public.academy_upi_payment_orders as
 select o.id,o.user_id,o.total_paise as amount,p.full_name as student_name,u.email,
 coalesce(o.course_snapshot->>'title',c.title) as course,o.status,o.created_at,o.paid_at,
 i.gateway_checkout_token is not null as gateway_bound,
 coalesce(g.utr,credit.utr) as utr,g.status as gateway_status,
 case
  when g.amount_paise is not null and g.amount_paise<>i.amount_paise then 'Gateway amount differs'
  when r.order_id is not null and o.status in('pending','cancelled') then 'Student reference submitted; awaiting bank verification'
  when g.status='PENDING_CONFIRMATION' then 'Payment needs verification'
  when o.status='pending' and g.status='COMPLETED' then 'Payment received; course access pending'
  when o.status='pending' and g.status in('REJECTED','EXPIRED') then 'Checkout needs closing'
  when o.status='pending' and i.expires_at<=clock_timestamp() then 'Checkout expired'
  else null end as review_reason, r.reference as submitted_reference, r.submitted_at as reference_submitted_at
 from public.orders o join public.profiles p on p.id=o.user_id
 join auth.users u on u.id=o.user_id join public.courses c on c.id=o.course_id
 left join public.upi_intents i on i.order_id=o.id
 left join public.academy_upi_gateway_deposits g on g.token=i.gateway_checkout_token
 left join public.upi_credits credit on credit.order_id=o.id
 left join public.purchase_payment_references r on r.order_id=o.id
 where o.purchase_provider='upi' and o.currency='INR';
revoke all on public.academy_upi_payment_orders from public,anon,authenticated,service_role;

create or replace function public.academy_upi_payment_read(p_tab text,p_query text,p_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;term text:=left(trim(coalesce(p_query,'')),120);offset_rows integer:=least(greatest(coalesce(p_page,0),0),10000)*25;search_amount bigint;
begin
 if length(term)<=12 and term ~ '^[0-9]+([.][0-9]{1,2})?$' then search_amount:=(term::numeric*100)::bigint;end if;
 if p_tab is null or p_tab not in('review','unmatched','history') then raise exception 'Invalid payment view' using errcode='22023';end if;
 if p_tab='unmatched' then
  with matches as (
   select id,utr,amount_paise as amount,received_at as "receivedAt" from public.academy_upi_unmatched_credits
   where term='' or position(lower(term) in lower(utr))>0 or amount_paise=search_amount
  ), rows as (select * from matches order by "receivedAt" desc,id limit 25 offset offset_rows)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(rows)) from rows),'[]'::jsonb),'total',(select count(*) from matches)) into result;
 else
  with matches as (
   select id,user_id as "userId",amount,student_name as "studentName",email,course,status,
    created_at as "createdAt",paid_at as "paidAt",utr,gateway_status as "gatewayStatus",
    gateway_bound as "gatewayBound",review_reason as "reviewReason",
    submitted_reference as "submittedReference",reference_submitted_at as "referenceSubmittedAt"
   from public.academy_upi_payment_orders
   where (case when term<>'' then true when p_tab='review' then review_reason is not null
    else status in('paid','failed','cancelled','refunded') or gateway_status in('COMPLETED','REJECTED','EXPIRED') end)
   and (term='' or position(lower(term) in lower(concat_ws(' ',id::text,student_name,email,course,utr,submitted_reference)))>0
    or amount=search_amount)
  ), rows as (select * from matches order by case when p_tab='review' then "createdAt" end asc,"createdAt" desc,id limit 25 offset offset_rows)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(rows)) from rows),'[]'::jsonb),'total',(select count(*) from matches)) into result;
 end if;
 return result||jsonb_build_object('counts',jsonb_build_object(
  'review',(select count(*) from public.academy_upi_payment_orders where review_reason is not null),
  'unmatched',(select count(*) from public.academy_upi_unmatched_credits)),
  'syncedAt',(select synced_at from public.academy_upi_sync where id=true));
end;$$;
revoke all on function public.academy_upi_payment_read(text,text,integer) from public,anon,authenticated;
grant execute on function public.academy_upi_payment_read(text,text,integer) to service_role;

notify pgrst,'reload schema';
