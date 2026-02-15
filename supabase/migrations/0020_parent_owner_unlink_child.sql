-- Allow parent page owner to unlink a child (set child's parent_page_id to null).
create policy "parent owners unlink child page"
on public.pages
for update
to authenticated
using (
  exists (
    select 1 from public.pages parent
    where parent.id = pages.parent_page_id
      and parent.owner_id = auth.uid()
  )
)
with check (parent_page_id is null);