DROP POLICY IF EXISTS sla_public_read ON public.service_listing_answers;

CREATE POLICY sla_public_read ON public.service_listing_answers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_listings s
    WHERE s.id = service_listing_answers.service_listing_id
      AND (
        s.provider_id = auth.uid()
        OR private.has_role(auth.uid(), 'admin'::app_role)
        OR (
          s.status = 'active'::service_listing_status
          AND NOT EXISTS (
            SELECT 1 FROM public.service_template_fields f
            WHERE f.category_id = s.category_id
              AND f.field_key = service_listing_answers.field_key
              AND f.sensitive IS TRUE
          )
        )
      )
  )
);