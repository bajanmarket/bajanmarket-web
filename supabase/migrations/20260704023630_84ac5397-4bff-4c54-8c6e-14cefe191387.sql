
REVOKE EXECUTE ON FUNCTION public.enforce_message_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_report_rate_limit() FROM PUBLIC, anon, authenticated;
