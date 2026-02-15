-- Enum for classifying propositions by universe (Discover section)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'universe_type') then
    create type public.universe_type as enum (
      'PUBLIC_SERVICES',
      'TECH_PRODUCTS',
      'CONSUMPTION',
      'LOCAL_LIFE'
    );
  end if;
end
$$;

alter table public.propositions
  add column if not exists universe universe_type,
  add column if not exists category text,
  add column if not exists sub_category text;

create index if not exists propositions_universe_idx on public.propositions (universe);
create index if not exists propositions_category_idx on public.propositions (category) where category is not null;

comment on column public.propositions.universe is 'Universe for Discover: PUBLIC_SERVICES (Services Publics), TECH_PRODUCTS (Produits Tech), CONSUMPTION (Consommation), LOCAL_LIFE (Vie Locale)';
comment on column public.propositions.category is 'Category label e.g. Transports';
comment on column public.propositions.sub_category is 'Sub-category e.g. Mobilité douce';