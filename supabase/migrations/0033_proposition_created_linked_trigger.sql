-- Robust DB-side notification for proposition creation on linked pages.
-- This removes reliance on client-side fire-and-forget requests.

-- Deduplicate retries/replays only for proposition_created_linked.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_linked_unique
  ON public.notifications (email, link)
  WHERE type = 'proposition_created_linked';

CREATE OR REPLACE FUNCTION public.notify_on_proposition_insert_linked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_owner_id uuid;
  v_page_name text;
  v_owner_email text;
  v_title text := COALESCE(NEW.title, 'Proposition');
  v_link text := '/propositions/' || NEW.id::text;
BEGIN
  -- Only linked propositions can notify a page owner.
  IF NEW.page_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.owner_id, COALESCE(p.name, 'Page')
  INTO v_page_owner_id, v_page_name
  FROM public.pages p
  WHERE p.id = NEW.page_id;

  IF v_page_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Do not notify when the page owner created the proposition.
  IF NEW.author_id IS NOT NULL AND NEW.author_id = v_page_owner_id THEN
    RETURN NEW;
  END IF;

  SELECT u.email
  INTO v_owner_email
  FROM public.users u
  WHERE u.id = v_page_owner_id;

  IF v_owner_email IS NULL OR btrim(v_owner_email) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (email, type, title, body, link)
  VALUES (
    v_owner_email,
    'proposition_created_linked',
    v_page_name,
    'A new proposition has been added.',
    v_link
  )
  ON CONFLICT (email, link) WHERE type = 'proposition_created_linked' DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propositions_notify_insert_linked ON public.propositions;
CREATE TRIGGER propositions_notify_insert_linked
AFTER INSERT ON public.propositions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_proposition_insert_linked();
