DROP POLICY IF EXISTS "images public read" ON public.listing_images;

CREATE POLICY "images public read" ON public.listing_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.listings l
    LEFT JOIN public.profiles p ON p.id = l.seller_id
    WHERE l.id = listing_images.listing_id
      AND l.status IN ('active','sold')
      AND l.deleted_at IS NULL
      AND (p.banned_at IS NULL)
  )
  OR EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_images.listing_id
      AND l.seller_id = auth.uid()
  )
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'moderator'::app_role)
);