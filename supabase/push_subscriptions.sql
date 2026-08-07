-- Run this in the Supabase SQL editor before the notifications feature can
-- work end-to-end — unlike public.progress and public.journal_entries, this
-- table did not already exist and there's no way for an app-side client
-- (anon or otherwise) to run DDL, so it has to be applied by hand.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  enabled boolean not null default true,
  frequency_per_week integer not null default 3,
  timezone text,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- api/send-nudges.js reads across all users with the service role key, which
-- bypasses RLS entirely — these policies only govern the browser's own
-- (anon-key, user-JWT) requests from the subscribe/unsubscribe flow.
create policy "select own push subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "update own push subscriptions"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "delete own push subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
