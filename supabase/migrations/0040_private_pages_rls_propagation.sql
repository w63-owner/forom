create or replace function public.can_read_page(_page_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pages p
    where p.id = _page_id
      and (
        p.visibility = 'public'
        or p.owner_id = auth.uid()
        or exists (
          select 1
          from public.page_members pm
          where pm.page_id = p.id
            and pm.user_id = auth.uid()
        )
      )
  );
$$;

grant execute on function public.can_read_page(uuid) to anon, authenticated;

drop policy if exists "public read pages" on public.pages;
drop policy if exists "read pages by visibility_or_membership" on public.pages;
create policy "read pages by visibility_or_membership"
on public.pages
for select
to public
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or exists (
    select 1
    from public.page_members pm
    where pm.page_id = pages.id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "public read propositions" on public.propositions;
drop policy if exists "read propositions if page readable_or_orphan" on public.propositions;
create policy "read propositions if page readable_or_orphan"
on public.propositions
for select
to public
using (
  page_id is null
  or public.can_read_page(page_id)
);

drop policy if exists "public read comments" on public.comments;
drop policy if exists "read comments if proposition page readable" on public.comments;
create policy "read comments if proposition page readable"
on public.comments
for select
to public
using (
  exists (
    select 1
    from public.propositions p
    where p.id = comments.proposition_id
      and (
        p.page_id is null
        or public.can_read_page(p.page_id)
      )
  )
);

drop policy if exists "public read votes" on public.votes;
drop policy if exists "read votes if proposition page readable" on public.votes;
create policy "read votes if proposition page readable"
on public.votes
for select
to public
using (
  exists (
    select 1
    from public.propositions p
    where p.id = votes.proposition_id
      and (
        p.page_id is null
        or public.can_read_page(p.page_id)
      )
  )
);

drop policy if exists "public read volunteers" on public.volunteers;
drop policy if exists "read volunteers if proposition page readable" on public.volunteers;
create policy "read volunteers if proposition page readable"
on public.volunteers
for select
to public
using (
  exists (
    select 1
    from public.propositions p
    where p.id = volunteers.proposition_id
      and (
        p.page_id is null
        or public.can_read_page(p.page_id)
      )
  )
);

drop policy if exists "public read comment votes" on public.comment_votes;
drop policy if exists "read comment votes if comment proposition page readable" on public.comment_votes;
create policy "read comment votes if comment proposition page readable"
on public.comment_votes
for select
to public
using (
  exists (
    select 1
    from public.comments c
    join public.propositions p on p.id = c.proposition_id
    where c.id = comment_votes.comment_id
      and (
        p.page_id is null
        or public.can_read_page(p.page_id)
      )
  )
);

drop policy if exists "read page subscriptions when page readable" on public.page_subscriptions;
create policy "read page subscriptions when page readable"
on public.page_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  and public.can_read_page(page_id)
);

drop policy if exists "users manage page subscriptions" on public.page_subscriptions;
create policy "users insert page subscriptions when page readable"
on public.page_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_read_page(page_id)
);

create policy "users delete page subscriptions when page readable"
on public.page_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.can_read_page(page_id)
);

drop policy if exists "owners manage page members" on public.page_members;
create policy "owners manage page members"
on public.page_members
for all
to authenticated
using (
  exists (
    select 1
    from public.pages p
    where p.id = page_members.page_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pages p
    where p.id = page_members.page_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "users can read own page memberships" on public.page_members;
create policy "users can read own page memberships"
on public.page_members
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists "owners manage page invitations" on public.page_invitations;
create policy "owners manage page invitations"
on public.page_invitations
for all
to authenticated
using (
  exists (
    select 1
    from public.pages p
    where p.id = page_invitations.page_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.pages p
    where p.id = page_invitations.page_id
      and p.owner_id = auth.uid()
  )
);

