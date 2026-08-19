ALTER TABLE public.lead_social_posts
  ADD COLUMN IF NOT EXISTS stored_media_url text,
  ADD COLUMN IF NOT EXISTS media_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.draft_listings
  ADD COLUMN IF NOT EXISTS stored_media_url text,
  ADD COLUMN IF NOT EXISTS original_caption text,
  ADD COLUMN IF NOT EXISTS image_source text NOT NULL DEFAULT 'placeholder';