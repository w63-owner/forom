-- Onboarding persistence for production-grade auth flow.
-- Hybrid gate:
-- - profile step required (onboarding_profile_completed_at)
-- - avatar step skippable (onboarding_completed_at)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_profile_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS users_onboarding_profile_completed_at_idx
  ON public.users (onboarding_profile_completed_at);

CREATE INDEX IF NOT EXISTS users_onboarding_completed_at_idx
  ON public.users (onboarding_completed_at);

-- Backfill existing users so rollout does not unexpectedly gate active accounts.
UPDATE public.users
SET onboarding_profile_completed_at = COALESCE(onboarding_profile_completed_at, NOW())
WHERE username IS NOT NULL
  AND btrim(username) <> '';

UPDATE public.users
SET onboarding_completed_at = COALESCE(onboarding_completed_at, onboarding_profile_completed_at)
WHERE onboarding_profile_completed_at IS NOT NULL;
