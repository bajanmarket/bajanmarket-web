ALTER TABLE public.seller_growth_settings
  ADD COLUMN IF NOT EXISTS allowlist_required boolean NOT NULL DEFAULT true;