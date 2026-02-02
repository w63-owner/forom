create or replace function public.slugify_page_name()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := lower(regexp_replace(new.name, '[^a-zA-Z0-9]+', '-', 'g'));
    new.slug := trim(both '-' from new.slug);
  end if;
  return new;
end;
$$;

drop trigger if exists pages_slug_trigger on public.pages;
create trigger pages_slug_trigger
before insert or update on public.pages
for each row execute function public.slugify_page_name();
