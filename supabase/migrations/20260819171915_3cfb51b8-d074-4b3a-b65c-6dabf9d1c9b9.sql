-- 1) profiles: hide banned/moderation rows from public row-level reads
DROP POLICY IF EXISTS "profiles are public read" ON public.profiles;
CREATE POLICY "profiles are public read"
ON public.profiles FOR SELECT
TO anon, authenticated
USING (
  banned_at IS NULL
  OR auth.uid() = id
  OR private.has_role(auth.uid(), 'moderator'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
);

-- keep moderation/behaviour columns off the public grant surface
REVOKE SELECT (banned_at, messages_sent_count, favourites_count, first_listing_at, first_message_at, onboarding_intent, onboarding_categories)
  ON public.profiles FROM anon, authenticated;

-- 2) search_events: cap anonymous insert volume
CREATE OR REPLACE FUNCTION public.enforce_search_event_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recent_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    SELECT count(*) INTO recent_count
    FROM public.search_events
    WHERE user_id IS NULL
      AND created_at > now() - interval '1 minute';
    IF recent_count >= 200 THEN
      RAISE EXCEPTION 'Search logging rate limit exceeded';
    END IF;
    NEW.user_id := NULL;
  ELSE
    SELECT count(*) INTO recent_count
    FROM public.search_events
    WHERE user_id = auth.uid()
      AND created_at > now() - interval '1 minute';
    IF recent_count >= 60 THEN
      RAISE EXCEPTION 'Search logging rate limit exceeded';
    END IF;
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_search_event_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS search_events_rate_limit ON public.search_events;
CREATE TRIGGER search_events_rate_limit
BEFORE INSERT ON public.search_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_search_event_rate_limit();

-- 3) seller_prospect_contacts: make the public-contact flag trustworthy
ALTER TABLE public.seller_prospect_contacts
  ALTER COLUMN is_public_business_contact SET DEFAULT false;
UPDATE public.seller_prospect_contacts SET is_public_business_contact = false WHERE is_public_business_contact IS NULL;
ALTER TABLE public.seller_prospect_contacts
  ALTER COLUMN is_public_business_contact SET NOT NULL;

REVOKE ALL ON public.seller_prospect_contacts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_prospect_contacts TO authenticated;
GRANT ALL ON public.seller_prospect_contacts TO service_role;