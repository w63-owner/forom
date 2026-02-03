create table if not exists public.proposition_subscriptions (
  user_id uuid not null references public.users (id) on delete cascade,
  proposition_id uuid not null references public.propositions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, proposition_id)
);

alter table public.proposition_subscriptions enable row level security;

drop policy if exists "users manage proposition subscriptions" on public.proposition_subscriptions;
create policy "users manage proposition subscriptions"
on public.proposition_subscriptions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
