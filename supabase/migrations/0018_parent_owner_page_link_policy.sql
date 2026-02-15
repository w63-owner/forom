create or replace function public.enforce_parent_link_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and auth.uid() <> old.owner_id then
    if new.owner_id is distinct from old.owner_id
      or new.name is distinct from old.name
      or new.slug is distinct from old.slug
      or new.description is distinct from old.description
      or new.is_verified is distinct from old.is_verified
      or new.reactivity_score is distinct from old.reactivity_score
      or new.website_url is distinct from old.website_url
      or new.category is distinct from old.category
      or new.certification_type is distinct from old.certification_type
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Only parent_page_id can be updated by non-owners';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pages_parent_link_guard on public.pages;
create trigger pages_parent_link_guard
before update on public.pages
for each row execute function public.enforce_parent_link_update();

drop policy if exists "parent owners link child page" on public.pages;
create policy "parent owners link child page"
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
with check (
  exists (
    select 1 from public.page_parent_requests req
    where req.child_page_id = pages.id
      and req.parent_page_id = pages.parent_page_id
      and req.status = 'approved'
  )
);