-- Table de référence des catégories Discover (univers/catégorie/sous-catégorie)
-- Clé unique : (universe, category, sub_category)
-- Les valeurs universe doivent correspondre strictement à l'ENUM universe_type (majuscules)

create table if not exists public.discover_categories (
  id uuid primary key default gen_random_uuid(),
  universe public.universe_type not null,
  category text not null,
  sub_category text not null default '',
  unique (universe, category, sub_category)
);

create index if not exists discover_categories_universe_idx on public.discover_categories (universe);
create index if not exists discover_categories_category_idx on public.discover_categories (category);
comment on table public.discover_categories is 'Reference table for Discover section: valid (universe, category, sub_category) triples. universe must match universe_type ENUM exactly.';

-- Index Full-Text Search sur propositions pour recherche ultra-rapide sur category et sub_category
create index if not exists propositions_category_subcategory_fts_idx
  on public.propositions
  using gin (
    to_tsvector('french', coalesce(category, '') || ' ' || coalesce(sub_category, ''))
  );

comment on index public.propositions_category_subcategory_fts_idx is 'Full-Text Search index for Discover category/sub_category search bar';