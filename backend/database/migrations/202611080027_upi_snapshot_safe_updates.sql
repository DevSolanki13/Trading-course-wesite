-- Supabase safe-update protection requires explicit predicates, including private mirrors.
create or replace function public.academy_upi_sync_snapshot(p_secret text,p_snapshot jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare source_time timestamptz; previous_time timestamptz;
begin
 if p_secret is null or length(p_secret)<40 or not exists(
  select 1 from public.academy_upi_sync where secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')
 ) then raise exception 'Sync denied' using errcode='42501';end if;
 if p_snapshot->>'version' is distinct from '1' or p_snapshot->>'complete' is distinct from 'true'
  or jsonb_typeof(p_snapshot->'deposits') is distinct from 'array'
  or jsonb_typeof(p_snapshot->'credits') is distinct from 'array'
  or octet_length(p_snapshot::text)>10000000
 then raise exception 'Invalid snapshot' using errcode='22023';end if;
 source_time:=(p_snapshot->>'sourceAt')::timestamptz;
 if source_time is null or source_time>clock_timestamp()+interval '2 minutes'
  or source_time<clock_timestamp()-interval '10 minutes'
 then raise exception 'Stale snapshot' using errcode='22023';end if;
 select source_at into previous_time from public.academy_upi_sync where id=true for update;
 if previous_time is not null and source_time<=previous_time then return;end if;
 delete from public.academy_upi_gateway_deposits where token is not null;
 insert into public.academy_upi_gateway_deposits(token,amount_paise,status,utr,updated_at)
 select token,amount,status,utr,"updatedAt" from jsonb_to_recordset(p_snapshot->'deposits')
 as d(token text,amount bigint,status text,utr text,"updatedAt" timestamptz);
 delete from public.academy_upi_unmatched_credits where id is not null;
 insert into public.academy_upi_unmatched_credits(id,utr,amount_paise,received_at)
 select id,utr,amount,"receivedAt" from jsonb_to_recordset(p_snapshot->'credits')
 as c(id text,utr text,amount bigint,"receivedAt" timestamptz);
 update public.academy_upi_sync set source_at=source_time,synced_at=clock_timestamp() where id=true;
end;$$;
notify pgrst,'reload schema';
