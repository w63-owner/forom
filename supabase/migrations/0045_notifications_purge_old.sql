-- Purge function for old read notifications (> 90 days).
-- Can be invoked via pg_cron or a scheduled Edge Function.

create or replace function public.purge_old_notifications(retention_days int default 90)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count bigint;
begin
  delete from public.notifications
  where read_at is not null
    and read_at < now() - make_interval(days => retention_days);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Also add a DELETE policy so users can remove their own notifications.
drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications"
on public.notifications
for delete
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
