
CREATE TABLE public.marketing_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_opt_in boolean NOT NULL DEFAULT false,
  sms_opt_in boolean NOT NULL DEFAULT false,
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  whatsapp_number text,
  marketing_email text,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  consented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.marketing_preferences TO authenticated;
GRANT ALL ON public.marketing_preferences TO service_role;

ALTER TABLE public.marketing_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_read" ON public.marketing_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_insert" ON public.marketing_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_update" ON public.marketing_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_read" ON public.marketing_preferences
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'moderator'::app_role));

CREATE TRIGGER trg_marketing_prefs_updated
  BEFORE UPDATE ON public.marketing_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS listings_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favourites_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_listing_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_intent text,
  ADD COLUMN IF NOT EXISTS onboarding_categories text[],
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_intent_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_onboarding_intent_chk
  CHECK (onboarding_intent IS NULL OR onboarding_intent IN ('buyer','seller','both'));

CREATE OR REPLACE FUNCTION public.bump_listings_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET listings_count = COALESCE(listings_count,0) + 1,
         first_listing_at = COALESCE(first_listing_at, NEW.created_at),
         last_active_at = NEW.created_at
   WHERE id = NEW.seller_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_listings ON public.listings;
CREATE TRIGGER trg_bump_listings AFTER INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.bump_listings_counter();

CREATE OR REPLACE FUNCTION public.bump_favourites_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET favourites_count = COALESCE(favourites_count,0) + 1,
         last_active_at = now()
   WHERE id = NEW.user_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_favourites ON public.favourites;
CREATE TRIGGER trg_bump_favourites AFTER INSERT ON public.favourites
  FOR EACH ROW EXECUTE FUNCTION public.bump_favourites_counter();

CREATE OR REPLACE FUNCTION public.bump_messages_counter()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
     SET messages_sent_count = COALESCE(messages_sent_count,0) + 1,
         first_message_at = COALESCE(first_message_at, NEW.created_at),
         last_active_at = NEW.created_at
   WHERE id = NEW.sender_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_messages ON public.messages;
CREATE TRIGGER trg_bump_messages AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_messages_counter();

UPDATE public.profiles p SET
  listings_count = COALESCE((SELECT count(*) FROM public.listings WHERE seller_id = p.id), 0),
  favourites_count = COALESCE((SELECT count(*) FROM public.favourites WHERE user_id = p.id), 0),
  messages_sent_count = COALESCE((SELECT count(*) FROM public.messages WHERE sender_id = p.id), 0),
  first_listing_at = (SELECT min(created_at) FROM public.listings WHERE seller_id = p.id),
  first_message_at = (SELECT min(created_at) FROM public.messages WHERE sender_id = p.id);

CREATE OR REPLACE FUNCTION public.get_user_interest_tags(_user_id uuid)
RETURNS TABLE(top_categories text[], top_parishes text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH cats AS (
    SELECT c.slug AS cat, count(*) AS n
      FROM public.favourites f
      JOIN public.listings l ON l.id = f.listing_id
      JOIN public.categories c ON c.id = l.category_id
     WHERE f.user_id = _user_id GROUP BY c.slug
    UNION ALL
    SELECT c.slug, count(*)
      FROM public.listings l
      JOIN public.categories c ON c.id = l.category_id
     WHERE l.seller_id = _user_id GROUP BY c.slug
    UNION ALL
    SELECT category_slug, count(*) FROM public.search_events
     WHERE user_id = _user_id AND category_slug IS NOT NULL GROUP BY category_slug
  ),
  parishes AS (
    SELECT l.parish::text AS p, count(*) AS n
      FROM public.favourites f
      JOIN public.listings l ON l.id = f.listing_id
     WHERE f.user_id = _user_id AND l.parish IS NOT NULL GROUP BY l.parish
    UNION ALL
    SELECT parish::text, count(*) FROM public.search_events
     WHERE user_id = _user_id AND parish IS NOT NULL GROUP BY parish
  )
  SELECT
    ARRAY(SELECT cat FROM cats GROUP BY cat ORDER BY sum(n) DESC LIMIT 3),
    ARRAY(SELECT p FROM parishes GROUP BY p ORDER BY sum(n) DESC LIMIT 3);
END $$;

GRANT EXECUTE ON FUNCTION public.get_user_interest_tags(uuid) TO authenticated;
