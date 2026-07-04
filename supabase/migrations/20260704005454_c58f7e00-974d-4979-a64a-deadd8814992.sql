
-- 1. Ban flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at timestamptz;

-- 2. Admin/moderator can see and update all reports
CREATE POLICY "mods read all reports" ON public.reports
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'moderator') OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "mods update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'moderator') OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'moderator') OR private.has_role(auth.uid(), 'admin'));

-- 3. Admin/moderator can update any profile (needed to set banned_at)
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users or mods update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR private.has_role(auth.uid(), 'moderator') OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR private.has_role(auth.uid(), 'moderator') OR private.has_role(auth.uid(), 'admin'));

-- 4. Only admins can grant/revoke roles
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 5. Filter banned sellers out of public listing feed
DROP POLICY IF EXISTS "active listings public read" ON public.listings;
CREATE POLICY "active listings public read" ON public.listings
  FOR SELECT
  USING (
    (
      (status = ANY (ARRAY['active'::listing_status, 'sold'::listing_status]))
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = listings.seller_id AND p.banned_at IS NOT NULL)
    )
    OR auth.uid() = seller_id
    OR private.has_role(auth.uid(), 'moderator')
    OR private.has_role(auth.uid(), 'admin')
  );

-- 6. Block banned users from creating listings
DROP POLICY IF EXISTS "sellers insert own listings" ON public.listings;
CREATE POLICY "sellers insert own listings" ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.banned_at IS NOT NULL)
  );

-- 7. Block banned users from sending messages
DROP POLICY IF EXISTS "participants send messages" ON public.messages;
CREATE POLICY "participants send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.banned_at IS NOT NULL)
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
    )
  );
