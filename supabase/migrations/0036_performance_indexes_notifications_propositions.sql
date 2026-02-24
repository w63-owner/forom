-- Performance indexes for high-volume workloads (1M+ rows)
-- Focus: notifications reads, proposition listings, discover filters, text search.

-- Needed to speed up ILIKE on text columns.
create extension if not exists pg_trgm;

-- notifications: align with RLS lower(email) predicate + newest-first reads
create index if not exists notifications_lower_email_created_at_idx
  on public.notifications (lower(email), created_at desc);

-- notifications: optimize unread feeds
create index if not exists notifications_email_unread_created_at_idx
  on public.notifications (email, created_at desc)
  where read_at is null;

-- propositions: page view (top by votes)
create index if not exists propositions_page_status_votes_idx
  on public.propositions (page_id, status, votes_count desc)
  where page_id is not null;

-- propositions: page view (recent)
create index if not exists propositions_page_status_created_idx
  on public.propositions (page_id, status, created_at desc)
  where page_id is not null;

-- propositions: global explore sorting by status + votes/recent
create index if not exists propositions_status_votes_idx
  on public.propositions (status, votes_count desc);

create index if not exists propositions_status_created_idx
  on public.propositions (status, created_at desc);

-- propositions: discover filters (universe/category/sub_category)
create index if not exists propositions_discover_vote_idx
  on public.propositions (universe, category, sub_category, votes_count desc)
  where universe is not null;

create index if not exists propositions_discover_recent_idx
  on public.propositions (universe, category, sub_category, created_at desc)
  where universe is not null;

-- propositions: profile/author feeds
create index if not exists propositions_author_created_idx
  on public.propositions (author_id, created_at desc)
  where author_id is not null;

-- pages: parent listing and text search
create index if not exists pages_parent_name_idx
  on public.pages (parent_page_id, name);

create index if not exists pages_name_trgm_idx
  on public.pages using gin (name gin_trgm_ops);

-- propositions text search (omnibar/title/description)
create index if not exists propositions_title_trgm_idx
  on public.propositions using gin (title gin_trgm_ops);

create index if not exists propositions_description_trgm_idx
  on public.propositions using gin (description gin_trgm_ops);
