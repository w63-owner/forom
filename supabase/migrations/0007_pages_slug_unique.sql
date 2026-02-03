alter table public.pages
add constraint pages_slug_unique unique (slug);
