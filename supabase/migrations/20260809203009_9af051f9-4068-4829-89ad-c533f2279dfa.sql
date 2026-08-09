-- 1. Lock down owner updates on businesses: owner cannot change status to approved/rejected
DROP POLICY IF EXISTS "Owner can update own business" ON public.businesses;
CREATE POLICY "Owner can update own business"
ON public.businesses
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id AND status = 'pending'::text);

-- Owners edit a live business without flipping status: the guard trigger already
-- rejects owner-driven status changes, so allow unchanged status via a second policy is
-- unnecessary; instead permit any status as long as the trigger enforces immutability.
DROP POLICY IF EXISTS "Owner can update own business" ON public.businesses;
CREATE POLICY "Owner can update own business"
ON public.businesses
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Strengthen the guard trigger so it also blocks owner_id takeover and runs for all roles
CREATE OR REPLACE FUNCTION public.businesses_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND NOT private.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change business ownership';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT private.has_role(auth.uid(),'admin'::app_role) THEN
      -- Owners may only send an approved/rejected business back for review
      IF auth.uid() = OLD.owner_id AND NEW.status = 'pending' THEN
        NEW.rejection_reason := NULL;
      ELSE
        RAISE EXCEPTION 'Only admins can change business status';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 2. Pin search_path on the email queue helper functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path TO '';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path TO '';
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path TO '';
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path TO '';