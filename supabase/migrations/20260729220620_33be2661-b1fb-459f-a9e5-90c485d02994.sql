-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM (
    'pending','confirmed','declined','reschedule_requested',
    'cancelled_by_buyer','cancelled_by_provider','completed','no_show','disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_field_audience AS ENUM ('provider','buyer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_field_type AS ENUM (
    'text','textarea','number','select','multiselect','boolean','date','time','phone','images'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_listing_status AS ENUM ('draft','active','paused','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ SERVICE CATEGORIES ============
CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Sparkles',
  description text,
  active boolean NOT NULL DEFAULT true,
  instant_booking_allowed boolean NOT NULL DEFAULT true,
  requires_provider_approval boolean NOT NULL DEFAULT true,
  duration_options integer[] NOT NULL DEFAULT '{30,60,90,120}',
  cancellation_policy text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT ALL ON public.service_categories TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_categories_public_read" ON public.service_categories
  FOR SELECT USING (active OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "service_categories_admin_write" ON public.service_categories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- ============ TEMPLATE FIELDS ============
CREATE TABLE IF NOT EXISTS public.service_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  audience public.service_field_audience NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  help_text text,
  field_type public.service_field_type NOT NULL DEFAULT 'text',
  options text[] NOT NULL DEFAULT '{}',
  required boolean NOT NULL DEFAULT false,
  sensitive boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, audience, field_key)
);
CREATE INDEX IF NOT EXISTS idx_stf_category ON public.service_template_fields(category_id, audience, sort_order);
GRANT SELECT ON public.service_template_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_template_fields TO authenticated;
GRANT ALL ON public.service_template_fields TO service_role;
ALTER TABLE public.service_template_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stf_public_read" ON public.service_template_fields
  FOR SELECT USING (active OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "stf_admin_write" ON public.service_template_fields
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- ============ SERVICE LISTINGS ============
CREATE TABLE IF NOT EXISTS public.service_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'per_session',
  currency text NOT NULL DEFAULT 'BBD',
  duration_minutes integer NOT NULL DEFAULT 60,
  parish public.parish,
  areas_served text[] NOT NULL DEFAULT '{}',
  mobile_service boolean NOT NULL DEFAULT false,
  location_note text,
  cover_image_url text,
  images text[] NOT NULL DEFAULT '{}',
  instant_booking boolean NOT NULL DEFAULT false,
  cancellation_policy text,
  status public.service_listing_status NOT NULL DEFAULT 'active',
  rating_avg numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_listings_cat ON public.service_listings(category_id, status);
CREATE INDEX IF NOT EXISTS idx_service_listings_provider ON public.service_listings(provider_id);
GRANT SELECT ON public.service_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_listings TO authenticated;
GRANT ALL ON public.service_listings TO service_role;
ALTER TABLE public.service_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_listings_public_read" ON public.service_listings
  FOR SELECT USING (
    status = 'active'
    OR provider_id = auth.uid()
    OR private.has_role(auth.uid(),'moderator'::app_role)
    OR private.has_role(auth.uid(),'admin'::app_role)
  );
CREATE POLICY "service_listings_owner_insert" ON public.service_listings
  FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid());
CREATE POLICY "service_listings_owner_update" ON public.service_listings
  FOR UPDATE TO authenticated
  USING (provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "service_listings_owner_delete" ON public.service_listings
  FOR DELETE TO authenticated
  USING (provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));

-- ============ PROVIDER ANSWERS TO TEMPLATE ============
CREATE TABLE IF NOT EXISTS public.service_listing_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_listing_id uuid NOT NULL REFERENCES public.service_listings(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_listing_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_sla_listing ON public.service_listing_answers(service_listing_id);
GRANT SELECT ON public.service_listing_answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_listing_answers TO authenticated;
GRANT ALL ON public.service_listing_answers TO service_role;
ALTER TABLE public.service_listing_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_public_read" ON public.service_listing_answers
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.service_listings s
    WHERE s.id = service_listing_id
      AND (s.status = 'active' OR s.provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))
  ));
