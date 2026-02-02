create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposition_status') then
    create type public.proposition_status as enum ('Open', 'Done', 'Won''t Do', 'In Progress');
  end if;
  if not exists (select 1 from pg_type where typname = 'vote_type') then
    create type public.vote_type as enum ('Upvote', 'Downvote');
  end if;
  if not exists (select 1 from pg_type where typname = 'volunteer_status') then
    create type public.volunteer_status as enum ('Pending', 'Accepted');
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text,
  avatar_url text,
  level integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  is_verified boolean not null default false,
  reactivity_score numeric,
  website_url text,
  created_at timestamptz not null default now(),
  unique (slug)
);

create table if not exists public.propositions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users (id) on delete set null,
  page_id uuid references public.pages (id) on delete set null,
  title text not null,
  description text,
  status public.proposition_status not null default 'Open',
  labels_location text,
  labels_category text,
  completion_proof text,
  votes_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  user_id uuid not null references public.users (id) on delete cascade,
  proposition_id uuid not null references public.propositions (id) on delete cascade,
  type public.vote_type not null,
  created_at timestamptz not null default now(),
  primary key (user_id, proposition_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  proposition_id uuid not null references public.propositions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  content text not null,
  is_solution boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.volunteers (
  user_id uuid not null references public.users (id) on delete cascade,
  proposition_id uuid not null references public.propositions (id) on delete cascade,
  skills_offered text,
  status public.volunteer_status not null default 'Pending',
  created_at timestamptz not null default now(),
  primary key (user_id, proposition_id)
);

create index if not exists propositions_title_idx on public.propositions using gin (to_tsvector('simple', title));
create index if not exists propositions_page_idx on public.propositions (page_id);
create index if not exists votes_proposition_idx on public.votes (proposition_id);
create index if not exists comments_proposition_idx on public.comments (proposition_id);

create or replace function public.update_votes_count()
returns trigger
language plpgsql
as $$
begin
  update public.propositions p
  set votes_count = (
    select coalesce(
      sum(
        case
          when v.type = 'Upvote' then 1
          when v.type = 'Downvote' then -1
          else 0
        end
      ),
      0
    )
    from public.votes v
    where v.proposition_id = p.id
  )
  where p.id = coalesce(new.proposition_id, old.proposition_id);

  return null;
end;
$$;

drop trigger if exists votes_count_trigger on public.votes;
create trigger votes_count_trigger
after insert or update or delete on public.votes
for each row execute function public.update_votes_count();

alter table public.users enable row level security;
alter table public.pages enable row level security;
alter table public.propositions enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.volunteers enable row level security;

drop policy if exists "public read users" on public.users;
create policy "public read users"
on public.users
for select
to public
using (true);

drop policy if exists "users manage self" on public.users;
create policy "users manage self"
on public.users
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "public read pages" on public.pages;
create policy "public read pages"
on public.pages
for select
to public
using (true);

drop policy if exists "owners manage pages" on public.pages;
create policy "owners manage pages"
on public.pages
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "public read propositions" on public.propositions;
create policy "public read propositions"
on public.propositions
for select
to public
using (true);

drop policy if exists "authors manage propositions" on public.propositions;
create policy "authors manage propositions"
on public.propositions
for all
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "public read votes" on public.votes;
create policy "public read votes"
on public.votes
for select
to public
using (true);

drop policy if exists "users manage votes" on public.votes;
create policy "users manage votes"
on public.votes
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "public read comments" on public.comments;
create policy "public read comments"
on public.comments
for select
to public
using (true);

drop policy if exists "users manage comments" on public.comments;
create policy "users manage comments"
on public.comments
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "public read volunteers" on public.volunteers;
create policy "public read volunteers"
on public.volunteers
for select
to public
using (true);

drop policy if exists "users manage volunteers" on public.volunteers;
create policy "users manage volunteers"
on public.volunteers
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
