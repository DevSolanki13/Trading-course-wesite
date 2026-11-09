-- Additive, service-only combined-provider history. Never replace the UPI order wrapper.
create index orders_history_cursor_idx on public.orders(user_id,created_at desc,id desc);
create index orders_pending_cursor_idx on public.orders(user_id,created_at desc,id desc) where status='pending';

create function public.purchase_history_page(p_user uuid,p_limit integer default 20,p_cursor jsonb default null,
 p_status text default 'all',p_provider text default 'all',p_pending_cursor jsonb default null,p_pending_only boolean default false)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; cursor_time timestamptz; cursor_id uuid; pending_time timestamptz; pending_id uuid;
begin
 if p_user is null then raise exception 'Sign in required'using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>50 or p_status is null or p_provider is null
 or p_status not in('all','pending','paid','failed','cancelled','refunded')
 or p_provider not in('all','mock','razorpay','upi','cashfree','demo')then
 raise exception 'Invalid history page'using errcode='22023';end if;
 if p_cursor is not null then
  cursor_time:=(p_cursor->>'createdAt')::timestamptz;cursor_id:=(p_cursor->>'id')::uuid;
  if cursor_time is null or cursor_id is null then raise exception 'Invalid cursor'using errcode='22023';end if;
 end if;
 if p_pending_cursor is not null then
  pending_time:=(p_pending_cursor->>'createdAt')::timestamptz;pending_id:=(p_pending_cursor->>'id')::uuid;
  if pending_time is null or pending_id is null then raise exception 'Invalid pending cursor'using errcode='22023';end if;
 end if;
 with page as materialized (
  select o.* from public.orders o where not p_pending_only and o.user_id=p_user
  and(p_status='all'or o.status=p_status)
  and(p_provider='all'or coalesce(o.purchase_provider,case when o.provider_order_id like 'cf_sbx_%'then 'cashfree'else 'demo'end)=p_provider)
  and(cursor_time is null or(o.created_at,o.id)<(cursor_time,cursor_id))
  order by o.created_at desc,o.id desc limit p_limit+1
 ), visible as materialized(select * from page order by created_at desc,id desc limit p_limit),
 pending_page as materialized(
  select o.id,o.created_at,o.purchase_provider,o.provider_order_id,o.status from public.orders o
  where o.user_id=p_user and o.status='pending'
  and(pending_time is null or(o.created_at,o.id)<(pending_time,pending_id))
  order by o.created_at desc,o.id desc limit 5
 ), pending_visible as(select * from pending_page order by created_at desc,id desc limit 4)
 select jsonb_build_object(
  'orders',coalesce((select jsonb_agg(jsonb_build_object(
   'id',o.id,'userId',o.user_id,'courseId',o.course_id,
   'slug',coalesce(o.course_snapshot->>'slug',c.slug,''),'courseTitle',coalesce(o.course_snapshot->>'title',c.title,'Course purchase'),
   'amount',o.total_paise,'base',o.base_paise,'tax',o.tax_paise,'currency',o.currency,'status',o.status,
   'provider',coalesce(o.purchase_provider,case when o.provider_order_id like 'cf_sbx_%'then 'cashfree'else 'demo'end),
   'providerOrderId',o.provider_order_id,'createdAt',o.created_at,'paidAt',o.paid_at,
   'accessPeriod',coalesce((o.course_snapshot->>'access_period')::integer,1),
   'accessUnit',coalesce(o.course_snapshot->>'access_unit','months'),'accessExpiresAt',e.expires_at
  )order by o.created_at desc,o.id desc)from visible o left join public.courses c on c.id=o.course_id
   left join public.enrollments e on e.order_id=o.id),'[]'::jsonb),
  'nextCursor',case when(select count(*)from page)>p_limit then
   (select jsonb_build_object('createdAt',created_at,'id',id)from visible order by created_at,id limit 1)else null end,
  'totalCount',s.total_count,'filteredCount',s.filtered_count,'totalAmount',s.total_amount,'paidAmount',s.paid_amount,'pendingCount',s.pending_count,'unsupportedPendingCount',s.unsupported_pending_count,
  'pending',coalesce((select jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at,'status',status,
   'provider',coalesce(purchase_provider,case when provider_order_id like 'cf_sbx_%'then 'cashfree'else 'demo'end))order by created_at desc,id desc)from pending_visible),'[]'::jsonb),
  'nextPendingCursor',case when(select count(*)from pending_page)>4 then
   (select jsonb_build_object('createdAt',created_at,'id',id)from pending_visible order by created_at,id limit 1)else null end
 )into result from(
  select count(*)as total_count,coalesce(sum(total_paise),0)as total_amount,
   coalesce(sum(total_paise)filter(where status='paid'),0)as paid_amount,count(*)filter(where status='pending')as pending_count,
   count(*)filter(where status='pending'and purchase_provider is not null)as unsupported_pending_count,
   count(*)filter(where(p_status='all'or status=p_status)and(p_provider='all'or
    coalesce(purchase_provider,case when provider_order_id like 'cf_sbx_%'then 'cashfree'else 'demo'end)=p_provider))as filtered_count
  from public.orders where user_id=p_user
 )s;
 return result;
end;$$;
revoke all on function public.purchase_history_page(uuid,integer,jsonb,text,text,jsonb,boolean)from public,anon,authenticated;
grant execute on function public.purchase_history_page(uuid,integer,jsonb,text,text,jsonb,boolean)to service_role;
