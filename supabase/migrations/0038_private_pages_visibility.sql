alter table public.pages
add column if not exists visibility text not null default 'public'
check (visibility in ('public', 'private'));

create index if not exists pages_visibility_idx
on public.pages (visibility);

create index if not exists pages_owner_visibility_idx
on public.pages (owner_id, visibility);
