CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.banned_at IS NOT NULL)
$$;

REVOKE ALL ON FUNCTION public.is_user_banned(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "active listings public read" ON public.listings;
CREATE POLICY "active listings public read" ON public.listings
FOR SELECT USING (
  ((status = ANY (ARRAY['active'::listing_status, 'sold'::listing_status])) AND NOT public.is_user_banned(seller_id))
  OR (auth.uid() = seller_id)
  OR private.has_role(auth.uid(), 'moderator'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "sellers insert own listings" ON public.listings;
CREATE POLICY "sellers insert own listings" ON public.listings
FOR INSERT WITH CHECK (auth.uid() = seller_id AND NOT public.is_user_banned(auth.uid()));

DROP POLICY IF EXISTS "participants send messages" ON public.messages;
CREATE POLICY "participants send messages" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND NOT public.is_user_banned(auth.uid())
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id))
);

DROP POLICY IF EXISTS "images public read" ON public.listing_images;
CREATE POLICY "images public read" ON public.listing_images
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_images.listing_id
      AND l.status = ANY (ARRAY['active'::listing_status, 'sold'::listing_status])
      AND l.deleted_at IS NULL
      AND NOT public.is_user_banned(l.seller_id)
  )
  OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_images.listing_id AND l.seller_id = auth.uid())
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'moderator'::app_role)
);