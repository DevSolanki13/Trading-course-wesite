-- Public readers may see published announcements only. Management remains
-- behind the authenticated admin API using the server-only service role.
alter table public.announcements enable row level security;

revoke all on public.announcements from public, anon, authenticated;
grant select on public.announcements to anon, authenticated;
grant select, insert, update, delete on public.announcements to service_role;

create policy announcements_active_read on public.announcements
  for select to anon, authenticated
  using (active = true);
