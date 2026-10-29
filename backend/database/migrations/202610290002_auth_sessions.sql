-- Phase 2: managed identity plus application-enforced admission, MFA and email actions.
alter table public.profiles add column sessions_invalid_before timestamptz not null default 'epoch';
alter table public.device_sessions add column admitted_at timestamptz;

create table public.auth_rate_limits (
  key text primary key, attempts integer not null default 1,
  window_ends_at timestamptz not null
);
create table public.auth_email_actions (
  nonce_hash text primary key check(length(nonce_hash)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_ciphertext text not null,
  purpose text not null check(purpose in ('signup','recovery','invite')),
  next_path text not null default '/account',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  delivery_state text not null default 'pending' check(delivery_state in ('pending','sent','failed')),
  created_at timestamptz not null default now()
);
create table public.auth_recovery_grants (
  nonce_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
alter table public.auth_rate_limits enable row level security;
alter table public.auth_email_actions enable row level security;
alter table public.auth_recovery_grants enable row level security;
revoke all on public.auth_rate_limits, public.auth_email_actions, public.auth_recovery_grants from public,anon,authenticated,service_role;
grant all on public.auth_rate_limits, public.auth_email_actions, public.auth_recovery_grants to service_role;
create index auth_email_expiry_idx on public.auth_email_actions(expires_at);
create index auth_limit_expiry_idx on public.auth_rate_limits(window_ends_at);

create function public.auth_consume_limit(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  if p_limit<1 or p_seconds<1 then return false; end if;
  insert into public.auth_rate_limits as r(key,attempts,window_ends_at)
    values(p_key,1,now()+make_interval(secs=>p_seconds))
    on conflict(key) do update set
      attempts=case when r.window_ends_at<=now() then 1 else r.attempts+1 end,
      window_ends_at=case when r.window_ends_at<=now() then now()+make_interval(secs=>p_seconds) else r.window_ends_at end
    returning attempts into n;
  return n<=p_limit;
end; $$;

create function public.auth_admit_device(p_user uuid,p_session uuid,p_name text,p_remember boolean,p_replace uuid default null) returns text
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz; is_blocked boolean; cap integer; current_device public.device_sessions;
begin
  select blocked,sessions_invalid_before into is_blocked,cutoff from public.profiles where id=p_user for update;
  if not found or is_blocked then return 'blocked'; end if;
  if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and created_at>cutoff and (not_after is null or not_after>now())) then return 'revoked'; end if;
  select * into current_device from public.device_sessions where auth_session_id=p_session and user_id=p_user;
  if found then
    if current_device.revoked_at is not null or current_device.expires_at<=now() then return 'revoked'; end if;
    if current_device.admitted_at is not null then
      update public.device_sessions set last_active_at=now() where id=current_device.id;
      return 'admitted';
    end if;
  else
    insert into public.device_sessions(user_id,auth_session_id,device_name,expires_at,admitted_at)
    values(p_user,p_session,left(p_name,100),now()+case when p_remember then interval '30 days' else interval '12 hours' end,null);
  end if;
  if p_replace is not null then
    update public.device_sessions set revoked_at=now() where id=p_replace and user_id=p_user and auth_session_id<>p_session and revoked_at is null;
    if not found then return 'invalid_device'; end if;
    insert into public.audit_log(actor_id,action,target_type,target_id) values(p_user,'device_replaced','device',p_replace::text);
  end if;
  select device_limit into cap from public.site_settings where id=true;
  if (select count(*) from public.device_sessions d join auth.sessions s on s.id=d.auth_session_id
      where d.user_id=p_user and d.admitted_at is not null and d.revoked_at is null and d.expires_at>now()
      and s.created_at>cutoff and (s.not_after is null or s.not_after>now()))>=coalesce(cap,2) then return 'limit'; end if;
  update public.device_sessions set admitted_at=now(),last_active_at=now() where user_id=p_user and auth_session_id=p_session;
  return 'admitted';
end; $$;

create function public.auth_revoke_devices(p_user uuid,p_current uuid,p_target uuid default null,p_all boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=p_user for update;
  if p_all then
    update public.profiles set sessions_invalid_before=now() where id=p_user;
    update public.device_sessions set revoked_at=now() where user_id=p_user and revoked_at is null;
  else
    update public.device_sessions set revoked_at=now() where user_id=p_user and (id=p_target or (p_target is null and auth_session_id=p_current)) and revoked_at is null;
  end if;
  insert into public.audit_log(actor_id,action,target_type,target_id) values(p_user,case when p_all then 'logout_all' else 'device_revoked' end,'account',p_user::text);
  return true;
end; $$;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
create function app_private.admitted_session() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.device_sessions d
    join public.profiles p on p.id=d.user_id
    join auth.sessions s on s.id=d.auth_session_id and s.user_id=d.user_id
    where d.user_id=auth.uid() and d.auth_session_id::text=(auth.jwt()->>'session_id')
    and not p.blocked and d.admitted_at is not null and d.revoked_at is null and d.expires_at>now()
    and s.created_at>p.sessions_invalid_before and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function app_private.admitted_session() from public,anon,authenticated;
grant execute on function app_private.admitted_session() to authenticated;
drop policy profiles_own_read on public.profiles;
drop policy orders_own_read on public.orders;
drop policy enrollments_own_read on public.enrollments;
drop policy devices_own_read on public.device_sessions;
create policy profiles_own_read on public.profiles for select to authenticated using(id=auth.uid() and app_private.admitted_session());
create policy orders_own_read on public.orders for select to authenticated using(user_id=auth.uid() and app_private.admitted_session());
create policy enrollments_own_read on public.enrollments for select to authenticated using(user_id=auth.uid() and app_private.admitted_session());
create policy devices_own_read on public.device_sessions for select to authenticated using(user_id=auth.uid() and app_private.admitted_session());

create function public.auth_has_session(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.device_sessions d join public.profiles p on p.id=d.user_id
 join auth.sessions s on s.id=d.auth_session_id and s.user_id=d.user_id
 where d.user_id=p_user and d.auth_session_id=p_session and d.admitted_at is not null
 and d.revoked_at is null and d.expires_at>now() and not p.blocked and s.created_at>p.sessions_invalid_before
 and (s.not_after is null or s.not_after>now()));
$$;

create function public.auth_list_staff() returns table(id uuid,full_name text,email text,role text)
language sql stable security definer set search_path='' as $$
 select p.id,p.full_name,u.email::text,p.role from public.profiles p join auth.users u on u.id=p.id where p.role in ('admin','support') order by p.created_at;
$$;

revoke all on function public.auth_consume_limit(text,integer,integer),public.auth_admit_device(uuid,uuid,text,boolean,uuid),public.auth_revoke_devices(uuid,uuid,uuid,boolean),public.auth_has_session(uuid,uuid),public.auth_list_staff() from public,anon,authenticated;
grant execute on function public.auth_consume_limit(text,integer,integer),public.auth_admit_device(uuid,uuid,text,boolean,uuid),public.auth_revoke_devices(uuid,uuid,uuid,boolean),public.auth_has_session(uuid,uuid),public.auth_list_staff() to service_role;

create function public.auth_user_exists(p_email text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where lower(email)=lower(p_email));
$$;
revoke all on function public.auth_user_exists(text) from public,anon,authenticated;
grant execute on function public.auth_user_exists(text) to service_role;
