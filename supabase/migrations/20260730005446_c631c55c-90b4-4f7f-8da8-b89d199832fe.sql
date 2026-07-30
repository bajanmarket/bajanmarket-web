
CREATE TABLE public.whatsapp_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  production_enabled boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.whatsapp_settings TO authenticated;
GRANT ALL ON public.whatsapp_settings TO service_role;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp settings" ON public.whatsapp_settings
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));
INSERT INTO public.whatsapp_settings (id) VALUES (1);

CREATE TABLE public.whatsapp_test_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  label text,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_test_numbers TO authenticated;
GRANT ALL ON public.whatsapp_test_numbers TO service_role;
ALTER TABLE public.whatsapp_test_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp test numbers" ON public.whatsapp_test_numbers
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.whatsapp_webhook_events (
  event_key text PRIMARY KEY,
  kind text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp webhook events" ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.whatsapp_connection_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ok boolean NOT NULL,
  kind text NOT NULL DEFAULT 'connection',
  detail text,
  run_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_connection_tests TO authenticated;
GRANT ALL ON public.whatsapp_connection_tests TO service_role;
ALTER TABLE public.whatsapp_connection_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read whatsapp connection tests" ON public.whatsapp_connection_tests
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::app_role));

ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_error_code text,
  ADD COLUMN IF NOT EXISTS status_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_rank smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notification_deliveries_provider_message_id_idx
  ON public.notification_deliveries (provider_message_id);
