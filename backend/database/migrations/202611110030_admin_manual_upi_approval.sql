-- Admin manual UPI approval for payments received in the collection account.
create table public.purchase_manual_approvals (
  order_id uuid primary key references public.orders(id) on delete cascade,
  approved_by uuid not null references public.profiles(id),
  utr text not null check (utr ~ '^[A-Z0-9]{6,32}$'),
  reason text not null check (char_length(reason) between 10 and 300),
  amount_paise integer not null,
  previous_status text not null,
  gateway_status text,
  approved_at timestamptz not null default clock_timestamp()
);
create unique index purchase_manual_approvals_utr_idx on public.purchase_manual_approvals(utr);
alter table public.purchase_manual_approvals enable row level security;
revoke all on public.purchase_manual_approvals from public, anon, authenticated, service_role;

create function public.admin_upi_manual_approve(
  p_actor uuid,
  p_order uuid,
  p_utr text,
  p_reason text,
  p_confirm_amount integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  o public.orders;
  v_gateway_status text;
begin
  -- 1. Actor must be an active admin
  if not exists(
    select 1 from public.profiles
    where id = p_actor and role = 'admin' and (blocked is false or blocked is null)
  ) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  -- 2. Select order for update and verify UPI provider
  select * into o from public.orders where id = p_order for update;
  if not found then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if o.purchase_provider is distinct from 'upi' then
    raise exception 'Only UPI orders can be manually approved' using errcode = '22023';
  end if;

  -- 3. Confirm amount must equal order total paise
  if p_confirm_amount is distinct from o.total_paise then
    raise exception 'Confirmation amount does not match order amount' using errcode = '22023';
  end if;

  -- 4. Provider order id must be bound
  if o.provider_order_id is null then
    raise exception 'Checkout was never set up for this order; nothing to approve' using errcode = '22023';
  end if;

  -- 5. Already paid check (double-click idempotent)
  if o.status = 'paid' then
    return jsonb_build_object('status', 'paid', 'alreadyPaid', true);
  end if;

  -- 6. Only allow pending orders
  if o.status <> 'pending' then
    raise exception 'This checkout was closed; contact the developer' using errcode = '22023';
  end if;

  -- Format validations
  if p_utr is null or p_utr !~ '^[A-Z0-9]{6,32}$' then
    raise exception 'Invalid UTR format' using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 10 or char_length(p_reason) > 300 then
    raise exception 'Reason must be between 10 and 300 characters' using errcode = '22023';
  end if;

  -- 7. Gateway status check: refuse if gateway says COMPLETED
  select g.status into v_gateway_status
  from public.upi_intents i
  left join public.academy_upi_gateway_deposits g on g.token = i.gateway_checkout_token
  where i.order_id = o.id;

  if v_gateway_status = 'COMPLETED' then
    raise exception 'Gateway payment is already completed; use Check payment instead' using errcode = '22023';
  end if;

  -- If UTR appears in unmatched credits, amount must match
  if exists(
    select 1 from public.academy_upi_unmatched_credits
    where utr = p_utr and amount_paise <> o.total_paise
  ) then
    raise exception 'Bank credit amount does not match order amount' using errcode = '22023';
  end if;

  -- 8. Unique UTR check
  if exists(select 1 from public.purchase_manual_approvals where utr = p_utr) then
    raise exception 'This UTR has already been used to approve an order' using errcode = '23505';
  end if;

  insert into public.purchase_manual_approvals(
    order_id, approved_by, utr, reason, amount_paise, previous_status, gateway_status
  ) values (
    o.id, p_actor, p_utr, trim(p_reason), o.total_paise, o.status, v_gateway_status
  );

  -- 9. Settle using existing settlement SQL
  perform public.purchase_settle(jsonb_build_object(
    'provider', 'upi',
    'providerOrderId', o.provider_order_id,
    'providerPaymentId', 'manual_' || o.id::text,
    'amount', o.total_paise,
    'currency', 'INR',
    'status', 'paid'
  ));

  -- 10. Audit log entry in the same transaction
  insert into public.audit_log(actor_id, action, target_type, target_id, details)
  values(
    p_actor,
    'upi_payment_manually_approved',
    'order',
    o.id::text,
    jsonb_build_object(
      'utr', p_utr,
      'reason', trim(p_reason),
      'amount_paise', o.total_paise,
      'previous_status', o.status,
      'gateway_status', v_gateway_status
    )
  );

  -- 11. Return confirmation
  return jsonb_build_object('status', 'paid', 'alreadyPaid', false);
end;$$;

revoke all on function public.admin_upi_manual_approve(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.admin_upi_manual_approve(uuid, uuid, text, text, integer) to service_role;

-- Update the staff view: append manual_approved_by, manual_approved_at, manual_reason to the END.
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
  else null end as review_reason, r.reference as submitted_reference, r.submitted_at as reference_submitted_at,
  admin_p.full_name as manual_approved_by, ma.approved_at as manual_approved_at, ma.reason as manual_reason
 from public.orders o join public.profiles p on p.id=o.user_id
 join auth.users u on u.id=o.user_id join public.courses c on c.id=o.course_id
 left join public.upi_intents i on i.order_id=o.id
 left join public.academy_upi_gateway_deposits g on g.token=i.gateway_checkout_token
 left join public.upi_credits credit on credit.order_id=o.id
 left join public.purchase_payment_references r on r.order_id=o.id
 left join public.purchase_manual_approvals ma on ma.order_id=o.id
 left join public.profiles admin_p on admin_p.id=ma.approved_by
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
    submitted_reference as "submittedReference",reference_submitted_at as "referenceSubmittedAt",
    case when manual_approved_at is not null then jsonb_build_object('by',coalesce(manual_approved_by,'Admin'),'at',manual_approved_at,'reason',manual_reason) else null end as "manualApproval"
   from public.academy_upi_payment_orders
   where (case when term<>'' then true when p_tab='review' then review_reason is not null
    else status in('paid','failed','cancelled','refunded') or gateway_status in('COMPLETED','REJECTED','EXPIRED') end)
   and (term='' or position(lower(term) in lower(concat_ws(' ',id::text,student_name,email,course,utr,submitted_reference,manual_approved_by,manual_reason)))>0
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
