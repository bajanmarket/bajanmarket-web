DROP POLICY IF EXISTS "wa_consent_own" ON public.whatsapp_consent;

CREATE POLICY "wa_consent_own_read" ON public.whatsapp_consent
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_consent FROM authenticated;
GRANT SELECT ON public.whatsapp_consent TO authenticated;
GRANT ALL ON public.whatsapp_consent TO service_role;
