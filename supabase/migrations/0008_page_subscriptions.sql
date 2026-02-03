create table if not exists public.page_subscriptions (
  user_id uuid not null references public.users (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

alter table public.page_subscriptions enable row level security;

drop policy if exists "users manage page subscriptions" on public.page_subscriptions;
create policy "users manage page subscriptions"
on public.page_subscriptions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
