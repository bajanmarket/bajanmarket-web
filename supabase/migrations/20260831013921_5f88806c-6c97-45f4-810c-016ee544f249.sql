-- 1. Profiles guard
CREATE OR REPLACE FUNCTION public.profiles_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_staff boolean := private.has_role(auth.uid(),'moderator'::app_role) OR private.has_role(auth.uid(),'admin'::app_role);
BEGIN
  -- Trusted paths: internal SECURITY DEFINER routines/triggers and service_role run as
  -- the table owner, not as the PostgREST "authenticated"/"anon" roles.
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.banned_at IS DISTINCT FROM OLD.banned_at AND NOT is_staff THEN
    RAISE EXCEPTION 'Only moderators can change ban status';
  END IF;

  IF NOT is_staff THEN
    NEW.listings_count      := OLD.listings_count;
    NEW.favourites_count    := OLD.favourites_count;
    NEW.messages_sent_count := OLD.messages_sent_count;
    NEW.first_listing_at    := OLD.first_listing_at;
    NEW.first_message_at    := OLD.first_message_at;
    NEW.last_active_at      := OLD.last_active_at;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_guard_update ON public.profiles;
CREATE TRIGGER trg_profiles_guard_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_update();

-- 2. Messages immutability (read/delivered receipts still allowed)
CREATE OR REPLACE FUNCTION public.messages_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Messages cannot be edited after sending';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_messages_guard_update ON public.messages;
CREATE TRIGGER trg_messages_guard_update
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.messages_guard_update();

-- 3. Conversations: immutable identity columns + seller must own the listing
CREATE OR REPLACE FUNCTION public.conversations_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Conversation participants and links cannot be changed';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_conversations_guard_update ON public.conversations;
CREATE TRIGGER trg_conversations_guard_update
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.conversations_guard_update();

CREATE OR REPLACE FUNCTION public.conversation_listing_seller(_listing_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT l.seller_id FROM public.listings l WHERE l.id = _listing_id
$$;
REVOKE ALL ON FUNCTION public.conversation_listing_seller(uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "buyer creates conversation" ON public.conversations;
CREATE POLICY "buyer creates conversation"
ON public.conversations FOR INSERT
WITH CHECK (
  auth.uid() = buyer_id
  AND (
    listing_id IS NULL
    OR seller_id = public.conversation_listing_seller(listing_id)
  )
);

-- 4. Bookings: appointment time only changes through the reschedule workflow
CREATE OR REPLACE FUNCTION public.bookings_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_provider boolean := auth.uid() = OLD.provider_id;
  is_buyer    boolean := auth.uid() = OLD.buyer_id;
  is_admin    boolean := private.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF is_admin OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Immutable core fields
  IF NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.service_listing_id IS DISTINCT FROM OLD.service_listing_id
     OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'Booking core details cannot be changed';
  END IF;

  -- Scheduled time may only move via the reschedule workflow:
  -- the party accepting a proposed time adopts exactly OLD.requested_starts_at
  -- and keeps the original duration.
  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
    IF OLD.status <> 'reschedule_requested'
       OR OLD.requested_starts_at IS NULL
       OR NEW.status <> 'confirmed'
       OR NEW.starts_at IS DISTINCT FROM OLD.requested_starts_at
       OR (NEW.ends_at - NEW.starts_at) IS DISTINCT FROM (OLD.ends_at - OLD.starts_at) THEN
      RAISE EXCEPTION 'Booking times can only change by accepting a proposed new time';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF is_provider THEN
      IF NEW.status NOT IN ('confirmed','declined','reschedule_requested','cancelled_by_provider','completed','no_show','disputed') THEN
        RAISE EXCEPTION 'Providers cannot set status %', NEW.status;
      END IF;
    ELSIF is_buyer THEN
      IF NEW.status NOT IN ('cancelled_by_buyer','confirmed','declined','disputed') THEN
        RAISE EXCEPTION 'Customers cannot set status %', NEW.status;
      END IF;
      IF NEW.status IN ('confirmed','declined') AND OLD.status <> 'reschedule_requested' THEN
        RAISE EXCEPTION 'Only the provider can accept or decline a booking';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not allowed to change this booking';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- 5. Listings: system-maintained metrics are not hand-editable
CREATE OR REPLACE FUNCTION public.listings_guard_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN NEW;
  END IF;
  NEW.views           := OLD.views;
  NEW.favourite_count := OLD.favourite_count;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_listings_guard_metrics ON public.listings;
CREATE TRIGGER trg_listings_guard_metrics
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.listings_guard_metrics();

-- 6. Banned users cannot create or publish service listings
DROP POLICY IF EXISTS service_listings_owner_insert ON public.service_listings;
CREATE POLICY service_listings_owner_insert
ON public.service_listings FOR INSERT TO authenticated
WITH CHECK (provider_id = auth.uid() AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS service_listings_owner_update ON public.service_listings;
CREATE POLICY service_listings_owner_update
ON public.service_listings FOR UPDATE TO authenticated
USING (
  (provider_id = auth.uid() AND NOT public.is_user_banned(auth.uid()))
  OR private.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (provider_id = auth.uid() AND NOT public.is_user_banned(auth.uid()))
  OR private.has_role(auth.uid(), 'admin'::app_role)
);