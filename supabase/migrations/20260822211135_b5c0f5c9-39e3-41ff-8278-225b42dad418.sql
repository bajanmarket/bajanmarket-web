-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.payment_environment AS ENUM ('unconfigured','sandbox','live'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_txn_status AS ENUM ('created','requires_action','authorized','captured','failed','cancelled','refunded','partially_refunded','disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payout_status AS ENUM ('pending','processing','paid','failed','reversed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.refund_status AS ENUM ('requested','pending','approved','completed','partially_refunded','failed','cancelled','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dispute_status AS ENUM ('open','under_review','evidence_required','evidence_submitted','won','lost','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.seller_payment_onboarding_status AS ENUM ('not_started','pending','requirements_due','restricted','active','rejected','disabled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.readiness_status AS ENUM ('pending','in_progress','passed','failed','not_applicable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.webhook_process_status AS ENUM ('received','processed','ignored','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ FEATURE FLAGS ============
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_feature_flags TO anon, authenticated;
GRANT ALL ON public.platform_feature_flags TO service_role;
ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags readable" ON public.platform_feature_flags FOR SELECT USING (true);
CREATE POLICY "flags admin write" ON public.platform_feature_flags FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

INSERT INTO public.platform_feature_flags (key, enabled, description) VALUES
  ('marketplace_payments_enabled', false, 'Master switch for all marketplace payment features'),
  ('marketplace_payments_announcement_enabled', false, 'Show a public "payments coming soon" announcement')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.payments_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.platform_feature_flags WHERE key = 'marketplace_payments_enabled'), false)
$$;
REVOKE ALL ON FUNCTION public.payments_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payments_enabled() TO anon, authenticated, service_role;

-- ============ SANDBOX TESTER ALLOWLIST ============
CREATE TABLE IF NOT EXISTS public.payment_feature_testers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  note text,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_feature_testers TO authenticated;
GRANT ALL ON public.payment_feature_testers TO service_role;
ALTER TABLE public.payment_feature_testers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "testers see self" ON public.payment_feature_testers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "testers admin write" ON public.payment_feature_testers FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- ============ GATEWAY CONFIGURATION (metadata only) ============
CREATE TABLE IF NOT EXISTS public.payment_gateway_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text,
  environment public.payment_environment NOT NULL DEFAULT 'unconfigured',
  credentials_configured boolean NOT NULL DEFAULT false,
  webhook_secret_configured boolean NOT NULL DEFAULT false,
  webhook_verified boolean NOT NULL DEFAULT false,
  webhook_endpoint_url text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_connection_test_at timestamptz,
  last_connection_test_ok boolean,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  singleton boolean NOT NULL DEFAULT true UNIQUE
);
GRANT SELECT ON public.payment_gateway_configuration TO authenticated;
GRANT ALL ON public.payment_gateway_configuration TO service_role;
ALTER TABLE public.payment_gateway_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gateway admin only" ON public.payment_gateway_configuration FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_gateway_cfg_updated BEFORE UPDATE ON public.payment_gateway_configuration
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.payment_gateway_configuration (provider, environment) VALUES (NULL, 'unconfigured')
  ON CONFLICT (singleton) DO NOTHING;

-- ============ READINESS CHECKS ============
CREATE TABLE IF NOT EXISTS public.payment_readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status public.readiness_status NOT NULL DEFAULT 'pending',
  evidence_reference text,
  sort_order integer NOT NULL DEFAULT 0,
  checked_by uuid,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_readiness_checks TO authenticated;
GRANT ALL ON public.payment_readiness_checks TO service_role;
ALTER TABLE public.payment_readiness_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readiness admin only" ON public.payment_readiness_checks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_readiness_updated BEFORE UPDATE ON public.payment_readiness_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.payment_readiness_checks (key, label, sort_order) VALUES
  ('gateway_provider_selected','Gateway provider selected',1),
  ('gateway_environment_live','Gateway environment marked as live',2),
  ('gateway_credentials_configured','Gateway API credentials configured',3),
  ('webhook_secret_configured','Webhook secret configured',4),
  ('webhook_endpoint_verified','Webhook endpoint verified',5),
  ('commission_rules_configured','Commission rules configured',6),
  ('seller_agreement_configured','Seller agreement configured',7),
  ('refund_policy_configured','Refund policy configured',8),
  ('legal_payment_sections_approved','Terms and Privacy payment sections approved',9),
  ('internal_test_transaction','At least one successful internal test transaction',10),
  ('gateway_submerchant_approved','Gateway/sub-merchant functionality approved by provider',11)
ON CONFLICT (key) DO NOTHING;

-- ============ SELLER PAYMENT ACCOUNTS ============
CREATE TABLE IF NOT EXISTS public.seller_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  provider text,
  gateway_account_ref text,
  environment public.payment_environment NOT NULL DEFAULT 'unconfigured',
  onboarding_status public.seller_payment_onboarding_status NOT NULL DEFAULT 'not_started',
  verification_status text NOT NULL DEFAULT 'unverified',
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  requirements_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  restriction_reason text,
  default_commission_rule_id uuid,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_payment_accounts TO authenticated;
GRANT ALL ON public.seller_payment_accounts TO service_role;
ALTER TABLE public.seller_payment_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller sees own payment account" ON public.seller_payment_accounts FOR SELECT TO authenticated
  USING ((seller_id = auth.uid() AND public.payments_enabled()) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin manages payment accounts" ON public.seller_payment_accounts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_spa_updated BEFORE UPDATE ON public.seller_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ COMMISSION RULES ============
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'default',
  seller_id uuid,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  percentage_bps integer NOT NULL DEFAULT 0,
  fixed_fee_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BBD',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_scope_chk CHECK (scope IN ('default','seller','category')),
  CONSTRAINT commission_bps_chk CHECK (percentage_bps BETWEEN 0 AND 10000),
  CONSTRAINT commission_fee_chk CHECK (fixed_fee_cents >= 0)
);
GRANT SELECT ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller sees own commission rules" ON public.commission_rules FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)
     OR (public.payments_enabled() AND (scope = 'default' OR seller_id = auth.uid())));
CREATE POLICY "admin manages commission rules" ON public.commission_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_commission_updated BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.ci_orders(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  buyer_id uuid,
  seller_id uuid NOT NULL,
  provider text,
  gateway_payment_ref text,
  gateway_event_ref text,
  currency text NOT NULL DEFAULT 'BBD',
  gross_amount_cents bigint NOT NULL DEFAULT 0,
  gateway_fee_cents bigint NOT NULL DEFAULT 0,
  platform_commission_cents bigint NOT NULL DEFAULT 0,
  seller_net_cents bigint NOT NULL DEFAULT 0,
  commission_rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  status public.payment_txn_status NOT NULL DEFAULT 'created',
  environment public.payment_environment NOT NULL DEFAULT 'sandbox',
  idempotency_key text NOT NULL UNIQUE,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  captured_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT txn_amounts_chk CHECK (gross_amount_cents >= 0 AND gateway_fee_cents >= 0 AND platform_commission_cents >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_gateway_ref_uq
  ON public.payment_transactions (provider, gateway_payment_ref) WHERE gateway_payment_ref IS NOT NULL;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties see own transactions" ON public.payment_transactions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)
     OR (public.payments_enabled() AND (buyer_id = auth.uid() OR seller_id = auth.uid())));
CREATE POLICY "admin manages transactions" ON public.payment_transactions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_txn_updated BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYOUTS ============
CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  period_start timestamptz,
  period_end timestamptz,
  provider text,
  gateway_payout_ref text,
  gross_earnings_cents bigint NOT NULL DEFAULT 0,
  adjustments_cents bigint NOT NULL DEFAULT 0,
  net_payout_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BBD',
  status public.payout_status NOT NULL DEFAULT 'pending',
  failure_reason text,
  expected_arrival_at timestamptz,
  paid_at timestamptz,
  environment public.payment_environment NOT NULL DEFAULT 'sandbox',
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_payouts TO authenticated;
GRANT ALL ON public.seller_payouts TO service_role;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller sees own payouts" ON public.seller_payouts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role) OR (public.payments_enabled() AND seller_id = auth.uid()));
CREATE POLICY "admin manages payouts" ON public.seller_payouts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_payout_updated BEFORE UPDATE ON public.seller_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ REFUNDS ============
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  requested_by uuid,
  buyer_id uuid,
  seller_id uuid,
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BBD',
  reason text,
  status public.refund_status NOT NULL DEFAULT 'requested',
  admin_approved_by uuid,
  admin_approved_at timestamptz,
  gateway_refund_ref text,
  failure_reason text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refund_amount_chk CHECK (amount_cents >= 0)
);
GRANT SELECT ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties see own refunds" ON public.payment_refunds FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)
     OR (public.payments_enabled() AND (buyer_id = auth.uid() OR seller_id = auth.uid())));
