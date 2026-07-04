
CREATE OR REPLACE FUNCTION public.increment_listing_view(_listing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings
     SET views = COALESCE(views, 0) + 1
   WHERE id = _listing_id
     AND status = 'active';
END $$;

REVOKE ALL ON FUNCTION public.increment_listing_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_view(uuid) TO anon, authenticated;
