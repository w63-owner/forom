create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  type text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_email_unread_idx
  on public.notifications (email, read_at, created_at desc);

