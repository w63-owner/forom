create index if not exists notifications_email_created_at_idx
  on public.notifications (email, created_at desc);