CREATE POLICY "admin manages refunds" ON public.payment_refunds FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_refund_updated BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DISPUTES ============
CREATE TABLE IF NOT EXISTS public.payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  seller_id uuid,
  buyer_id uuid,
  provider text,
  gateway_dispute_ref text,
  amount_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BBD',
  reason_category text,
  status public.dispute_status NOT NULL DEFAULT 'open',
  evidence_due_at timestamptz,
  evidence_submitted_at timestamptz,
  evidence_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_disputes_gateway_uq
  ON public.payment_disputes (provider, gateway_dispute_ref) WHERE gateway_dispute_ref IS NOT NULL;
GRANT SELECT ON public.payment_disputes TO authenticated;
GRANT ALL ON public.payment_disputes TO service_role;
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties see own disputes" ON public.payment_disputes FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)
     OR (public.payments_enabled() AND (buyer_id = auth.uid() OR seller_id = auth.uid())));
CREATE POLICY "admin manages disputes" ON public.payment_disputes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_dispute_updated BEFORE UPDATE ON public.payment_disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WEBHOOK EVENTS ============
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  gateway_event_id text NOT NULL,
  event_type text NOT NULL,
  status public.webhook_process_status NOT NULL DEFAULT 'received',
  safe_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_summary text,
  retry_count integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, gateway_event_id)
);
GRANT SELECT ON public.payment_webhook_events TO authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks admin only" ON public.payment_webhook_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role));

-- ============ AUDIT LOG (append only) ============
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  readiness_snapshot jsonb,
  request_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.payment_audit_log TO service_role;
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.payment_audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.payment_audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'payment_audit_log is append-only';
END $$;
REVOKE ALL ON FUNCTION public.payment_audit_log_immutable() FROM PUBLIC;
CREATE TRIGGER trg_payment_audit_immutable
  BEFORE UPDATE OR DELETE ON public.payment_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.payment_audit_log_immutable();