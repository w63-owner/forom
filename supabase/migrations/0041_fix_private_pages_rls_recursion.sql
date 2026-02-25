create or replace function public.is_page_owner(_page_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pages p
    where p.id = _page_id
      and p.owner_id = _user_id
  );
$$;

create or replace function public.is_page_member(_page_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.page_members pm
    where pm.page_id = _page_id
      and pm.user_id = _user_id
  );
$$;

create or replace function public.can_read_page(_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pages p
    where p.id = _page_id
      and (
        p.visibility = 'public'
        or p.owner_id = auth.uid()
        or public.is_page_member(p.id, auth.uid())
      )
  );
$$;

grant execute on function public.is_page_owner(uuid, uuid) to anon, authenticated;
grant execute on function public.is_page_member(uuid, uuid) to anon, authenticated;
grant execute on function public.can_read_page(uuid) to anon, authenticated;

drop policy if exists "read pages by visibility_or_membership" on public.pages;
create policy "read pages by visibility_or_membership"
on public.pages
for select
to public
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or public.is_page_member(id, auth.uid())
);

drop policy if exists "owners manage page members" on public.page_members;
create policy "owners manage page members"
on public.page_members
for all
to authenticated
using (public.is_page_owner(page_id, auth.uid()))
with check (public.is_page_owner(page_id, auth.uid()));

drop policy if exists "owners manage page invitations" on public.page_invitations;
create policy "owners manage page invitations"
on public.page_invitations
for all
to authenticated
using (public.is_page_owner(page_id, auth.uid()))
with check (public.is_page_owner(page_id, auth.uid()));