CREATE POLICY "sla_owner_write" ON public.service_listing_answers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_listings s WHERE s.id = service_listing_id AND (s.provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_listings s WHERE s.id = service_listing_id AND (s.provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))));

-- ============ AVAILABILITY ============
CREATE TABLE IF NOT EXISTS public.provider_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_listing_id uuid REFERENCES public.service_listings(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  break_start time,
  break_end time,
  slot_minutes integer NOT NULL DEFAULT 60,
  buffer_minutes integer NOT NULL DEFAULT 0,
  max_daily_bookings integer NOT NULL DEFAULT 8,
  min_notice_hours integer NOT NULL DEFAULT 12,
  advance_days integer NOT NULL DEFAULT 60,
  timezone text NOT NULL DEFAULT 'America/Barbados',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avail_provider ON public.provider_availability(provider_id, weekday);
CREATE INDEX IF NOT EXISTS idx_avail_listing ON public.provider_availability(service_listing_id);
GRANT SELECT ON public.provider_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_availability TO authenticated;
GRANT ALL ON public.provider_availability TO service_role;
ALTER TABLE public.provider_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avail_public_read" ON public.provider_availability FOR SELECT USING (true);
CREATE POLICY "avail_owner_write" ON public.provider_availability
  FOR ALL TO authenticated
  USING (provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.provider_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_listing_id uuid REFERENCES public.service_listings(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blocked_provider ON public.provider_blocked_dates(provider_id, blocked_date);
GRANT SELECT ON public.provider_blocked_dates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_blocked_dates TO authenticated;
GRANT ALL ON public.provider_blocked_dates TO service_role;
ALTER TABLE public.provider_blocked_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_public_read" ON public.provider_blocked_dates FOR SELECT USING (true);
CREATE POLICY "blocked_owner_write" ON public.provider_blocked_dates
  FOR ALL TO authenticated
  USING (provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));

-- ============ BOOKINGS ============
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('BM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  service_listing_id uuid NOT NULL REFERENCES public.service_listings(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  provider_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Barbados',
  status public.booking_status NOT NULL DEFAULT 'pending',
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BBD',
  location text,
  buyer_contact_phone text,
  provider_note text,
  buyer_note text,
  requested_starts_at timestamptz,
  cancelled_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON public.bookings(provider_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_buyer ON public.bookings(buyer_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_listing ON public.bookings(service_listing_id, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_booking_slot_active
  ON public.bookings(provider_id, starts_at)
  WHERE status IN ('pending','confirmed','reschedule_requested');
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings_parties_read" ON public.bookings
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "bookings_buyer_insert" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "bookings_parties_update" ON public.bookings
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid() OR provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (buyer_id = auth.uid() OR provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.booking_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, field_key)
);
CREATE INDEX IF NOT EXISTS idx_booking_answers ON public.booking_answers(booking_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_answers TO authenticated;
GRANT ALL ON public.booking_answers TO service_role;
ALTER TABLE public.booking_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_answers_parties_read" ON public.booking_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id
    AND (b.buyer_id = auth.uid() OR b.provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))));
CREATE POLICY "booking_answers_buyer_write" ON public.booking_answers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.buyer_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.buyer_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))));

CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_status public.booking_status,
  to_status public.booking_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bsh_booking ON public.booking_status_history(booking_id, created_at);
GRANT SELECT, INSERT ON public.booking_status_history TO authenticated;
GRANT ALL ON public.booking_status_history TO service_role;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsh_parties_read" ON public.booking_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id
    AND (b.buyer_id = auth.uid() OR b.provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))));
CREATE POLICY "bsh_parties_insert" ON public.booking_status_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id
    AND (b.buyer_id = auth.uid() OR b.provider_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role))));

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  message_events boolean NOT NULL DEFAULT true,
  booking_events boolean NOT NULL DEFAULT true,
  reminder_events boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_prefs_own" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own_read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_own_update" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_own_delete" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nd_user ON public.notification_deliveries(user_id, created_at DESC);
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nd_own_read" ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.whatsapp_consent (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL,
  verified_at timestamptz,
  verification_code text,
  verification_expires_at timestamptz,
  consented_at timestamptz,
  consent_method text,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_consent TO authenticated;
