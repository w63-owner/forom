-- Réponses aux commentaires (fil à la YouTube)
alter table public.comments
add column if not exists parent_id uuid references public.comments (id) on delete cascade;

create index if not exists comments_parent_idx on public.comments (parent_id);

-- Votes sur les commentaires (upvote/downvote)
create table if not exists public.comment_votes (
  user_id uuid not null references public.users (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  type text not null check (type in ('Upvote', 'Downvote')),
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index if not exists comment_votes_comment_idx on public.comment_votes (comment_id);

alter table public.comment_votes enable row level security;

drop policy if exists "users manage comment votes" on public.comment_votes;
create policy "users manage comment votes"
on public.comment_votes
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "public read comment votes" on public.comment_votes;
create policy "public read comment votes"
on public.comment_votes
for select
to public
using (true);
