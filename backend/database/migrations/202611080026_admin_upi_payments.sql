-- Display-only mirror for Academy's shared-account UPI admin queues.
-- Ingestion cannot settle orders, grant access, or write to IndianXtrade.
create table public.academy_upi_sync (
 id boolean primary key default true check(id),
 secret_hash text not null check(length(secret_hash)=64),
 source_at timestamptz,
 synced_at timestamptz
);
create table public.academy_upi_gateway_deposits (
 token text primary key check(token ~ '^[A-Za-z0-9_-]{24,128}$'),
 amount_paise bigint not null check(amount_paise>0),
 status text not null check(status in('AWAITING_PAYMENT','PENDING_CONFIRMATION','COMPLETED','REJECTED','EXPIRED')),
 utr text,
 updated_at timestamptz not null
);
create table public.academy_upi_unmatched_credits (
 id text primary key,
 utr text not null,
 amount_paise bigint not null check(amount_paise>0),
 received_at timestamptz not null
);
alter table public.academy_upi_sync enable row level security;
alter table public.academy_upi_gateway_deposits enable row level security;
alter table public.academy_upi_unmatched_credits enable row level security;
revoke all on public.academy_upi_sync,public.academy_upi_gateway_deposits,public.academy_upi_unmatched_credits from public,anon,authenticated,service_role;

create function public.academy_upi_sync_snapshot(p_secret text,p_snapshot jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare source_time timestamptz; previous_time timestamptz;
begin
 if p_secret is null or length(p_secret)<40 or not exists(
  select 1 from public.academy_upi_sync where secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')
 ) then raise exception 'Sync denied' using errcode='42501';end if;
 if p_snapshot->>'version' is distinct from '1' or p_snapshot->>'complete' is distinct from 'true'
  or jsonb_typeof(p_snapshot->'deposits') is distinct from 'array'
  or jsonb_typeof(p_snapshot->'credits') is distinct from 'array'
  or octet_length(p_snapshot::text)>10000000
 then raise exception 'Invalid snapshot' using errcode='22023';end if;
 source_time:=(p_snapshot->>'sourceAt')::timestamptz;
 if source_time is null or source_time>clock_timestamp()+interval '2 minutes'
  or source_time<clock_timestamp()-interval '10 minutes'
 then raise exception 'Stale snapshot' using errcode='22023';end if;
 select source_at into previous_time from public.academy_upi_sync where id=true for update;
 if previous_time is not null and source_time<=previous_time then return;end if;
 delete from public.academy_upi_gateway_deposits;
 insert into public.academy_upi_gateway_deposits(token,amount_paise,status,utr,updated_at)
 select token,amount,status,utr,"updatedAt" from jsonb_to_recordset(p_snapshot->'deposits')
 as d(token text,amount bigint,status text,utr text,"updatedAt" timestamptz);
 delete from public.academy_upi_unmatched_credits;
 insert into public.academy_upi_unmatched_credits(id,utr,amount_paise,received_at)
 select id,utr,amount,"receivedAt" from jsonb_to_recordset(p_snapshot->'credits')
 as c(id text,utr text,amount bigint,"receivedAt" timestamptz);
 update public.academy_upi_sync set source_at=source_time,synced_at=clock_timestamp() where id=true;
end;$$;
revoke all on function public.academy_upi_sync_snapshot(text,jsonb) from public,anon,authenticated,service_role;
-- High-entropy, separate ingestion credential: display-only writes, never purchase settlement.
grant execute on function public.academy_upi_sync_snapshot(text,jsonb) to anon,service_role;

create view public.academy_upi_payment_orders as
 select o.id,o.user_id,o.total_paise as amount,p.full_name as student_name,u.email,
 coalesce(o.course_snapshot->>'title',c.title) as course,o.status,o.created_at,o.paid_at,
 i.gateway_checkout_token is not null as gateway_bound,
 coalesce(g.utr,credit.utr) as utr,g.status as gateway_status,
 case
  when g.amount_paise is not null and g.amount_paise<>i.amount_paise then 'Gateway amount differs'
  when g.status='PENDING_CONFIRMATION' then 'Payment needs verification'
  when o.status='pending' and g.status='COMPLETED' then 'Payment received; course access pending'
  when o.status='pending' and g.status in('REJECTED','EXPIRED') then 'Checkout needs closing'
  when o.status='pending' and i.expires_at<=clock_timestamp() then 'Checkout expired'
  else null end as review_reason
 from public.orders o join public.profiles p on p.id=o.user_id
 join auth.users u on u.id=o.user_id join public.courses c on c.id=o.course_id
 left join public.upi_intents i on i.order_id=o.id
 left join public.academy_upi_gateway_deposits g on g.token=i.gateway_checkout_token
 left join public.upi_credits credit on credit.order_id=o.id
 where o.purchase_provider='upi' and o.currency='INR';
revoke all on public.academy_upi_payment_orders from public,anon,authenticated,service_role;

-- Called only after Academy staff authentication, including MFA, on the server.
create function public.academy_upi_payment_read(p_tab text,p_query text,p_page integer) returns jsonb
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
    gateway_bound as "gatewayBound",review_reason as "reviewReason"
   from public.academy_upi_payment_orders
   where (case when term<>'' then true when p_tab='review' then review_reason is not null
    else status in('paid','failed','cancelled','refunded') or gateway_status in('COMPLETED','REJECTED','EXPIRED') end)
   and (term='' or position(lower(term) in lower(concat_ws(' ',id::text,student_name,email,course,utr)))>0
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
