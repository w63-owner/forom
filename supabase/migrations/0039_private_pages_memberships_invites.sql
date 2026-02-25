create table if not exists public.page_members (
  page_id uuid not null references public.pages (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('admin', 'viewer')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);

create index if not exists page_members_user_idx
on public.page_members (user_id);

create index if not exists page_members_page_role_idx
on public.page_members (page_id, role);

create table if not exists public.page_invitations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  created_by uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer,
  used_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  check (max_uses is null or max_uses > 0),
  check (used_count >= 0)
);

create index if not exists page_invitations_page_idx
on public.page_invitations (page_id);

create index if not exists page_invitations_expires_idx
on public.page_invitations (expires_at);

create index if not exists page_invitations_active_idx
on public.page_invitations (page_id, expires_at)
where revoked_at is null;

alter table public.page_members enable row level security;
alter table public.page_invitations enable row level security;
