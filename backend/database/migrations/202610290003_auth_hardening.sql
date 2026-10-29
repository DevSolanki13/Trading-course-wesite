-- Device-management challenges must also reject revoked/expired provider sessions.
create function public.auth_session_manageable(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.device_sessions d join public.profiles p on p.id=d.user_id
 join auth.sessions s on s.id=d.auth_session_id and s.user_id=d.user_id
 where d.user_id=p_user and d.auth_session_id=p_session and d.revoked_at is null
 and d.expires_at>now() and not p.blocked and s.created_at>p.sessions_invalid_before
 and (s.not_after is null or s.not_after>now()));
$$;
create function public.auth_list_devices(p_user uuid) returns table(id uuid,device_name text,last_active_at timestamptz,expires_at timestamptz,auth_session_id uuid)
language sql stable security definer set search_path='' as $$
 select d.id,d.device_name,d.last_active_at,d.expires_at,d.auth_session_id
 from public.device_sessions d join public.profiles p on p.id=d.user_id
 join auth.sessions s on s.id=d.auth_session_id and s.user_id=d.user_id
 where d.user_id=p_user and d.admitted_at is not null and d.revoked_at is null and d.expires_at>now()
 and not p.blocked and s.created_at>p.sessions_invalid_before and (s.not_after is null or s.not_after>now())
 order by d.last_active_at desc;
$$;
create function public.auth_claim_recovery(p_hash text,p_user uuid,p_session uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.auth_recovery_grants set consumed_at=now() where nonce_hash=p_hash and user_id=p_user
 and session_id=p_session and consumed_at is null and expires_at>now();
 return found;
end;$$;
revoke all on function public.auth_session_manageable(uuid,uuid),public.auth_list_devices(uuid),public.auth_claim_recovery(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.auth_session_manageable(uuid,uuid),public.auth_list_devices(uuid),public.auth_claim_recovery(text,uuid,uuid) to service_role;
