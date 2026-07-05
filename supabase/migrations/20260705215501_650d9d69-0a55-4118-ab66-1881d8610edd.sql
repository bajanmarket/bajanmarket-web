DROP POLICY IF EXISTS "public read listings" ON storage.objects;
DROP POLICY IF EXISTS "public read avatars" ON storage.objects;

CREATE POLICY "owner read listings" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'listings' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "owner read avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);