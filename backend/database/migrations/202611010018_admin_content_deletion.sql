-- Allow administrators to permanently remove unused draft content while preserving learner history.
create or replace function public.admin_delete_lesson(
  p_actor uuid,
  p_session uuid,
  p_course uuid,
  p_module uuid,
  p_lesson uuid,
  p_version integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_version integer;
begin
  perform public.admin_guard(p_actor,p_session,true);
  select c.version into current_version
  from public.courses c
  join public.modules m on m.course_id=c.id
  join public.lessons l on l.module_id=m.id
  where c.id=p_course and m.id=p_module and l.id=p_lesson
  for update;
  if current_version is null then raise exception 'Lesson missing' using errcode='22023'; end if;
  if current_version<>p_version then raise exception 'Version conflict' using errcode='40001'; end if;
  if exists(select 1 from public.lesson_progress where lesson_id=p_lesson)
     or exists(select 1 from public.order_watch_ranges where lesson_id=p_lesson)
  then raise exception 'Lesson has learner history' using errcode='22023'; end if;
  delete from public.lesson_resources where lesson_id=p_lesson;
  delete from public.lesson_assets where lesson_id=p_lesson;
  delete from public.lessons where id=p_lesson;
  update public.courses set version=version+1,updated_at=now() where id=p_course;
  return jsonb_build_object('courseId',p_course);
end;
$$;

create or replace function public.admin_delete_course(
  p_actor uuid,
  p_session uuid,
  p_course uuid,
  p_version integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_version integer;
begin
  perform public.admin_guard(p_actor,p_session,true);
  select version into current_version from public.courses where id=p_course for update;
  if current_version is null then raise exception 'Course missing' using errcode='22023'; end if;
  if current_version<>p_version then raise exception 'Version conflict' using errcode='40001'; end if;
  if exists(select 1 from public.orders where course_id=p_course)
     or exists(select 1 from public.enrollments where course_id=p_course)
  then raise exception 'Course has order or learner history' using errcode='22023'; end if;
  delete from public.lesson_resources where lesson_id in
    (select l.id from public.lessons l join public.modules m on m.id=l.module_id where m.course_id=p_course);
  delete from public.lesson_assets where lesson_id in
    (select l.id from public.lessons l join public.modules m on m.id=l.module_id where m.course_id=p_course);
  delete from public.lessons where module_id in
    (select id from public.modules where course_id=p_course);
  delete from public.modules where course_id=p_course;
  delete from public.coupons where course_id=p_course;
  delete from public.courses where id=p_course;
  return jsonb_build_object('deletedCourseId',p_course);
end;
$$;
