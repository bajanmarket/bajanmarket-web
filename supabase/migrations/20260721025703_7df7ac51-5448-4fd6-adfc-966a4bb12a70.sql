
-- Plan enum
DO $$ BEGIN
  CREATE TYPE public.seller_plan AS ENUM ('free','premium','business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.seller_plan NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Plan settings
CREATE TABLE public.plan_settings (
  plan public.seller_plan PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  price_bbd_cents integer NOT NULL DEFAULT 0,
  featured_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_settings TO anon, authenticated;
GRANT ALL ON public.plan_settings TO service_role;
ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads plan settings" ON public.plan_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage plan settings" ON public.plan_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_plan_settings_updated_at
  BEFORE UPDATE ON public.plan_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plan_settings (plan, enabled, price_bbd_cents, featured_days) VALUES
  ('free', true, 0, 0),
  ('premium', false, 1500, 7),
  ('business', false, 5000, 7);

-- Featured listings (nullable, non-breaking)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS featured_until timestamptz;