GRANT ALL ON public.whatsapp_consent TO service_role;
ALTER TABLE public.whatsapp_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_consent_own" ON public.whatsapp_consent
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ CONVERSATION LINK (backward compatible) ============
ALTER TABLE public.conversations ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_booking ON public.conversations(booking_id);

-- ============ TRIGGERS ============
CREATE TRIGGER trg_service_categories_updated BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stf_updated BEFORE UPDATE ON public.service_template_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_service_listings_updated BEFORE UPDATE ON public.service_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sla_updated BEFORE UPDATE ON public.service_listing_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_avail_updated BEFORE UPDATE ON public.provider_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notif_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wa_consent_updated BEFORE UPDATE ON public.whatsapp_consent
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Booking status history auto-log
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_status_history (booking_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_status_history (booking_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_booking_status_change() FROM anon, authenticated;
CREATE TRIGGER trg_booking_status_history AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- ============ SEED SERVICE CATEGORIES ============
INSERT INTO public.service_categories (slug, name, icon, requires_provider_approval, sort_order) VALUES
  ('spa-wellness','Spa & Wellness','Sparkles',true,1),
  ('massage','Massage Services','HandHeart',true,2),
  ('lawn-care','Lawn Care & Landscaping','Trees',true,3),
  ('home-cleaning','Home Cleaning','SprayCan',true,4),
  ('car-detailing','Car Washing & Detailing','Car',true,5),
  ('tutoring','Tutoring','GraduationCap',true,6),
  ('pet-care','Pet Care','PawPrint',true,7),
  ('childcare','Babysitting & Childcare','Baby',true,8),
  ('tech-support','Technology Support','Laptop',true,9)
ON CONFLICT (slug) DO NOTHING;

-- ============ SEED TEMPLATE FIELDS ============
INSERT INTO public.service_template_fields (category_id, audience, field_key, label, field_type, required, sensitive, sort_order)
SELECT c.id, f.audience::public.service_field_audience, f.field_key, f.label, f.field_type::public.service_field_type, f.required, f.sensitive, f.sort_order
FROM public.service_categories c
JOIN (VALUES
  -- SPA & WELLNESS
  ('spa-wellness','provider','business_name','Business name','text',true,false,1),
  ('spa-wellness','provider','service_offered','Service offered','text',true,false,2),
  ('spa-wellness','provider','description','Description','textarea',true,false,3),
  ('spa-wellness','provider','duration','Duration (minutes)','number',true,false,4),
  ('spa-wellness','provider','price','Price','number',true,false,5),
  ('spa-wellness','provider','staff_members','Staff members','text',false,false,6),
  ('spa-wellness','provider','business_location','Business location','text',true,false,7),
  ('spa-wellness','provider','mobile_service','Mobile service available','boolean',false,false,8),
  ('spa-wellness','provider','available_days','Available days','multiselect',false,false,9),
  ('spa-wellness','provider','available_times','Available times','text',false,false,10),
  ('spa-wellness','provider','preparation','Preparation instructions','textarea',false,false,11),
  ('spa-wellness','provider','cancellation_policy','Cancellation policy','textarea',false,false,12),
  ('spa-wellness','buyer','selected_service','Selected service','text',true,false,1),
  ('spa-wellness','buyer','preferred_staff','Preferred staff member','text',false,false,2),
  ('spa-wellness','buyer','people_count','Number of people','number',true,false,3),
  ('spa-wellness','buyer','special_requests','Special requests','textarea',false,false,4),
  ('spa-wellness','buyer','allergies','Allergies or sensitivities','textarea',false,true,5),
  ('spa-wellness','buyer','contact_number','Contact number','phone',true,true,6),
  -- MASSAGE
  ('massage','provider','massage_type','Massage type','text',true,false,1),
  ('massage','provider','session_duration','Session duration (minutes)','number',true,false,2),
  ('massage','provider','price','Price','number',true,false,3),
  ('massage','provider','location','Location','text',true,false,4),
  ('massage','provider','mobile_service','Mobile service available','boolean',false,false,5),
  ('massage','provider','therapist_availability','Therapist availability','text',false,false,6),
  ('massage','provider','preparation','Preparation instructions','textarea',false,false,7),
  ('massage','provider','cancellation_policy','Cancellation policy','textarea',false,false,8),
  ('massage','buyer','massage_type','Massage type','text',true,false,1),
  ('massage','buyer','duration','Duration (minutes)','number',true,false,2),
  ('massage','buyer','preferred_location','Preferred location','text',true,false,3),
  ('massage','buyer','areas_of_concern','Areas of concern','textarea',false,true,4),
  ('massage','buyer','allergies','Allergies or sensitivities','textarea',false,true,5),
  ('massage','buyer','special_requests','Special requests','textarea',false,false,6),
  ('massage','buyer','contact_number','Contact number','phone',true,true,7),
  -- LAWN CARE
  ('lawn-care','provider','services_offered','Services offered','textarea',true,false,1),
  ('lawn-care','provider','areas_served','Areas served','multiselect',true,false,2),
  ('lawn-care','provider','pricing_method','Pricing method','select',true,false,3),
  ('lawn-care','provider','minimum_callout','Minimum call-out fee','number',false,false,4),
  ('lawn-care','provider','available_days','Available days','multiselect',false,false,5),
  ('lawn-care','provider','equipment_provided','Equipment provided','boolean',false,false,6),
  ('lawn-care','provider','waste_removal','Waste-removal option','boolean',false,false,7),
  ('lawn-care','provider','recurring_option','Recurring-service option','boolean',false,false,8),
  ('lawn-care','provider','response_time','Estimated response time','text',false,false,9),
  ('lawn-care','buyer','property_location','Property location','text',true,true,1),
  ('lawn-care','buyer','property_type','Property type','select',true,false,2),
  ('lawn-care','buyer','lawn_size','Approximate lawn size','text',true,false,3),
  ('lawn-care','buyer','service_required','Service required','text',true,false,4),
  ('lawn-care','buyer','recurring','One-time or recurring','select',true,false,5),
  ('lawn-care','buyer','waste_removal','Waste removal required','boolean',false,false,6),
  ('lawn-care','buyer','access_instructions','Property access instructions','textarea',false,true,7),
  ('lawn-care','buyer','photos','Upload photos','images',false,false,8),
  ('lawn-care','buyer','notes','Additional notes','textarea',false,false,9),
  ('lawn-care','buyer','contact_number','Contact number','phone',true,true,10),
  -- HOME CLEANING
  ('home-cleaning','provider','services_offered','Cleaning services offered','textarea',true,false,1),
  ('home-cleaning','provider','areas_served','Areas served','multiselect',true,false,2),
  ('home-cleaning','provider','pricing_method','Hourly or fixed pricing','select',true,false,3),
  ('home-cleaning','provider','minimum_booking','Minimum booking time (hours)','number',false,false,4),
  ('home-cleaning','provider','supplies_included','Supplies included','boolean',false,false,5),
  ('home-cleaning','provider','available_days','Available days','multiselect',false,false,6),
  ('home-cleaning','provider','recurring_option','Recurring-booking option','boolean',false,false,7),
  ('home-cleaning','provider','cancellation_policy','Cancellation policy','textarea',false,false,8),
  ('home-cleaning','buyer','property_location','Property location','text',true,true,1),
  ('home-cleaning','buyer','property_type','Property type','select',true,false,2),
  ('home-cleaning','buyer','bedrooms','Number of bedrooms','number',true,false,3),
  ('home-cleaning','buyer','bathrooms','Number of bathrooms','number',true,false,4),
  ('home-cleaning','buyer','cleaning_type','Cleaning type','select',true,false,5),
  ('home-cleaning','buyer','recurring','One-time or recurring','select',true,false,6),
  ('home-cleaning','buyer','supplies_required','Supplies required','boolean',false,false,7),
  ('home-cleaning','buyer','access_instructions','Access instructions','textarea',false,true,8),
  ('home-cleaning','buyer','special_requests','Special requests','textarea',false,false,9),
  ('home-cleaning','buyer','contact_number','Contact number','phone',true,true,10),
  -- CAR DETAILING
  ('car-detailing','provider','services_offered','Services offered','textarea',true,false,1),
  ('car-detailing','provider','vehicle_types','Vehicle types supported','multiselect',true,false,2),
  ('car-detailing','provider','mobile_service','Mobile service available','boolean',false,false,3),
  ('car-detailing','provider','service_location','Service location','text',true,false,4),
  ('car-detailing','provider','duration','Duration (minutes)','number',true,false,5),
  ('car-detailing','provider','price','Price','number',true,false,6),
  ('car-detailing','provider','available_days','Available days','multiselect',false,false,7),
  ('car-detailing','provider','utilities_required','Water and electricity requirements','textarea',false,false,8),
  ('car-detailing','buyer','vehicle_type','Vehicle type','select',true,false,1),
  ('car-detailing','buyer','vehicle_make_model','Vehicle make and model','text',true,false,2),
  ('car-detailing','buyer','package','Selected package','text',true,false,3),
  ('car-detailing','buyer','service_location','Service location','text',true,true,4),
  ('car-detailing','buyer','mobile_required','Mobile service required','boolean',false,false,5),
  ('car-detailing','buyer','condition_notes','Condition notes','textarea',false,false,6),
  ('car-detailing','buyer','photos','Upload vehicle photos','images',false,false,7),
  ('car-detailing','buyer','contact_number','Contact number','phone',true,true,8),
  -- TUTORING
  ('tutoring','provider','subjects','Subjects','multiselect',true,false,1),
  ('tutoring','provider','age_groups','Student age groups','multiselect',true,false,2),
  ('tutoring','provider','education_levels','Education levels','multiselect',true,false,3),
  ('tutoring','provider','delivery_mode','Online or in-person','select',true,false,4),
  ('tutoring','provider','session_duration','Session duration (minutes)','number',true,false,5),
  ('tutoring','provider','price','Price','number',true,false,6),
  ('tutoring','provider','areas_served','Areas served','multiselect',false,false,7),
  ('tutoring','provider','available_days','Available days','multiselect',false,false,8),
  ('tutoring','provider','group_sessions','Group-session option','boolean',false,false,9),
  ('tutoring','buyer','subject','Subject','text',true,false,1),
  ('tutoring','buyer','student_age','Student age','number',true,true,2),
  ('tutoring','buyer','education_level','Education level','select',true,false,3),
  ('tutoring','buyer','topic','Topic requiring help','textarea',true,false,4),
  ('tutoring','buyer','delivery_mode','Online or in-person','select',true,false,5),
  ('tutoring','buyer','session_length','Session length (minutes)','number',true,false,6),
  ('tutoring','buyer','learning_goals','Learning goals','textarea',false,false,7),
  ('tutoring','buyer','notes','Special notes','textarea',false,false,8),
  ('tutoring','buyer','contact_number','Contact number','phone',true,true,9),
  -- PET CARE
  ('pet-care','provider','services_offered','Services offered','textarea',true,false,1),
  ('pet-care','provider','animal_types','Animal types accepted','multiselect',true,false,2),
  ('pet-care','provider','areas_served','Areas served','multiselect',true,false,3),
  ('pet-care','provider','home_visits','Home visits available','boolean',false,false,4),
  ('pet-care','provider','overnight_care','Overnight care available','boolean',false,false,5),
  ('pet-care','provider','price','Price','number',true,false,6),
  ('pet-care','provider','available_days','Available days','multiselect',false,false,7),
  ('pet-care','provider','emergency_procedure','Emergency contact procedure','textarea',false,false,8),
  ('pet-care','buyer','pet_type','Pet type','select',true,false,1),
  ('pet-care','buyer','breed','Breed','text',false,false,2),
  ('pet-care','buyer','age','Age','text',false,false,3),
  ('pet-care','buyer','pet_count','Number of pets','number',true,false,4),
  ('pet-care','buyer','service_required','Service required','text',true,false,5),
  ('pet-care','buyer','feeding_instructions','Feeding instructions','textarea',false,true,6),
  ('pet-care','buyer','medication','Medication information','textarea',false,true,7),
  ('pet-care','buyer','behaviour_notes','Behaviour notes','textarea',false,true,8),
  ('pet-care','buyer','emergency_contact','Emergency contact','text',true,true,9),
  ('pet-care','buyer','contact_number','Contact number','phone',true,true,10),
  -- CHILDCARE
  ('childcare','provider','age_groups','Child age groups accepted','multiselect',true,false,1),
  ('childcare','provider','experience','Experience','textarea',true,false,2),
  ('childcare','provider','certifications','Certifications','textarea',false,false,3),
  ('childcare','provider','areas_served','Areas served','multiselect',true,false,4),
  ('childcare','provider','home_service','Home-service availability','boolean',false,false,5),
  ('childcare','provider','available_days','Available days','multiselect',false,false,6),
  ('childcare','provider','available_times','Available times','text',false,false,7),
  ('childcare','provider','hourly_rate','Hourly rate','number',true,false,8),
  ('childcare','provider','minimum_booking','Minimum booking time (hours)','number',false,false,9),
  ('childcare','provider','max_children','Maximum number of children','number',false,false,10),
  ('childcare','provider','emergency_procedure','Emergency procedure','textarea',false,false,11),
  ('childcare','buyer','children_count','Number of children','number',true,true,1),
  ('childcare','buyer','children_ages','Children''s ages','text',true,true,2),
  ('childcare','buyer','end_time','End time','time',true,false,3),
  ('childcare','buyer','location','Location','text',true,true,4),
  ('childcare','buyer','guardian_name','Parent or guardian name','text',true,true,5),
  ('childcare','buyer','guardian_contact','Parent or guardian contact','phone',true,true,6),
  ('childcare','buyer','emergency_contact','Emergency contact','text',true,true,7),
  ('childcare','buyer','care_information','Allergies or important care information','textarea',false,true,8),
  ('childcare','buyer','meal_instructions','Meal instructions','textarea',false,true,9),
  ('childcare','buyer','bedtime_instructions','Bedtime instructions','textarea',false,true,10),
  ('childcare','buyer','special_requirements','Special requirements','textarea',false,true,11),
  -- TECH SUPPORT
  ('tech-support','provider','services_offered','Services offered','textarea',true,false,1),
  ('tech-support','provider','device_types','Device types supported','multiselect',true,false,2),
  ('tech-support','provider','support_mode','Remote or on-site support','select',true,false,3),
  ('tech-support','provider','areas_served','Areas served','multiselect',false,false,4),
  ('tech-support','provider','pricing_method','Pricing method','select',true,false,5),
  ('tech-support','provider','available_days','Available days','multiselect',false,false,6),
  ('tech-support','provider','response_time','Estimated response time','text',false,false,7),
  ('tech-support','buyer','device_type','Device type','select',true,false,1),
  ('tech-support','buyer','device_brand_model','Device brand and model','text',true,false,2),
  ('tech-support','buyer','problem','Problem description','textarea',true,false,3),
  ('tech-support','buyer','support_mode','Remote or on-site help','select',true,false,4),
  ('tech-support','buyer','location','Location','text',false,true,5),
  ('tech-support','buyer','photos','Upload screenshots or photos','images',false,true,6),
  ('tech-support','buyer','urgency','Urgency','select',false,false,7),
  ('tech-support','buyer','contact_number','Contact number','phone',true,true,8)
) AS f(slug, audience, field_key, label, field_type, required, sensitive, sort_order)
  ON f.slug = c.slug
ON CONFLICT (category_id, audience, field_key) DO NOTHING;