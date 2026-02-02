alter table public.pages
add column if not exists category text;

alter table public.pages
add column if not exists certification_type text not null default 'NONE';
