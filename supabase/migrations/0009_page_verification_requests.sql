create table if not exists public.page_verification_requests (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  requested_by uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending',
  method text not null,
  proof text,
  requester_note text,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now()
);

create index if not exists page_verification_requests_page_idx
  on public.page_verification_requests (page_id, created_at desc);

alter table public.page_verification_requests enable row level security;

drop policy if exists "owners request verification" on public.page_verification_requests;
create policy "owners request verification"
on public.page_verification_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
  and exists (
    select 1 from public.pages
    where pages.id = page_verification_requests.page_id
      and pages.owner_id = auth.uid()
  )
);

drop policy if exists "owners read verification requests" on public.page_verification_requests;
create policy "owners read verification requests"
on public.page_verification_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.pages
    where pages.id = page_verification_requests.page_id
      and pages.owner_id = auth.uid()
  )
);
