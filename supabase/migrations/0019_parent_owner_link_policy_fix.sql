drop policy if exists "parent owners link child page" on public.pages;
create policy "parent owners link child page"
on public.pages
for update
to authenticated
using (
  exists (
    select 1
    from public.page_parent_requests req
    join public.pages parent on parent.id = req.parent_page_id
    where req.child_page_id = pages.id
      and req.status = 'approved'
      and parent.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.page_parent_requests req
    where req.child_page_id = pages.id
      and req.status = 'approved'
      and req.parent_page_id = pages.parent_page_id
  )
);