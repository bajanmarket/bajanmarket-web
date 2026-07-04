
ALTER TABLE public.conversations
  ADD COLUMN buyer_hidden_at timestamptz NULL,
  ADD COLUMN seller_hidden_at timestamptz NULL;
