-- Extend translations cache to support the pages table

-- 1. Extend source_table check constraint to include pages
ALTER TABLE public.translations
  DROP CONSTRAINT IF EXISTS translations_source_table_check;

ALTER TABLE public.translations
  ADD CONSTRAINT translations_source_table_check
    CHECK (source_table IN ('propositions', 'comments', 'pages'));

-- 2. Invalidate cached translations when a page description is updated
CREATE OR REPLACE FUNCTION public.invalidate_page_translations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    DELETE FROM public.translations
    WHERE source_table = 'pages'
      AND source_id = OLD.id
      AND source_field = 'description';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invalidate_page_translations
  AFTER UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_page_translations();

-- 3. Cleanup orphan translations when a page is deleted
CREATE OR REPLACE FUNCTION public.cleanup_page_translations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.translations
  WHERE source_table = 'pages' AND source_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_page_translations
  AFTER DELETE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_page_translations();
