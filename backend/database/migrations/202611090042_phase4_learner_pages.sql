-- P4.6 service-only read shared by authenticated staff RPC and the local-demo handler.
-- Local demo historically includes only purchases backed by matching paid orders.
create function public.admin_course_learner_read(
  p_course uuid, p_query text default '', p_page integer default 0,
  p_access text default 'all', p_learner uuid default null, p_paid_only boolean default false
) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
  course_row public.courses;
  course_json jsonb;
  result jsonb;
  lesson_count integer;
begin
  if p_page is null or p_page < 0 or p_page > 10000
    or p_access is null or p_access not in ('all','active','expired') then
    raise exception 'Invalid learner filters' using errcode='22023';
  end if;
  select * into course_row from public.courses where id=p_course;
  if not found then raise exception 'Course not found' using errcode='P0002'; end if;
  select count(*) into lesson_count from public.modules m
    join public.lessons l on l.module_id=m.id and l.published where m.course_id=p_course;
  course_json := jsonb_build_object('id',course_row.id,'title',course_row.title,
    'slug',course_row.slug,'status',course_row.status,'lessonCount',lesson_count);

  with eligible as materialized (
    select e.id as enrollment_id,e.user_id as id,p.full_name as name,u.email,e.granted_at,e.expires_at,
      e.active and e.revoked_at is null and (e.expires_at is null or e.expires_at>now()) as active
    from public.enrollments e join public.profiles p on p.id=e.user_id
    join auth.users u on u.id=p.id
    where e.course_id=p_course and (p_learner is null or e.user_id=p_learner)
      and (not p_paid_only or (e.source='purchase' and exists (
      select 1 from public.orders o where o.id=e.order_id and o.status='paid'
        and o.user_id=e.user_id and o.course_id=e.course_id
    )))
  ), filtered as materialized (
    select * from eligible where
      (p_learner is null and strpos(lower(coalesce(name,'')||' '||coalesce(email,'')),
        lower(left(btrim(coalesce(p_query,'')),120)))>0
        and (p_access='all' or active=(p_access='active')))
      or id=p_learner
  ), selected as materialized (
    select * from filtered order by name,email,id,enrollment_id limit case when p_learner is null then 50 else 1 end
      offset case when p_learner is null then p_page*50 else 0 end
  ), summaries as (
    select s.*, jsonb_build_object(
      'id',s.id,'enrollmentId',s.enrollment_id,'name',s.name,'email',s.email,'grantedAt',s.granted_at,'expiresAt',s.expires_at,
      'active',s.active,'totalLessons',lesson_count,'completedLessons',progress.completed,
      'progressPercent',case when lesson_count=0 then 0 else round(progress.completed*100.0/lesson_count) end,
      'watchedSeconds',progress.watched,'lastActiveAt',progress.updated
    ) || case when p_learner is null then '{}'::jsonb else jsonb_build_object('lessons',progress.lessons) end as summary
    from selected s cross join lateral (
      select count(*) filter(where lp.completed)::integer as completed,
        coalesce(sum(coalesce((select sum(upper(r)-lower(r))/1000.0 from unnest(lp.watched) r),0)),0) as watched,
        max(lp.updated_at) as updated,
        case when p_learner is null then null else coalesce(jsonb_agg(jsonb_build_object(
          'lessonId',l.id,'title',l.title,'moduleTitle',m.title,'completed',coalesce(lp.completed,false),
          'positionSeconds',case when p_paid_only then coalesce(lp.position_ms,0)/1000.0 else round(coalesce(lp.position_ms,0)/1000.0) end,
          'watchedSeconds',coalesce((select sum(upper(r)-lower(r))/1000.0 from unnest(lp.watched) r),0),
          'updatedAt',lp.updated_at
        ) order by m.position,l.position,m.id,l.id) filter (where p_learner is not null),'[]'::jsonb) end as lessons
      from public.modules m join public.lessons l on l.module_id=m.id and l.published
      left join public.lesson_progress lp on lp.lesson_id=l.id and lp.user_id=s.id
      where m.course_id=p_course
    ) progress
  )
  select case when p_learner is null then jsonb_build_object(
    'course',course_json,'learners',coalesce((select jsonb_agg(summary order by name,email,id,enrollment_id) from summaries),'[]'::jsonb),
    'enrolledTotal',(select count(*) from eligible),'total',(select count(*) from filtered),
    'page',p_page,'pageSize',50
  ) else (select jsonb_build_object('course',course_json,'learner',summary) from summaries) end into result;
  if result is null then raise exception 'Enrolled learner not found' using errcode='P0002'; end if;
  return result;
end; $$;

create function public.admin_course_learner_page(
  p_actor uuid, p_session uuid, p_course uuid, p_query text default '',
  p_page integer default 0, p_access text default 'all', p_learner uuid default null
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform public.admin_guard(p_actor,p_session,false);
  return public.admin_course_learner_read(p_course,p_query,p_page,p_access,p_learner,false);
end; $$;

revoke all on function public.admin_course_learner_read(uuid,text,integer,text,uuid,boolean),
  public.admin_course_learner_page(uuid,uuid,uuid,text,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_course_learner_read(uuid,text,integer,text,uuid,boolean),
  public.admin_course_learner_page(uuid,uuid,uuid,text,integer,text,uuid) to service_role;
