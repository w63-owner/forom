-- Migration 0030: Database-driven notifications via triggers
-- Source of truth for in-app notifications now lives in Postgres.

-- ============================================================================
-- 1) Comment created -> notify proposition author (when enabled)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_comment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_notify_comments boolean;
  v_proposition_title text;
  v_author_email text;
BEGIN
  SELECT p.author_id, p.notify_comments, COALESCE(p.title, 'Proposition')
  INTO v_author_id, v_notify_comments, v_proposition_title
  FROM public.propositions p
  WHERE p.id = NEW.proposition_id;

  IF NOT COALESCE(v_notify_comments, false) THEN
    RETURN NEW;
  END IF;

  -- Do not notify when author comments on their own proposition.
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT u.email
  INTO v_author_email
  FROM public.users u
  WHERE u.id = v_author_id;

  IF v_author_email IS NULL OR btrim(v_author_email) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (email, type, title, body, link)
  VALUES (
    v_author_email,
    'comment_created',
    v_proposition_title,
    'A new comment was posted for your proposition.',
    '/propositions/' || NEW.proposition_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_notify_insert ON public.comments;
CREATE TRIGGER comments_notify_insert
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment_insert();

-- ============================================================================
-- 2) Volunteer created -> notify proposition author (when enabled)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_volunteer_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_notify_volunteers boolean;
  v_proposition_title text;
  v_author_email text;
BEGIN
  SELECT p.author_id, p.notify_volunteers, COALESCE(p.title, 'Proposition')
  INTO v_author_id, v_notify_volunteers, v_proposition_title
  FROM public.propositions p
  WHERE p.id = NEW.proposition_id;

  IF NOT COALESCE(v_notify_volunteers, false) THEN
    RETURN NEW;
  END IF;

  IF v_author_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.email
  INTO v_author_email
  FROM public.users u
  WHERE u.id = v_author_id;

  IF v_author_email IS NULL OR btrim(v_author_email) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (email, type, title, body, link)
  VALUES (
    v_author_email,
    'volunteer_created',
    v_proposition_title,
    'A new volunteer joined your proposition.',
    '/propositions/' || NEW.proposition_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS volunteers_notify_insert ON public.volunteers;
CREATE TRIGGER volunteers_notify_insert
AFTER INSERT ON public.volunteers
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_volunteer_insert();

-- ============================================================================
-- 3) Proposition status changed to Done -> notify author + page subscribers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_proposition_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_email text;
  v_page_owner_id uuid;
  v_page_name text;
  v_proposition_title text := COALESCE(NEW.title, 'Proposition');
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'Done'::public.proposition_status THEN
    RETURN NEW;
  END IF;

  -- Mirrors route.ts behavior for status_done: only page-linked propositions.
  IF NEW.page_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.owner_id, p.name
  INTO v_page_owner_id, v_page_name
  FROM public.pages p
  WHERE p.id = NEW.page_id;

  -- Notify proposition author when page owner is different.
  IF NEW.author_id IS NOT NULL
     AND v_page_owner_id IS NOT NULL
     AND v_page_owner_id <> NEW.author_id THEN
    SELECT u.email
    INTO v_author_email
    FROM public.users u
    WHERE u.id = NEW.author_id;

    IF v_author_email IS NOT NULL AND btrim(v_author_email) <> '' THEN
      INSERT INTO public.notifications (email, type, title, body, link)
      VALUES (
        v_author_email,
        'status_done',
        v_proposition_title,
        'Your proposition status changed to Done.',
        '/propositions/' || NEW.id::text
      );
    END IF;
  END IF;

  -- Notify page subscribers.
  INSERT INTO public.notifications (email, type, title, body, link)
  SELECT
    u.email,
    'status_done',
    COALESCE(v_page_name, v_proposition_title),
    'A proposition linked to this page was marked as done.',
    '/propositions/' || NEW.id::text
  FROM public.page_subscriptions ps
  JOIN public.users u ON u.id = ps.user_id
  WHERE ps.page_id = NEW.page_id
    AND u.email IS NOT NULL
    AND btrim(u.email) <> '';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propositions_notify_status_update ON public.propositions;
CREATE TRIGGER propositions_notify_status_update
AFTER UPDATE OF status ON public.propositions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_proposition_status_update();

-- ============================================================================
-- 4) Comment solution toggled -> notify comment author (when enabled)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_comment_solution_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notify_solutions boolean;
  v_commenter_email text;
  v_proposition_title text;
  v_type text;
  v_body text;
BEGIN
  IF OLD.is_solution IS NOT DISTINCT FROM NEW.is_solution THEN
    RETURN NEW;
  END IF;

  SELECT p.notify_solutions, COALESCE(p.title, 'Proposition')
  INTO v_notify_solutions, v_proposition_title
  FROM public.propositions p
  WHERE p.id = NEW.proposition_id;

  IF NOT COALESCE(v_notify_solutions, false) THEN
    RETURN NEW;
  END IF;

  SELECT u.email
  INTO v_commenter_email
  FROM public.users u
  WHERE u.id = NEW.user_id;

  IF v_commenter_email IS NULL OR btrim(v_commenter_email) = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_solution THEN
    v_type := 'solution_marked';
    v_body := 'Your comment was marked as a solution.';
  ELSE
    v_type := 'solution_unmarked';
    v_body := 'Your comment is no longer marked as a solution.';
  END IF;

  INSERT INTO public.notifications (email, type, title, body, link)
  VALUES (
    v_commenter_email,
    v_type,
    v_proposition_title,
    v_body,
    '/propositions/' || NEW.proposition_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_notify_solution_update ON public.comments;
CREATE TRIGGER comments_notify_solution_update
AFTER UPDATE OF is_solution ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment_solution_update();
