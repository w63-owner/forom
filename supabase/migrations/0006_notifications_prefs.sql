alter table public.propositions
add column if not exists notify_comments boolean not null default true;

alter table public.propositions
add column if not exists notify_volunteers boolean not null default true;

alter table public.propositions
add column if not exists notify_solutions boolean not null default true;

alter table public.pages
add column if not exists owner_notify_daily boolean not null default false;

alter table public.pages
add column if not exists owner_vote_threshold integer;
