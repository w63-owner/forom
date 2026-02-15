drop policy if exists "child owners update page parent requests" on public.page_parent_requests;
create policy "child owners update page parent requests"
on public.page_parent_requests
for update
to authenticated
using (
  requested_by = auth.uid()
  and exists (
    select 1 from public.pages child
    where child.id = child_page_id
      and child.owner_id = auth.uid()
  )
)
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.pages child
    where child.id = child_page_id
      and child.owner_id = auth.uid()
  )
);