-- Phase 3 demo checkout support. Provider settlement remains webhook-only.
alter table public.orders add column if not exists idempotency_key text;
create unique index if not exists orders_user_idempotency_idx on public.orders(user_id, idempotency_key) where status = 'pending' and idempotency_key is not null;
alter table public.webhook_events drop constraint if exists webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check check (provider in ('cashfree','demo'));
