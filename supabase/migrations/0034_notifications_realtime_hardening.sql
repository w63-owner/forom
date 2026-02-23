-- Production hardening for live notifications:
-- - page_parent_request in-app notifications from DB trigger
-- - status_change in-app notifications from DB trigger
-- - idempotent insert guard for page_parent_request notifications

CREATE OR REPLACE FUNCTION public.notify_on_page_parent_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_owner_id uuid;
  v_parent_name text;
  v_parent_slug text;
  v_child_name text;
  v_owner_email text;
  v_title text;
  v_body text := 'A sub-page link request was submitted.';
  v_link text;
BEGIN
  -- Only notify for pending requests.
  IF NEW.status::text <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT p.owner_id, COALESCE(p.name, 'Page'), p.slug
  INTO v_parent_owner_id, v_parent_name, v_parent_slug
  FROM public.pages p
  WHERE p.id = NEW.parent_page_id;

  IF v_parent_owner_id IS NULL OR v_parent_slug IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't notify the same user who initiated the request.
  IF NEW.requested_by = v_parent_owner_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.name, 'Page')
  INTO v_child_name
  FROM public.pages c
  WHERE c.id = NEW.child_page_id;

  SELECT u.email
  INTO v_owner_email
  FROM public.users u
  WHERE u.id = v_parent_owner_id;

  IF v_owner_email IS NULL OR btrim(v_owner_email) = '' THEN
    RETURN NEW;
  END IF;

  v_title := 'New sub-page request: ' || v_child_name;
  v_link := '/pages/' || v_parent_slug || '?parent_request_id=' || NEW.id::text;

  INSERT INTO public.notifications (email, type, title, body, link)
  SELECT
    v_owner_email,
    'page_parent_request',
    v_title,
    v_body,
    v_link
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.email = v_owner_email
      AND n.type = 'page_parent_request'
      AND n.link = v_link
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS page_parent_requests_notify_insert ON public.page_parent_requests;
CREATE TRIGGER page_parent_requests_notify_insert
AFTER INSERT ON public.page_parent_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_page_parent_request_insert();

CREATE OR REPLACE FUNCTION public.notify_on_proposition_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text := COALESCE(NEW.title, 'Proposition');
  v_body text := 'Proposition status changed.';
  v_link text := '/propositions/' || NEW.id::text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- status_done has a dedicated trigger with custom recipients/messages.
  IF COALESCE(NEW.status::text, '') = 'Done' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (email, type, title, body, link)
  SELECT
    u.email,
    'status_change',
    v_title,
    v_body,
    v_link
  FROM public.proposition_subscriptions ps
  JOIN public.users u ON u.id = ps.user_id
  WHERE ps.proposition_id = NEW.id
    AND u.email IS NOT NULL
    AND btrim(u.email) <> '';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propositions_notify_status_change ON public.propositions;
CREATE TRIGGER propositions_notify_status_change
AFTER UPDATE OF status ON public.propositions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_proposition_status_change();
