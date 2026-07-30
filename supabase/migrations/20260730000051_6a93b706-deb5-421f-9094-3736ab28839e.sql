UPDATE public.bookings SET status = 'pending', price = 100
WHERE reference = 'BM-B14AC07D';

CREATE OR REPLACE FUNCTION public.bookings_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF is_provider THEN
      IF NEW.status NOT IN ('confirmed','declined','reschedule_requested','cancelled_by_provider','completed','no_show','disputed') THEN
        RAISE EXCEPTION 'Providers cannot set status %', NEW.status;
      END IF;
    ELSIF is_buyer THEN
      IF NEW.status NOT IN ('cancelled_by_buyer','confirmed','declined','disputed') THEN
        RAISE EXCEPTION 'Customers cannot set status %', NEW.status;
      END IF;
      -- A customer may only confirm/decline in response to a proposed new time
      IF NEW.status IN ('confirmed','declined') AND OLD.status <> 'reschedule_requested' THEN
        RAISE EXCEPTION 'Only the provider can accept or decline a booking';
      END IF;
    ELSE
      RAISE EXCEPTION 'Not allowed to change this booking';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bookings_guard_update ON public.bookings;
CREATE TRIGGER trg_bookings_guard_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.bookings_guard_update();

REVOKE EXECUTE ON FUNCTION public.bookings_guard_update() FROM anon, authenticated;

-- restore QA provider hours changed during testing
UPDATE public.provider_availability SET end_time = '17:00:00'
WHERE provider_id = '22ddbd19-d915-4eef-8eaa-5331ad13d6dd' AND end_time = '23:00:00';