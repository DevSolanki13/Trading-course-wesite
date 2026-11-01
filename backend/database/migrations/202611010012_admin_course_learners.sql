-- Course-scoped learner progress for authorised staff dashboards.
create or replace function public.admin_course_learners(
  p_actor uuid,
  p_session uuid,
  p_course uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  course_row public.courses;
  result jsonb;
begin
  perform public.admin_guard(p_actor, p_session, false);
  select * into course_row from public.courses where id=p_course;
  if not found then
    raise exception 'Course not found' using errcode='P0002';
  end if;

  select jsonb_build_object(
    'course', jsonb_build_object(
      'id', course_row.id,
      'title', course_row.title,
      'slug', course_row.slug,
      'status', course_row.status,
      'lessonCount', (
        select count(*) from public.modules m
        join public.lessons l on l.module_id=m.id
        where m.course_id=course_row.id and l.published
      ),
      'lessons', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'moduleTitle', m.title,
          'position', (m.position * 10000) + l.position,
          'durationSeconds', l.duration_seconds
        ) order by m.position, l.position)
        from public.modules m
        join public.lessons l on l.module_id=m.id
        where m.course_id=course_row.id and l.published
      ), '[]'::jsonb)
    ),
    'learners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', learner.id,
        'name', learner.full_name,
        'email', auth_user.email,
        'grantedAt', enrollment.granted_at,
        'expiresAt', enrollment.expires_at,
        'active', enrollment.active and enrollment.revoked_at is null
          and (enrollment.expires_at is null or enrollment.expires_at > now()),
        'progressPercent', case when progress.total_lessons=0 then 0
          else round(progress.completed_lessons * 100.0 / progress.total_lessons) end,
        'completedLessons', progress.completed_lessons,
        'totalLessons', progress.total_lessons,
        'watchedSeconds', progress.watched_seconds,
        'lastActiveAt', progress.last_active_at,
        'lessons', progress.lessons
      ) order by learner.full_name, auth_user.email)
      from public.enrollments enrollment
      join public.profiles learner on learner.id=enrollment.user_id
      join auth.users auth_user on auth_user.id=learner.id
      cross join lateral (
        select
          count(*)::integer as total_lessons,
          count(*) filter (where coalesce(lp.completed,false))::integer as completed_lessons,
          coalesce(sum(coalesce((
            select sum(upper(r)-lower(r))/1000.0
            from unnest(lp.watched) r
          ),0)),0)::numeric as watched_seconds,
          max(lp.updated_at) as last_active_at,
          coalesce(jsonb_agg(jsonb_build_object(
            'lessonId', lesson.id,
            'title', lesson.title,
            'moduleTitle', module.title,
            'completed', coalesce(lp.completed,false),
            'positionSeconds', round(coalesce(lp.position_ms,0) / 1000.0),
            'watchedSeconds', coalesce((
              select sum(upper(r)-lower(r))/1000.0 from unnest(lp.watched) r
            ),0),
            'updatedAt', lp.updated_at
          ) order by module.position, lesson.position), '[]'::jsonb) as lessons
        from public.modules module
        join public.lessons lesson on lesson.module_id=module.id and lesson.published
        left join public.lesson_progress lp
          on lp.lesson_id=lesson.id and lp.user_id=learner.id
        where module.course_id=course_row.id
      ) progress
      where enrollment.course_id=course_row.id
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_course_learners(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_course_learners(uuid,uuid,uuid) to service_role;
