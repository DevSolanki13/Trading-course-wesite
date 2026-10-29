-- Phase 0 foundation. Apply to a dedicated Supabase staging project.
-- No provider secrets, sample purchases or invented production content belong here.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'student' check (role in ('student', 'support', 'admin')),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200));
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  language text not null default 'Hindi',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  price_paise integer not null check (price_paise >= 0),
  sale_price_paise integer check (sale_price_paise >= 0 and sale_price_paise <= price_paise),
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  title text not null,
  position integer not null check (position >= 0),
  unique (course_id, position)
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id),
  title text not null,
  position integer not null check (position >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  is_preview boolean not null default false,
  published boolean not null default false,
  unique (module_id, position)
);
-- Separate storage prevents public curriculum queries exposing paid asset IDs/notes.
create table public.lesson_assets (
  lesson_id uuid primary key references public.lessons(id),
  provider_video_id text not null,
  notes text not null default ''
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  course_id uuid not null references public.courses(id),
  provider_order_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  currency text not null default 'INR' check (currency = 'INR'),
  base_paise integer not null check (base_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0 and discount_paise <= base_paise),
  gst_enabled boolean not null default false,
  gst_rate_bps integer not null default 0 check (gst_rate_bps between 0 and 10000),
  tax_paise integer not null default 0 check (tax_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  course_snapshot jsonb not null default '{}'::jsonb,
  billing_snapshot jsonb not null default '{}'::jsonb,
  refund_policy_snapshot jsonb not null default '{"window_days":7,"watch_limit_percent":10}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (total_paise = base_paise - discount_paise + tax_paise),
  check (gst_enabled or (tax_paise = 0 and gst_rate_bps = 0))
);
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  provider_payment_id text not null unique,
  status text not null,
  amount_paise integer not null check (amount_paise >= 0),
  created_at timestamptz not null default now()
);
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('cashfree')),
  payload_hash text not null check (length(payload_hash) = 64),
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, payload_hash)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  course_id uuid not null references public.courses(id),
  order_id uuid unique references public.orders(id),
  source text not null check (source in ('purchase', 'manual')),
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((source = 'purchase' and order_id is not null) or (source = 'manual' and order_id is null))
);
create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  auth_session_id uuid not null unique,
  device_name text not null,
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.site_settings (
  id boolean primary key default true check (id),
  gst_enabled boolean not null default false,
  gst_rate_bps integer not null default 1800 check (gst_rate_bps between 0 and 10000),
  gstin text,
  device_limit integer not null default 2 check (device_limit > 0),
  refund_window_days integer not null default 7 check (refund_window_days >= 0),
  refund_watch_limit_percent integer not null default 10 check (refund_watch_limit_percent between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index attempts_order_idx on public.payment_attempts (order_id);
create index enrollment_user_course_idx on public.enrollments (user_id, course_id) where active;
create index devices_user_idx on public.device_sessions (user_id) where revoked_at is null;
create index webhook_status_idx on public.webhook_events (status, received_at);
create index courses_published_idx on public.courses (slug) where status = 'published';

-- Default-deny all client writes. Future phases must add narrowly scoped policies.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_assets enable row level security;
alter table public.orders enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.enrollments enable row level security;
alter table public.device_sessions enable row level security;
alter table public.audit_log enable row level security;
alter table public.site_settings enable row level security;

revoke all on public.profiles, public.courses, public.modules, public.lessons,
  public.lesson_assets, public.orders, public.payment_attempts, public.webhook_events,
  public.enrollments, public.device_sessions, public.audit_log, public.site_settings
  from anon, authenticated, service_role;

revoke all on sequence public.audit_log_id_seq from anon, authenticated, service_role;

grant select on public.courses, public.modules, public.lessons to anon, authenticated;
grant select on public.profiles, public.orders, public.enrollments, public.device_sessions to authenticated;
grant all on public.profiles, public.courses, public.modules, public.lessons,
  public.lesson_assets, public.orders, public.payment_attempts, public.webhook_events,
  public.enrollments, public.device_sessions, public.site_settings to service_role;
-- Even service-role code cannot update/delete existing audit records.
grant select, insert on public.audit_log to service_role;
grant usage, select on sequence public.audit_log_id_seq to service_role;

create policy courses_public_read on public.courses for select to anon, authenticated
  using (status = 'published');
create policy modules_public_read on public.modules for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));
create policy lessons_public_read on public.lessons for select to anon, authenticated
  using (published and exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
    where m.id = module_id and c.status = 'published'
  ));
create policy profiles_own_read on public.profiles for select to authenticated using (id = auth.uid());
create policy orders_own_read on public.orders for select to authenticated using (user_id = auth.uid());
create policy enrollments_own_read on public.enrollments for select to authenticated using (user_id = auth.uid());
create policy devices_own_read on public.device_sessions for select to authenticated using (user_id = auth.uid());

-- Money/tax/billing snapshots become immutable after payment confirmation.
create function public.protect_paid_order() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status in ('paid', 'refunded') and (
    new.user_id is distinct from old.user_id or new.course_id is distinct from old.course_id or
    new.base_paise is distinct from old.base_paise or new.discount_paise is distinct from old.discount_paise or
    new.tax_paise is distinct from old.tax_paise or new.total_paise is distinct from old.total_paise or
    new.gst_enabled is distinct from old.gst_enabled or new.gst_rate_bps is distinct from old.gst_rate_bps or
    new.currency is distinct from old.currency or new.course_snapshot is distinct from old.course_snapshot or
    new.billing_snapshot is distinct from old.billing_snapshot or
    new.refund_policy_snapshot is distinct from old.refund_policy_snapshot or
    new.provider_order_id is distinct from old.provider_order_id or new.paid_at is distinct from old.paid_at
  ) then raise exception 'Paid order snapshots are immutable'; end if;
  if old.status = 'paid' and new.status not in ('paid', 'refunded') then
    raise exception 'Paid orders cannot be downgraded';
  end if;
  if old.status = 'refunded' and new.status <> 'refunded' then
    raise exception 'Refunded orders are terminal';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_paid_order() from public, anon, authenticated;
create trigger orders_protect_snapshots before update on public.orders
for each row execute procedure public.protect_paid_order();
