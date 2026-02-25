-- Improve slug generation to handle Unicode-only names
-- When all non-ASCII chars are stripped, the slug becomes empty.
-- This version appends a short unique suffix as fallback.
CREATE OR REPLACE FUNCTION public.slugify_page_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.slug IS NULL OR new.slug = '' THEN
    new.slug := lower(regexp_replace(new.name, '[^a-zA-Z0-9]+', '-', 'g'));
    new.slug := trim(both '-' from new.slug);

    IF new.slug IS NULL OR new.slug = '' THEN
      new.slug := 'page-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    END IF;
  END IF;
  RETURN new;
END;
$$;
