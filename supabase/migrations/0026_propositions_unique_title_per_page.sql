-- Prevent duplicate propositions: same title + same page.
-- Uniqueness is case-insensitive and ignores leading/trailing whitespace.
-- NULL page_id is treated as a single "no page" group.

create unique index propositions_unique_title_per_page
  on public.propositions (
    coalesce(page_id::text, ''),
    lower(trim(title))
  );

comment on index public.propositions_unique_title_per_page is
  'Ensures at most one proposition per (page_id, title) pair. Same title on same page = duplicate.';