CREATE OR REPLACE FUNCTION public.service_busy_slots(
  _provider_id uuid,
  _from timestamptz,
  _to timestamptz
)
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.starts_at, b.ends_at
  FROM public.bookings b
  WHERE b.provider_id = _provider_id
    AND b.starts_at >= _from
    AND b.starts_at < _to
    AND b.status IN ('pending','confirmed','reschedule_requested')
$$;

GRANT EXECUTE ON FUNCTION public.service_busy_slots(uuid, timestamptz, timestamptz) TO anon, authenticated;