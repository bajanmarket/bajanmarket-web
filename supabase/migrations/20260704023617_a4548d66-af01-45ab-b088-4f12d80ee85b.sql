
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt
    FROM public.messages
   WHERE sender_id = NEW.sender_id
     AND created_at > now() - interval '1 hour';
  IF cnt >= 60 THEN
    RAISE EXCEPTION 'Message rate limit exceeded. Try again later.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_message_rate_limit ON public.messages;
CREATE TRIGGER trg_enforce_message_rate_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt
    FROM public.reports
   WHERE reporter_id = NEW.reporter_id
     AND created_at > now() - interval '1 hour';
  IF cnt >= 10 THEN
    RAISE EXCEPTION 'Report rate limit exceeded. Try again later.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_report_rate_limit ON public.reports;
CREATE TRIGGER trg_enforce_report_rate_limit
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_rate_limit();
