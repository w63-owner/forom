drop policy if exists "owners update propositions" on public.propositions;
create policy "owners update propositions"
on public.propositions
for update
to authenticated
using (
  exists (
    select 1
    from public.pages p
    where p.id = propositions.page_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pages p
    where p.id = propositions.page_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "authors mark solutions" on public.comments;
create policy "authors mark solutions"
on public.comments
for update
to authenticated
using (
  exists (
    select 1
    from public.propositions pr
    where pr.id = comments.proposition_id
      and pr.author_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.propositions pr
    where pr.id = comments.proposition_id
      and pr.author_id = auth.uid()
  )
);
