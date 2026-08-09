-- Replace bulk public read with owner/admin-only read
DROP POLICY IF EXISTS avail_public_read ON public.provider_availability;
DROP POLICY IF EXISTS blocked_public_read ON public.provider_blocked_dates;

CREATE POLICY avail_owner_read ON public.provider_availability
  FOR SELECT USING (provider_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY blocked_owner_read ON public.provider_blocked_dates
  FOR SELECT USING (provider_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- Narrow, per-provider public lookups used by the booking calendar
CREATE OR REPLACE FUNCTION public.service_public_availability(_provider_id uuid, _service_listing_id uuid)
RETURNS TABLE(
  id uuid, weekday smallint, start_time time, end_time time,
  break_start time, break_end time, slot_minutes integer, buffer_minutes integer,
  max_daily_bookings integer, min_notice_hours integer, advance_days integer,
  timezone text, active boolean, service_listing_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT a.id, a.weekday, a.start_time, a.end_time, a.break_start, a.break_end,
         a.slot_minutes, a.buffer_minutes, a.max_daily_bookings, a.min_notice_hours,
         a.advance_days, a.timezone, a.active, a.service_listing_id
  FROM public.provider_availability a
  WHERE a.provider_id = _provider_id
    AND a.active
    AND (a.service_listing_id = _service_listing_id OR a.service_listing_id IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.service_blocked_dates(_provider_id uuid)
RETURNS TABLE(blocked_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.blocked_date
  FROM public.provider_blocked_dates b
  WHERE b.provider_id = _provider_id
    AND b.blocked_date >= (now() AT TIME ZONE 'UTC')::date - 1
$$;

CREATE OR REPLACE FUNCTION public.providers_with_availability(_provider_ids uuid[])
RETURNS TABLE(provider_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT a.provider_id
  FROM public.provider_availability a
  WHERE a.active AND a.provider_id = ANY(_provider_ids)
$$;

REVOKE ALL ON FUNCTION public.service_public_availability(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_blocked_dates(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.providers_with_availability(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_public_availability(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_blocked_dates(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.providers_with_availability(uuid[]) TO anon, authenticated, service_role;