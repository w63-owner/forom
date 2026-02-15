-- Single-query function to get proposition counts per universe (Discover page).
-- Replaces 12 separate count queries for better performance and robustness.

create or replace function public.get_proposition_counts_by_universe()
returns table(universe text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.universe::text, count(*)::bigint
  from public.propositions p
  where p.universe is not null
  group by p.universe
$$;

grant execute on function public.get_proposition_counts_by_universe() to anon;
grant execute on function public.get_proposition_counts_by_universe() to authenticated;