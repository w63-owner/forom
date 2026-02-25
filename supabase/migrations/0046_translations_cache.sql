-- Translation cache for on-demand user content translation (DeepL)

CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL CHECK (source_table IN ('propositions', 'comments')),
  source_id UUID NOT NULL,
  source_field TEXT NOT NULL CHECK (source_field IN ('title', 'description', 'content')),
  source_lang TEXT NOT NULL CHECK (source_lang IN ('fr', 'en')),
  target_lang TEXT NOT NULL CHECK (target_lang IN ('fr', 'en')),
  translated_text TEXT NOT NULL,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_translation_lookup
    UNIQUE (source_table, source_id, source_field, target_lang)
);

CREATE INDEX idx_translations_lookup
  ON public.translations (source_table, source_id, target_lang);

-- RLS: read-only for authenticated users, writes go through service_role in the API route
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read translations"
  ON public.translations FOR SELECT
  TO authenticated
  USING (true);

-- Invalidate cached translations when a proposition's title or description changes
CREATE OR REPLACE FUNCTION public.invalidate_proposition_translations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title
     OR OLD.description IS DISTINCT FROM NEW.description THEN
    DELETE FROM public.translations
    WHERE source_table = 'propositions' AND source_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invalidate_proposition_translations
  AFTER UPDATE ON public.propositions
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_proposition_translations();

-- Invalidate cached translations when a comment's content changes
CREATE OR REPLACE FUNCTION public.invalidate_comment_translations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    DELETE FROM public.translations
    WHERE source_table = 'comments' AND source_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invalidate_comment_translations
  AFTER UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_comment_translations();

-- Clean up translations when source content is deleted
CREATE OR REPLACE FUNCTION public.cleanup_orphan_translations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.translations
  WHERE source_table = TG_TABLE_NAME AND source_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_proposition_translations
  AFTER DELETE ON public.propositions
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphan_translations();

CREATE TRIGGER trg_cleanup_comment_translations
  AFTER DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphan_translations();
