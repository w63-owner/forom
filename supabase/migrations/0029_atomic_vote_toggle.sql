-- Migration 0029: Atomic vote toggle RPC (toggle_vote)
-- - Single PL/pgSQL function for atomic toggle
-- - Accepts p_proposition_id and p_user_id
-- - Returns { new_vote_count, has_voted }

-- ============================================================================
-- 1. Create toggle_vote function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.toggle_vote(
  p_proposition_id uuid,
  p_user_id uuid
)
RETURNS TABLE(new_vote_count integer, has_voted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_type public.vote_type;
  v_has_voted boolean;
  v_votes_count integer;
BEGIN
  -- Enforce that caller can only vote as themselves
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized'
      USING ERRCODE = 'P0001';
  END IF;

  -- Check if vote exists
  SELECT type INTO v_current_type
  FROM public.votes
  WHERE user_id = p_user_id AND proposition_id = p_proposition_id;

  IF v_current_type = 'Upvote' THEN
    DELETE FROM public.votes
    WHERE user_id = p_user_id AND proposition_id = p_proposition_id;
    v_has_voted := false;
  ELSE
    INSERT INTO public.votes (user_id, proposition_id, type)
    VALUES (p_user_id, p_proposition_id, 'Upvote'::public.vote_type)
    ON CONFLICT (user_id, proposition_id)
    DO UPDATE SET type = 'Upvote'::public.vote_type;
    v_has_voted := true;
  END IF;

  -- Fetch updated count (votes_count trigger updates propositions table)
  SELECT votes_count INTO v_votes_count
  FROM public.propositions
  WHERE id = p_proposition_id;

  RETURN QUERY SELECT
    COALESCE(v_votes_count, 0)::integer,
    v_has_voted;
END;
$$;

COMMENT ON FUNCTION public.toggle_vote(uuid, uuid) IS
  'Atomically toggle upvote for a user. Returns (new_vote_count, has_voted).';
