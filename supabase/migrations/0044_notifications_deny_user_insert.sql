-- Deny direct INSERT from authenticated users on notifications table.
-- Only SECURITY DEFINER triggers should create notification rows.

drop policy if exists "deny user insert notifications" on public.notifications;
create policy "deny user insert notifications"
on public.notifications
for insert
to authenticated
with check (false);
