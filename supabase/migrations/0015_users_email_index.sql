-- Index for fast lookup by email (login "check email" step)
create index if not exists users_email_idx on public.users (email);