-- Migration 0037: comments reliability hardening
-- - Atomic solution toggle RPC
-- - Performance indexes for comments/comment_votes
-- - Enforce single solution per proposition at DB level

CREATE OR REPLACE FUNCTION public.set_comment_solution_atomic(
  p_proposition_id uuid,
  p_comment_id uuid,
  p_next_value boolean,
  p_actor_user_id uuid
)
RETURNS TABLE(ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_comment_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_user_id THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT author_id INTO v_author_id
  FROM public.propositions
  WHERE id = p_proposition_id;

  IF v_author_id IS NULL OR v_author_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.comments
    WHERE id = p_comment_id
      AND proposition_id = p_proposition_id
  ) INTO v_comment_exists;

  IF NOT v_comment_exists THEN
    RAISE EXCEPTION 'Comment/proposition mismatch'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_next_value THEN
    UPDATE public.comments
    SET is_solution = (id = p_comment_id)
    WHERE proposition_id = p_proposition_id;
  ELSE
    UPDATE public.comments
    SET is_solution = false
    WHERE id = p_comment_id
      AND proposition_id = p_proposition_id;
  END IF;

  RETURN QUERY SELECT true;
END;
$$;

COMMENT ON FUNCTION public.set_comment_solution_atomic(uuid, uuid, boolean, uuid) IS
  'Atomically marks/unmarks proposition comment solution with authorization guard.';

GRANT EXECUTE ON FUNCTION public.set_comment_solution_atomic(uuid, uuid, boolean, uuid) TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS comments_one_solution_per_proposition_idx
ON public.comments (proposition_id)
WHERE is_solution = true;

CREATE INDEX IF NOT EXISTS comments_proposition_created_desc_idx
ON public.comments (proposition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS comment_votes_comment_user_idx
ON public.comment_votes (comment_id, user_id);

CREATE INDEX IF NOT EXISTS comments_user_created_desc_idx
ON public.comments (user_id, created_at DESC);
