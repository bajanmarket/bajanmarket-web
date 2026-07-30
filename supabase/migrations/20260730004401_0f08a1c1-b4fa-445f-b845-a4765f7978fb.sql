-- 1. One conversation per booking
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversations_booking
  ON public.conversations (booking_id) WHERE booking_id IS NOT NULL;

-- 2. Nine independent notification switches
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS in_app_booking  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_app_message  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_app_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_booking   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_message   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_reminder  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS wa_booking      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_message      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_reminder     boolean NOT NULL DEFAULT false;

UPDATE public.notification_preferences SET
  in_app_booking  = in_app_enabled   AND booking_events,
  in_app_message  = in_app_enabled   AND message_events,
  in_app_reminder = in_app_enabled   AND reminder_events,
  email_booking   = email_enabled    AND booking_events,
  email_message   = email_enabled    AND message_events,
  email_reminder  = email_enabled    AND reminder_events,
  wa_booking      = whatsapp_enabled AND booking_events,
  wa_message      = whatsapp_enabled AND message_events,
  wa_reminder     = whatsapp_enabled AND reminder_events;

-- 3. Hardened WhatsApp consent record
ALTER TABLE public.whatsapp_consent
  ADD COLUMN IF NOT EXISTS verification_code_hash text,
  ADD COLUMN IF NOT EXISTS verify_attempts        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_code_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS consent_text_version   text,
  ADD COLUMN IF NOT EXISTS consent_source         text,
  ADD COLUMN IF NOT EXISTS last_delivery_status   text,
  ADD COLUMN IF NOT EXISTS last_delivery_at       timestamptz;

UPDATE public.whatsapp_consent SET verification_code = NULL;
ALTER TABLE public.whatsapp_consent DROP COLUMN IF EXISTS verification_code;

-- 4. Delivery ledger: idempotency + retry bookkeeping
ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempts        integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_retry_at   timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nd_idempotency
  ON public.notification_deliveries (idempotency_key) WHERE idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_nd_updated ON public.notification_deliveries;
CREATE TRIGGER trg_nd_updated BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
