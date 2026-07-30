DELETE FROM public.booking_answers WHERE booking_id IN (SELECT id FROM public.bookings WHERE service_listing_id = '11111111-1111-4111-8111-111111111111');
DELETE FROM public.booking_status_history WHERE booking_id IN (SELECT id FROM public.bookings WHERE service_listing_id = '11111111-1111-4111-8111-111111111111');
DELETE FROM public.messages WHERE conversation_id IN (SELECT conversation_id FROM public.bookings WHERE service_listing_id = '11111111-1111-4111-8111-111111111111' AND conversation_id IS NOT NULL);
DELETE FROM public.conversations WHERE id IN (SELECT conversation_id FROM public.bookings WHERE service_listing_id = '11111111-1111-4111-8111-111111111111' AND conversation_id IS NOT NULL);
DELETE FROM public.bookings WHERE service_listing_id = '11111111-1111-4111-8111-111111111111';
DELETE FROM public.service_listing_answers WHERE service_listing_id = '11111111-1111-4111-8111-111111111111';
DELETE FROM public.provider_availability WHERE service_listing_id = '11111111-1111-4111-8111-111111111111';
DELETE FROM public.service_listings WHERE id = '11111111-1111-4111-8111-111111111111';