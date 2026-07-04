
CREATE POLICY "participants delete conversation"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
