-- Fix status notification trigger for installations where propositions.status
-- is text (or any non-enum-compatible type) to avoid type operator errors.
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

  IF COALESCE(NEW.status::text, '') <> 'Done' THEN
    RETURN NEW;
  END IF;

  -- Only notify for page-linked propositions.
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
