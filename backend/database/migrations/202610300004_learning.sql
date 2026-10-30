-- Phase 4: server-owned learning access, persistent resume and bounded unique watch ranges.
create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  position_ms integer not null default 0 check(position_ms>=0),
  duration_seconds integer not null check(duration_seconds>0 and duration_seconds<=86400),
  watched int4multirange not null default '{}',
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,lesson_id)
);
create table public.learning_playbacks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  session_id uuid not null,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  sequence integer not null default 0,
  position_ms integer not null default 0,
  playing boolean not null default false,
  last_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default now()+interval '2 minutes'
);
create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null check(length(title) between 1 and 200),
  content text not null check(length(content)<=100000),
  position integer not null default 0 check(position>=0)
);
alter table public.site_settings add column public_telegram_url text,
  add column public_instagram_url text, add column private_telegram_url text,
  add column private_invite_expires_at timestamptz;
alter table public.lesson_progress enable row level security;
alter table public.learning_playbacks enable row level security;
alter table public.lesson_resources enable row level security;
revoke all on public.lesson_progress,public.learning_playbacks,public.lesson_resources from public,anon,authenticated,service_role;
grant all on public.lesson_progress,public.learning_playbacks,public.lesson_resources to service_role;
grant select on public.lesson_progress to authenticated;
create policy progress_own_read on public.lesson_progress for select to authenticated
 using(user_id=auth.uid() and app_private.admitted_session());

-- Caller credentials are server-only; still verify session and entitlement inside transactions.
create function public.learning_can_access(p_user uuid,p_session uuid,p_lesson uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.auth_has_session(p_user,p_session) and exists(
 select 1 from public.lessons l join public.modules m on m.id=l.module_id
 join public.courses c on c.id=m.course_id
 where l.id=p_lesson and l.published and c.status='published' and l.duration_seconds between 1 and 86400
 and (l.is_preview or exists(select 1 from public.enrollments e
 left join public.orders o on o.id=e.order_id
 where e.user_id=p_user and e.course_id=c.id and e.active and e.revoked_at is null
 and (e.source='manual' or (o.status='paid' and o.user_id=p_user and o.course_id=c.id)))));
$$;

create function public.learning_start(p_user uuid,p_session uuid,p_lesson uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lease public.learning_playbacks; progress public.lesson_progress; duration integer;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not public.learning_can_access(p_user,p_session,p_lesson) then raise exception 'Access denied' using errcode='42501'; end if;
 select duration_seconds into duration from public.lessons where id=p_lesson;
 insert into public.lesson_progress(user_id,lesson_id,duration_seconds) values(p_user,p_lesson,duration) on conflict do nothing;
 select * into progress from public.lesson_progress where user_id=p_user and lesson_id=p_lesson;
 insert into public.learning_playbacks(user_id,session_id,lesson_id,position_ms)
 values(p_user,p_session,p_lesson,progress.position_ms)
 on conflict(user_id) do update set id=gen_random_uuid(),session_id=p_session,lesson_id=p_lesson,
 sequence=0,position_ms=progress.position_ms,playing=false,last_at=clock_timestamp(),expires_at=clock_timestamp()+interval '2 minutes'
 returning * into lease;
 return jsonb_build_object('leaseId',lease.id,'sequence',0,'position',progress.position_ms/1000.0,'completed',progress.completed);
end;$$;

create function public.learning_heartbeat(p_user uuid,p_session uuid,p_lease uuid,p_sequence integer,p_position integer,p_playing boolean,p_seeking boolean,p_rate numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lease public.learning_playbacks; progress public.lesson_progress; elapsed numeric; delta integer; credit integer:=0; position integer; watched_ms bigint; instant timestamptz:=clock_timestamp();
begin
 perform 1 from public.profiles where id=p_user for update;
 select * into lease from public.learning_playbacks where user_id=p_user and id=p_lease and session_id=p_session for update;
 if not found or lease.expires_at<=instant then raise exception 'Playback expired or replaced' using errcode='22023'; end if;
 if not public.learning_can_access(p_user,p_session,lease.lesson_id) then raise exception 'Access denied' using errcode='42501'; end if;
 if p_sequence<>lease.sequence+1 or p_rate<0.5 or p_rate>2 or p_position<0 then raise exception 'Invalid heartbeat' using errcode='22023'; end if;
 select * into progress from public.lesson_progress where user_id=p_user and lesson_id=lease.lesson_id for update;
 position:=least(p_position,progress.duration_seconds*1000);
 elapsed:=greatest(0,extract(epoch from instant-lease.last_at)*1000);
 delta:=position-lease.position_ms;
 -- No credit for seek jumps, missing/late pulses, or intervals that started paused.
 -- No per-request time allowance: rapid forged pulses cannot manufacture watch time.
 if lease.playing and not p_seeking and elapsed<=30000 and delta>0 and delta<=elapsed*2+1000 then
   credit:=least(delta,floor(elapsed*2)::integer);
 end if;
 update public.lesson_progress set position_ms=position,
 watched=case when credit>0 then watched+int4multirange(int4range(position-credit,position,'[)')) else watched end,
 updated_at=instant where user_id=p_user and lesson_id=lease.lesson_id returning * into progress;
 update public.learning_playbacks set sequence=p_sequence,position_ms=position,playing=p_playing and not p_seeking,
 last_at=instant,expires_at=instant+interval '2 minutes' where user_id=p_user;
 select coalesce(sum(upper(r)-lower(r)),0) into watched_ms from unnest(progress.watched) r;
 return jsonb_build_object('sequence',p_sequence,'position',position/1000.0,'watchedSeconds',watched_ms/1000.0,'completed',progress.completed);
end;$$;

create function public.learning_complete(p_user uuid,p_session uuid,p_lesson uuid,p_completed boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_user for update;
 if not public.learning_can_access(p_user,p_session,p_lesson) then raise exception 'Access denied' using errcode='42501'; end if;
 insert into public.lesson_progress(user_id,lesson_id,duration_seconds,completed)
 select p_user,id,duration_seconds,p_completed from public.lessons where id=p_lesson
 on conflict(user_id,lesson_id) do update set completed=p_completed,updated_at=clock_timestamp();
 return true;
end;$$;

create function public.learning_progress(p_user uuid) returns table(lesson_id uuid,position_ms integer,duration_seconds integer,watched_seconds numeric,completed boolean,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select p.lesson_id,p.position_ms,p.duration_seconds,
 (select coalesce(sum(upper(r)-lower(r)),0)/1000.0 from unnest(p.watched) r),p.completed,p.updated_at
 from public.lesson_progress p where p.user_id=p_user;
$$;
revoke all on function public.learning_can_access(uuid,uuid,uuid),public.learning_start(uuid,uuid,uuid),public.learning_heartbeat(uuid,uuid,uuid,integer,integer,boolean,boolean,numeric),public.learning_complete(uuid,uuid,uuid,boolean),public.learning_progress(uuid) from public,anon,authenticated;
grant execute on function public.learning_can_access(uuid,uuid,uuid),public.learning_start(uuid,uuid,uuid),public.learning_heartbeat(uuid,uuid,uuid,integer,integer,boolean,boolean,numeric),public.learning_complete(uuid,uuid,uuid,boolean),public.learning_progress(uuid) to service_role;
