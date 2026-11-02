-- Announcements table for platform broadcasts from admin to students
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'General',
  priority text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  pinned boolean not null default false,
  active boolean not null default true,
  author_name text not null default 'Admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed an initial welcome broadcast
insert into public.announcements (title, content, category, priority, pinned, active, author_name)
values (
  'Welcome to GlobalBulls Academy! 🎯',
  'Welcome to the academy! New live trading breakdown modules and market structure lessons are released every week. Review your enrolled curriculum and complete your foundational risk management video.',
  'General',
  'important',
  true,
  true,
  'Admin'
) on conflict do nothing;

grant select on public.announcements to anon, authenticated;
grant select, insert, update, delete on public.announcements to service_role;

