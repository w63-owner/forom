-- Migration 0028: Fix security policies on propositions and add validation trigger
-- - Drop permissive policies, create granular INSERT/DELETE/UPDATE
-- - Validation trigger: immutable votes_count, content/status rules
-- - RPC for atomic vote toggle

-- ============================================================================
-- 1. Drop existing permissive policies
-- ============================================================================
DROP POLICY IF EXISTS "authors manage propositions" ON public.propositions;
DROP POLICY IF EXISTS "owners update propositions" ON public.propositions;

-- ============================================================================
-- 2. Create granular RLS policies
-- ============================================================================

-- INSERT: only authenticated users, must set author_id = self
CREATE POLICY "propositions_insert_author_only"
ON public.propositions
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

-- DELETE: only author
CREATE POLICY "propositions_delete_author_only"
ON public.propositions
FOR DELETE
TO authenticated
USING (author_id = auth.uid());

-- UPDATE: Author OR Page Owner (if page_id exists)
CREATE POLICY "propositions_update_author_or_owner"
ON public.propositions
FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = propositions.page_id AND p.owner_id = auth.uid()
    )
  )
)
WITH CHECK (
  author_id = auth.uid()
  OR (
    page_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = propositions.page_id AND p.owner_id = auth.uid()
    )
  )
);

-- ============================================================================
-- 3. Update votes_count function to set session var (for trigger bypass)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_votes_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.allow_votes_count_update', 'true', true);
  UPDATE public.propositions p
  SET votes_count = (
    SELECT COALESCE(
      SUM(
        CASE
          WHEN v.type = 'Upvote' THEN 1
          WHEN v.type = 'Downvote' THEN -1
          ELSE 0
        END
      ),
      0
    )
    FROM public.votes v
    WHERE v.proposition_id = p.id
  )
  WHERE p.id = COALESCE(NEW.proposition_id, OLD.proposition_id);
  PERFORM set_config('app.allow_votes_count_update', 'false', true);
  RETURN NULL;
END;
$$;

-- ============================================================================
-- 4. Validation trigger (BEFORE UPDATE on propositions)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_propositions_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_page_owner_id uuid;
BEGIN
  -- Immutable: votes_count only via vote trigger
  IF OLD.votes_count IS DISTINCT FROM NEW.votes_count THEN
    IF current_setting('app.allow_votes_count_update', true) <> 'true' THEN
      RAISE EXCEPTION 'votes_count cannot be manually modified'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Content integrity: only Author can modify title, description, image_urls
  IF (OLD.title IS DISTINCT FROM NEW.title)
     OR (OLD.description IS DISTINCT FROM NEW.description)
     OR (OLD.image_urls IS DISTINCT FROM NEW.image_urls) THEN
    IF OLD.author_id IS NULL OR OLD.author_id <> auth.uid() THEN
      RAISE EXCEPTION 'Only the author can modify title, description, or images'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Status logic
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.page_id IS NULL THEN
      -- Orphan proposition: only Author can change status
      IF OLD.author_id IS NULL OR OLD.author_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the author can change status for orphan propositions'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      -- Page-linked: only Page Owner can change status (Author cannot)
      SELECT owner_id INTO v_page_owner_id
      FROM public.pages WHERE id = OLD.page_id;
      IF v_page_owner_id IS NULL OR v_page_owner_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the page owner can change status for page-linked propositions'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propositions_validate_update ON public.propositions;
CREATE TRIGGER propositions_validate_update
  BEFORE UPDATE ON public.propositions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_propositions_update();

-- ============================================================================
-- 5. Atomic vote toggle RPC (fixes race condition)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.toggle_proposition_vote(p_proposition_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_type public.vote_type;
  v_has_voted boolean;
  v_votes_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT type INTO v_current_type
  FROM public.votes
  WHERE user_id = v_user_id AND proposition_id = p_proposition_id;

  IF v_current_type = 'Upvote' THEN
    DELETE FROM public.votes
    WHERE user_id = v_user_id AND proposition_id = p_proposition_id;
    v_has_voted := false;
  ELSE
    INSERT INTO public.votes (user_id, proposition_id, type)
    VALUES (v_user_id, p_proposition_id, 'Upvote'::public.vote_type)
    ON CONFLICT (user_id, proposition_id)
    DO UPDATE SET type = 'Upvote'::public.vote_type;
    v_has_voted := true;
  END IF;

  SELECT votes_count INTO v_votes_count
  FROM public.propositions
  WHERE id = p_proposition_id;

  RETURN json_build_object(
    'ok', true,
    'has_voted', v_has_voted,
    'votes', COALESCE(v_votes_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.toggle_proposition_vote(uuid) IS
  'Atomically toggle upvote for the current user. Returns {ok, has_voted, votes}.';
