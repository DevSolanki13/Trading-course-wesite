-- Migration 202611030020: Exempt admin and support roles from the concurrent device limit cap
create or replace function public.auth_admit_device(p_user uuid,p_session uuid,p_name text,p_remember boolean,p_replace uuid default null) returns text
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz; is_blocked boolean; cap integer; current_device public.device_sessions; user_role text;
begin
  select blocked,sessions_invalid_before,role into is_blocked,cutoff,user_role from public.profiles where id=p_user for update;
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
  if user_role not in ('admin', 'support') then
    select device_limit into cap from public.site_settings where id=true;
    if (select count(*) from public.device_sessions d join auth.sessions s on s.id=d.auth_session_id
        where d.user_id=p_user and d.admitted_at is not null and d.revoked_at is null and d.expires_at>now()
        and s.created_at>cutoff and (s.not_after is null or s.not_after>now()))>=coalesce(cap,2) then return 'limit'; end if;
  end if;
  update public.device_sessions set admitted_at=now(),last_active_at=now() where user_id=p_user and auth_session_id=p_session;
  return 'admitted';
end; $$;

revoke all on function public.auth_admit_device(uuid,uuid,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.auth_admit_device(uuid,uuid,text,boolean,uuid) to service_role;

