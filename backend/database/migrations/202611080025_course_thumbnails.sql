-- Uploaded artwork is served separately so catalogue responses contain only its URL.
create table public.course_thumbnails (
  id uuid primary key,
  content text not null check (length(content) between 1 and 699052),
  created_at timestamptz not null default now()
);
alter table public.course_thumbnails enable row level security;
revoke all on public.course_thumbnails from public, anon, authenticated;
grant select, insert on public.course_thumbnails to service_role;
