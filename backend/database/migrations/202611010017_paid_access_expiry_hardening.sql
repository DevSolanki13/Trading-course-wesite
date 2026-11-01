-- Require an active, unexpired enrollment backed by a confirmed paid order.
create or replace function public.purchase_has_access(p_user uuid,p_course uuid) returns boolean
language sql stable security definer
set search_path=''
as $$
  select p_user is not null and exists(
    select 1
    from public.profiles p
    where p.id=p_user and not p.blocked
  ) and exists(
    select 1
    from public.enrollments e
    join public.orders o on o.id=e.order_id
    where e.user_id=p_user
      and e.course_id=p_course
      and e.active
      and e.revoked_at is null
      and e.expires_at>clock_timestamp()
      and e.source='purchase'
      and o.status='paid'
      and o.paid_at is not null
      and o.paid_at<=clock_timestamp()
      and o.user_id=p_user
      and o.course_id=p_course
  );
$$;

create or replace function public.learning_can_access(
  p_user uuid,
  p_session uuid,
  p_lesson uuid
) returns boolean
language sql stable security definer
set search_path=''
as $$
  select public.auth_has_session(p_user,p_session) and exists(
    select 1
    from public.lessons l
    join public.modules m on m.id=l.module_id
    join public.courses c on c.id=m.course_id
    where l.id=p_lesson
      and l.published
      and c.status='published'
      and l.duration_seconds between 1 and 86400
      and (
        l.is_preview
        or public.purchase_has_access(p_user,c.id)
      )
  );
$$;

revoke all on function public.purchase_has_access(uuid,uuid),
  public.learning_can_access(uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.purchase_has_access(uuid,uuid),
  public.learning_can_access(uuid,uuid,uuid)
  to service_role;
