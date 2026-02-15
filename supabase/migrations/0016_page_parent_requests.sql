do $$
begin
  if not exists (select 1 from pg_type where typname = 'page_parent_status') then
    create type public.page_parent_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

alter table public.pages
add column if not exists parent_page_id uuid references public.pages (id) on delete set null;

create table if not exists public.page_parent_requests (
  id uuid primary key default gen_random_uuid(),
  child_page_id uuid not null references public.pages (id) on delete cascade,
  parent_page_id uuid not null references public.pages (id) on delete cascade,
  requested_by uuid not null references public.users (id) on delete cascade,
  status public.page_parent_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users (id) on delete set null
);

create unique index if not exists page_parent_requests_child_unique
on public.page_parent_requests (child_page_id);

create index if not exists page_parent_requests_parent_idx
on public.page_parent_requests (parent_page_id);

create or replace function public.page_parent_requests_auto_approve()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.pages p
    where p.id = new.parent_page_id
      and p.owner_id = new.requested_by
  ) then
    new.status := 'approved';
    new.reviewed_at := now();
    new.reviewed_by := new.requested_by;
  end if;
  return new;
end;
$$;

drop trigger if exists page_parent_requests_auto_approve on public.page_parent_requests;
create trigger page_parent_requests_auto_approve
before insert on public.page_parent_requests
for each row execute function public.page_parent_requests_auto_approve();

create or replace function public.apply_page_parent_request()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' then
    update public.pages
    set parent_page_id = new.parent_page_id
    where id = new.child_page_id;
  elsif new.status = 'rejected' then
    update public.pages
    set parent_page_id = null
    where id = new.child_page_id
      and parent_page_id = new.parent_page_id;
  end if;
  return new;
end;
$$;

drop trigger if exists page_parent_requests_apply on public.page_parent_requests;
create trigger page_parent_requests_apply
after insert or update on public.page_parent_requests
for each row execute function public.apply_page_parent_request();

alter table public.page_parent_requests enable row level security;

drop policy if exists "public read page parent requests" on public.page_parent_requests;
create policy "public read page parent requests"
on public.page_parent_requests
for select
to public
using (true);

drop policy if exists "owners create page parent requests" on public.page_parent_requests;
create policy "owners create page parent requests"
on public.page_parent_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.pages child
    where child.id = child_page_id
      and child.owner_id = auth.uid()
  )
);

drop policy if exists "parent owners review page parent requests" on public.page_parent_requests;
create policy "parent owners review page parent requests"
on public.page_parent_requests
for update
to authenticated
using (
  exists (
    select 1 from public.pages parent
    where parent.id = parent_page_id
      and parent.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.pages parent
    where parent.id = parent_page_id
      and parent.owner_id = auth.uid()
  )
);