-- Final overview contract: revenue is based on orders, and enrolled students
-- are learners with active, non-refunded paid purchases.
create or replace function public.admin_overview(
  p_actor uuid,
  p_session uuid,
  p_since timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  gross bigint;
  refunded bigint;
  sales integer;
  students integer;
  courses_count integer;
  enrolled_students integer;
  pending integer;
  chart jsonb;
  breakdown jsonb;
begin
  perform public.admin_guard(p_actor,p_session,false);
  select coalesce(sum(total_paise),0),
    coalesce(sum(total_paise) filter(where status='refunded'),0),
    count(*)
  into gross,refunded,sales
  from public.orders
  where status in('paid','refunded') and paid_at>=p_since;
  select count(*) into students from public.profiles where role='student' and created_at>=p_since;
  select count(*) into courses_count from public.courses;
  select count(distinct e.user_id) into enrolled_students
  from public.enrollments e
  join public.orders o on o.id=e.order_id
  where e.source='purchase'
    and e.active
    and e.revoked_at is null
    and o.status='paid'
    and o.user_id=e.user_id
    and o.course_id=e.course_id
    and (e.expires_at is null or e.expires_at>now());
  select count(*) into pending from public.refund_requests where state='requested';
  select coalesce(jsonb_agg(jsonb_build_object('day',day,'total',total) order by day),'[]')
  into chart
  from (
    select (paid_at at time zone 'Asia/Kolkata')::date as day,sum(total_paise) as total
    from public.orders
    where status in('paid','refunded') and paid_at>=p_since group by 1
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object(
    'title',title,'sales',sale_count,'gross',course_gross,'net',course_net
  ) order by course_gross desc),'[]')
  into breakdown
  from (
    select coalesce(max(course_snapshot->>'title'),'Course') as title,
      count(*) as sale_count,sum(total_paise) as course_gross,
      coalesce(sum(total_paise) filter(where status='paid'),0) as course_net
    from public.orders
    where status in('paid','refunded') and paid_at>=p_since group by course_id
  ) x;
  return jsonb_build_object(
    'gross',gross,'refunded',refunded,'net',gross-refunded,'sales',sales,
    'refundRate',case when sales>0 then round(100.0*(
      select count(*) from public.orders where status='refunded' and paid_at>=p_since
    )/sales,2) else 0 end,
    'newStudents',students,'coursesCount',courses_count,
    'enrolledStudents',enrolled_students,'pendingRefunds',pending,
    'chart',chart,'courses',breakdown,'limited',false
  );
end;
$$;
