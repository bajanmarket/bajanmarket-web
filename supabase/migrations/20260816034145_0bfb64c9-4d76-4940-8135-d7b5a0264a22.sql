-- ============ ENUMS ============
CREATE TYPE public.seller_pipeline_stage AS ENUM (
  'discovered','verification_required','qualified','ready_for_outreach','awaiting_approval',
  'contacted','replied','demo_scheduled','onboarding','trial_active','activated_seller',
  'declined','suppressed'
);
CREATE TYPE public.seller_record_mode AS ENUM ('demo','simulation','live');
CREATE TYPE public.seller_verification_status AS ENUM ('unverified','needs_review','verified','rejected','duplicate_suspected');
CREATE TYPE public.seller_outreach_channel AS ENUM ('email','whatsapp','facebook','instagram','phone','in_person','other');
CREATE TYPE public.seller_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.seller_approval_status AS ENUM ('pending','approved','edited_approved','rejected','archived');
CREATE TYPE public.seller_task_status AS ENUM ('open','in_progress','done','cancelled');

-- ============ CORE: PROSPECTS ============
CREATE TABLE public.seller_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_mode public.seller_record_mode NOT NULL DEFAULT 'simulation',
  business_name text NOT NULL,
  business_name_norm text GENERATED ALWAYS AS (lower(regexp_replace(business_name, '[^a-zA-Z0-9]', '', 'g'))) STORED,
  contact_name text,
  seller_type text,
  marketplace_category text,
  parish text,
  location_note text,
  website_url text,
  website_domain text,
  facebook_url text,
  instagram_url text,
  other_source_url text,
  public_phone text,
  public_whatsapp text,
  public_email text,
  visible_product_count integer,
  estimated_potential_listings integer,
  posting_frequency text,
  facebook_group_activity text,
  audience_estimate integer,
  delivery_available boolean,
  has_existing_website boolean,
  bajanmarket_account_status text NOT NULL DEFAULT 'unknown',
  verification_status public.seller_verification_status NOT NULL DEFAULT 'unverified',
  lead_score integer,
  priority public.seller_priority NOT NULL DEFAULT 'medium',
  pipeline_stage public.seller_pipeline_stage NOT NULL DEFAULT 'discovered',
  preferred_channel public.seller_outreach_channel,
  assigned_admin_id uuid,
  last_contact_at timestamptz,
  next_followup_at timestamptz,
  opted_out boolean NOT NULL DEFAULT false,
  suppression_reason text,
  duplicate_of_id uuid REFERENCES public.seller_prospects(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_seller_prospects_stage ON public.seller_prospects(pipeline_stage);
CREATE INDEX idx_seller_prospects_mode ON public.seller_prospects(record_mode);
CREATE UNIQUE INDEX uq_seller_prospects_name_norm ON public.seller_prospects(business_name_norm) WHERE duplicate_of_id IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_prospects TO authenticated;
GRANT ALL ON public.seller_prospects TO service_role;
ALTER TABLE public.seller_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prospects" ON public.seller_prospects FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_seller_prospects_updated BEFORE UPDATE ON public.seller_prospects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SOURCES / CONTACTS / SCORES ============
CREATE TABLE public.seller_prospect_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  claim text NOT NULL,
  source_url text,
  source_type text,
  researched_at timestamptz NOT NULL DEFAULT now(),
  researched_by uuid,
  confidence text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_prospect_sources TO authenticated;
GRANT ALL ON public.seller_prospect_sources TO service_role;
ALTER TABLE public.seller_prospect_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prospect sources" ON public.seller_prospect_sources FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.seller_prospect_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  channel public.seller_outreach_channel NOT NULL,
  value text NOT NULL,
  value_norm text GENERATED ALWAYS AS (lower(regexp_replace(value, '[^a-zA-Z0-9@.]', '', 'g'))) STORED,
  label text,
  is_public_business_contact boolean NOT NULL DEFAULT true,
  source_url text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, channel, value)
);
CREATE INDEX idx_prospect_contacts_norm ON public.seller_prospect_contacts(value_norm);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_prospect_contacts TO authenticated;
GRANT ALL ON public.seller_prospect_contacts TO service_role;
ALTER TABLE public.seller_prospect_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prospect contacts" ON public.seller_prospect_contacts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_prospect_contacts_updated BEFORE UPDATE ON public.seller_prospect_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  weight integer NOT NULL DEFAULT 10,
  max_points integer NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_scoring_rules TO authenticated;
GRANT ALL ON public.seller_scoring_rules TO service_role;
ALTER TABLE public.seller_scoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scoring rules" ON public.seller_scoring_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_scoring_rules_updated BEFORE UPDATE ON public.seller_scoring_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_prospect_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  total_score integer NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_evidence text[] NOT NULL DEFAULT '{}',
  recommended_priority public.seller_priority,
  recommended_channel public.seller_outreach_channel,
  explanation text,
  computed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prospect_scores_prospect ON public.seller_prospect_scores(prospect_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_prospect_scores TO authenticated;
GRANT ALL ON public.seller_prospect_scores TO service_role;
ALTER TABLE public.seller_prospect_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prospect scores" ON public.seller_prospect_scores FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- ============ PIPELINE HISTORY (immutable) ============
CREATE TABLE public.seller_pipeline_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  from_stage public.seller_pipeline_stage,
  to_stage public.seller_pipeline_stage NOT NULL,
  changed_by uuid,
  actor text NOT NULL DEFAULT 'admin',
  reason text,
  approval_request_id uuid,
  outreach_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_history_prospect ON public.seller_pipeline_history(prospect_id, created_at DESC);
GRANT SELECT, INSERT ON public.seller_pipeline_history TO authenticated;
GRANT ALL ON public.seller_pipeline_history TO service_role;
ALTER TABLE public.seller_pipeline_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pipeline history" ON public.seller_pipeline_history FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins insert pipeline history" ON public.seller_pipeline_history FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- ============ RESEARCH TASKS ============
CREATE TABLE public.seller_research_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_mode public.seller_record_mode NOT NULL DEFAULT 'simulation',
  prospect_id uuid REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  category text,
  seller_type text,
  parish text,
  source_hint text,
  status public.seller_task_status NOT NULL DEFAULT 'open',
  assigned_admin_id uuid,
  result_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_research_tasks TO authenticated;
GRANT ALL ON public.seller_research_tasks TO service_role;
ALTER TABLE public.seller_research_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage research tasks" ON public.seller_research_tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_research_tasks_updated BEFORE UPDATE ON public.seller_research_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PLAYBOOKS ============
CREATE TABLE public.seller_outreach_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  seller_type text,
  value_proposition text NOT NULL DEFAULT '',
  initial_template text NOT NULL DEFAULT '',
  followup_1_template text NOT NULL DEFAULT '',
  followup_final_template text NOT NULL DEFAULT '',
  recommended_channel public.seller_outreach_channel NOT NULL DEFAULT 'email',
  followup_interval_days integer NOT NULL DEFAULT 4,
  max_attempts integer NOT NULL DEFAULT 3,
  requires_approval boolean NOT NULL DEFAULT true,
  onboarding_offer text,
  required_info text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_outreach_playbooks TO authenticated;
GRANT ALL ON public.seller_outreach_playbooks TO service_role;
ALTER TABLE public.seller_outreach_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage playbooks" ON public.seller_outreach_playbooks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_playbooks_updated BEFORE UPDATE ON public.seller_outreach_playbooks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ OUTREACH ============
CREATE TABLE public.seller_outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_mode public.seller_record_mode NOT NULL DEFAULT 'simulation',
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  playbook_id uuid REFERENCES public.seller_outreach_playbooks(id) ON DELETE SET NULL,
  sequence_step text NOT NULL DEFAULT 'initial',
  channel public.seller_outreach_channel NOT NULL,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  risk_warnings text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_outreach_drafts TO authenticated;
GRANT ALL ON public.seller_outreach_drafts TO service_role;
ALTER TABLE public.seller_outreach_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage outreach drafts" ON public.seller_outreach_drafts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_outreach_drafts_updated BEFORE UPDATE ON public.seller_outreach_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_mode public.seller_record_mode NOT NULL DEFAULT 'simulation',
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.seller_outreach_drafts(id) ON DELETE SET NULL,
  request_type text NOT NULL DEFAULT 'first_contact',
  status public.seller_approval_status NOT NULL DEFAULT 'pending',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  duplicate_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_warnings text[] NOT NULL DEFAULT '{}',
  recommended_action text,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_approval_requests TO authenticated;
GRANT ALL ON public.seller_approval_requests TO service_role;
ALTER TABLE public.seller_approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage approval requests" ON public.seller_approval_requests FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_approval_requests_updated BEFORE UPDATE ON public.seller_approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_mode public.seller_record_mode NOT NULL DEFAULT 'simulation',
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.seller_outreach_drafts(id) ON DELETE SET NULL,
  approval_request_id uuid REFERENCES public.seller_approval_requests(id) ON DELETE SET NULL,
  channel public.seller_outreach_channel NOT NULL,
  sequence_step text NOT NULL DEFAULT 'initial',
  recipient text,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  simulated boolean NOT NULL DEFAULT true,
  idempotency_key text NOT NULL UNIQUE,
  provider_message_id text,
  error text,
  sent_at timestamptz,
  replied_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outreach_messages_prospect ON public.seller_outreach_messages(prospect_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_outreach_messages TO authenticated;
GRANT ALL ON public.seller_outreach_messages TO service_role;
ALTER TABLE public.seller_outreach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage outreach messages" ON public.seller_outreach_messages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_outreach_messages_updated BEFORE UPDATE ON public.seller_outreach_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.seller_outreach_messages(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  channel public.seller_outreach_channel,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.seller_outreach_events TO authenticated;
GRANT ALL ON public.seller_outreach_events TO service_role;
ALTER TABLE public.seller_outreach_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read outreach events" ON public.seller_outreach_events FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins insert outreach events" ON public.seller_outreach_events FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.seller_followup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_mode public.seller_record_mode NOT NULL DEFAULT 'simulation',
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  playbook_id uuid REFERENCES public.seller_outreach_playbooks(id) ON DELETE SET NULL,
  sequence_step text NOT NULL DEFAULT 'followup_1',
  channel public.seller_outreach_channel,
  due_at timestamptz NOT NULL,
  status public.seller_task_status NOT NULL DEFAULT 'open',
  cancelled_reason text,
  assigned_admin_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_followup_tasks_due ON public.seller_followup_tasks(status, due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_followup_tasks TO authenticated;
GRANT ALL ON public.seller_followup_tasks TO service_role;
ALTER TABLE public.seller_followup_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage followup tasks" ON public.seller_followup_tasks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_followup_tasks_updated BEFORE UPDATE ON public.seller_followup_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SUPPRESSIONS ============
CREATE TABLE public.seller_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.seller_prospects(id) ON DELETE SET NULL,
  match_type text NOT NULL,
  match_value text NOT NULL,
  match_value_norm text GENERATED ALWAYS AS (lower(regexp_replace(match_value, '[^a-zA-Z0-9@.]', '', 'g'))) STORED,
  reason text NOT NULL,
  permanent boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_type, match_value)
);
CREATE INDEX idx_suppressions_norm ON public.seller_suppressions(match_value_norm);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_suppressions TO authenticated;
GRANT ALL ON public.seller_suppressions TO service_role;
ALTER TABLE public.seller_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage suppressions" ON public.seller_suppressions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- ============ ONBOARDING ============
CREATE TABLE public.seller_onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_mode public.seller_record_mode NOT NULL DEFAULT 'simulation',
  prospect_id uuid NOT NULL REFERENCES public.seller_prospects(id) ON DELETE CASCADE,
  seller_user_id uuid,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  invite_token text NOT NULL UNIQUE,
  invite_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at timestamptz,
  status text NOT NULL DEFAULT 'invited',
  prefilled jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_confirmed boolean NOT NULL DEFAULT false,
  logo_permission_granted boolean NOT NULL DEFAULT false,
  content_permission_granted boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_onboarding_sessions TO authenticated;
GRANT ALL ON public.seller_onboarding_sessions TO service_role;
ALTER TABLE public.seller_onboarding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage onboarding sessions" ON public.seller_onboarding_sessions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Invited seller reads own session" ON public.seller_onboarding_sessions FOR SELECT TO authenticated
  USING (seller_user_id = auth.uid());
CREATE POLICY "Invited seller updates own session" ON public.seller_onboarding_sessions FOR UPDATE TO authenticated
  USING (seller_user_id = auth.uid()) WITH CHECK (seller_user_id = auth.uid());
CREATE TRIGGER trg_onboarding_sessions_updated BEFORE UPDATE ON public.seller_onboarding_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.seller_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.seller_onboarding_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price numeric,
  currency text NOT NULL DEFAULT 'BBD',
  image_urls text[] NOT NULL DEFAULT '{}',
  category_hint text,
  missing_fields text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  published_listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, title)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_onboarding_items TO authenticated;
GRANT ALL ON public.seller_onboarding_items TO service_role;
ALTER TABLE public.seller_onboarding_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage onboarding items" ON public.seller_onboarding_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Invited seller manages own onboarding items" ON public.seller_onboarding_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.seller_onboarding_sessions s WHERE s.id = session_id AND s.seller_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.seller_onboarding_sessions s WHERE s.id = session_id AND s.seller_user_id = auth.uid()));
CREATE TRIGGER trg_onboarding_items_updated BEFORE UPDATE ON public.seller_onboarding_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SETTINGS + AUDIT ============
CREATE TABLE public.seller_growth_settings (
  id integer PRIMARY KEY DEFAULT 1,
  simulation_mode boolean NOT NULL DEFAULT true,
  global_outreach_paused boolean NOT NULL DEFAULT true,
  live_sending_enabled boolean NOT NULL DEFAULT false,
  email_paused boolean NOT NULL DEFAULT true,
  whatsapp_paused boolean NOT NULL DEFAULT true,
  social_paused boolean NOT NULL DEFAULT true,
  daily_contact_limit integer NOT NULL DEFAULT 20,
  weekly_contact_limit integer NOT NULL DEFAULT 80,
  business_hours_start smallint NOT NULL DEFAULT 9,
  business_hours_end smallint NOT NULL DEFAULT 17,
  timezone text NOT NULL DEFAULT 'America/Barbados',
  max_contact_attempts integer NOT NULL DEFAULT 3,
  test_recipients text[] NOT NULL DEFAULT '{}',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_growth_settings_single_row CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.seller_growth_settings TO authenticated;
GRANT ALL ON public.seller_growth_settings TO service_role;
ALTER TABLE public.seller_growth_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage growth settings" ON public.seller_growth_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_growth_settings_updated BEFORE UPDATE ON public.seller_growth_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.seller_growth_settings (id) VALUES (1);

CREATE TABLE public.seller_growth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_kind text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_growth_audit_created ON public.seller_growth_audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.seller_growth_audit_log TO authenticated;
GRANT ALL ON public.seller_growth_audit_log TO service_role;
ALTER TABLE public.seller_growth_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read growth audit" ON public.seller_growth_audit_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins insert growth audit" ON public.seller_growth_audit_log FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'::app_role));

-- ============ SEED: SCORING RULES ============
INSERT INTO public.seller_scoring_rules (key, label, description, weight, max_points, sort_order) VALUES
 ('listing_volume','Estimated listing volume','Estimated number of items the seller could list',15,15,1),
 ('posting_frequency','Posting frequency','How often the business posts new items publicly',12,12,2),
 ('group_activity','Multi-group activity','Active across multiple public buy/sell groups',8,8,3),
 ('audience_engagement','Audience engagement','Followers and visible engagement on public pages',10,10,4),
 ('photo_quality','Product photo quality','Quality of publicly visible product photography',8,8,5),
 ('verification_strength','Business verification strength','Strength of public proof the business is real and active',12,12,6),
 ('delivery_available','Delivery availability','Business offers delivery',5,5,7),
 ('no_ecommerce','No existing storefront','No existing e-commerce storefront to compete with',10,10,8),
 ('category_fit','Under-supplied category fit','Fills a category BajanMarket is short on',12,12,9),
 ('info_completeness','Public info completeness','Completeness of publicly listed business information',8,8,10);

-- ============ SEED: PLAYBOOKS ============
INSERT INTO public.seller_outreach_playbooks (key, name, seller_type, value_proposition, initial_template, followup_1_template, followup_final_template, recommended_channel, followup_interval_days, max_attempts, onboarding_offer, required_info, sort_order) VALUES
 ('facebook_power_seller','Facebook power sellers','facebook_power_seller','A dedicated Barbados marketplace listing page that stays searchable instead of disappearing down a group feed.','Hi {{contact_name}} — I run BajanMarket, a Barbados-only marketplace. I saw {{business_name}} posting regularly in local buy/sell groups. Would you be open to a quick look at a free seller profile where your items stay searchable?','Hi {{contact_name}}, following up on BajanMarket for {{business_name}}. Happy to set the profile up for you and show you how it works — no cost.','Hi {{contact_name}}, last note from me on this. If BajanMarket is useful for {{business_name}} later, just reply and I''ll get you set up.','facebook',4,3,'Free seller profile setup and help listing your first items.','{"Business name","Best contact","Items to list"}',1),
 ('instagram_business','Instagram businesses','instagram_business','A searchable product catalogue for Barbados shoppers who can''t search Instagram posts.','Hi {{contact_name}} — I run BajanMarket, a Barbados marketplace. Your {{business_name}} page caught my eye. Would you like a free seller profile so local shoppers can search your products directly?','Hi {{contact_name}}, just checking in about a free BajanMarket profile for {{business_name}}. I can help load your first items.','Hi {{contact_name}}, I''ll leave it here — reply any time if you''d like a BajanMarket profile for {{business_name}}.','instagram',4,3,'Free profile plus help loading your first items.','{"Business name","Best contact","Product photos"}',2),
 ('vehicle_dealer','Vehicle dealers','vehicle_dealer','A dedicated vehicle storefront for Barbados buyers, with your whole lot in one searchable place.','Good day — I''m with BajanMarket, a Barbados marketplace. We''re building out our vehicle section and would like to include {{business_name}}. Could I show you how a dealer storefront would work?','Following up on a BajanMarket dealer storefront for {{business_name}} — happy to walk through it whenever suits.','Last follow-up on this — if a BajanMarket dealer storefront is useful for {{business_name}} down the line, just reply.','email',5,3,'Dealer storefront setup with assistance listing current stock.','{"Dealership name","Contact person","Current stock list"}',3),
 ('real_estate_agent','Real-estate agents','real_estate_agent','Local property listings in front of Barbados buyers already browsing the marketplace.','Good day — I''m with BajanMarket, a Barbados marketplace. We''re adding property listings and would like to include {{business_name}}. Could I show you how it works?','Following up on BajanMarket property listings for {{business_name}}.','Last note on this — reply any time if listings on BajanMarket would help {{business_name}}.','email',5,3,'Agent profile with assisted listing setup.','{"Agency name","Agent contact","Current listings"}',4),
 ('established_retailer','Established retailers','retailer','An online sales channel without building or maintaining your own website.','Good day — I''m with BajanMarket, a Barbados marketplace. Would {{business_name}} be interested in an online storefront that we set up for you?','Following up about a BajanMarket storefront for {{business_name}} — setup is on us.','Last follow-up — happy to help whenever {{business_name}} is ready.','email',5,3,'Storefront setup and first product upload assistance.','{"Business name","Contact person","Product range"}',5),
 ('service_provider','Service providers','service_provider','Bookable service listings with a calendar Barbados customers can use directly.','Good day — I''m with BajanMarket, a Barbados marketplace with online booking. Would {{business_name}} like a bookable service profile?','Following up on a bookable BajanMarket profile for {{business_name}}.','Last note — reply any time if online bookings would help {{business_name}}.','whatsapp',4,3,'Service profile with booking calendar setup.','{"Business name","Services offered","Availability"}',6),
 ('restaurant_food','Restaurants and food vendors','restaurant','A local listing page for your menu and specials that Barbados customers can find and contact.','Good day — I''m with BajanMarket, a Barbados marketplace. Would {{business_name}} like a free listing page for your menu and specials?','Just following up about a BajanMarket page for {{business_name}}.','Last follow-up — reply any time and I''ll set it up for {{business_name}}.','whatsapp',4,3,'Free menu listing page setup.','{"Business name","Menu","Contact number"}',7),
 ('home_service','Home-service businesses','home_service','Steady local job enquiries from Barbados customers searching for your trade.','Good day — I''m with BajanMarket, a Barbados marketplace. Customers search for {{seller_type}} work here. Would {{business_name}} like a free service profile?','Following up on a free BajanMarket service profile for {{business_name}}.','Last note on this — reply any time if it would help {{business_name}}.','whatsapp',4,3,'Free service profile with booking setup.','{"Business name","Services and areas covered","Contact number"}',8),
 ('general_seller','Other marketplace sellers','general','A simple, searchable place to sell to Barbados shoppers.','Hi {{contact_name}} — I run BajanMarket, a Barbados marketplace. Would {{business_name}} be interested in a free seller profile?','Following up about a free BajanMarket seller profile for {{business_name}}.','Last note from me — reply any time if you''d like to get set up.','email',4,3,'Free seller profile setup.','{"Business name","Best contact","Items to list"}',9);

-- ============ SEED: RESEARCH PROSPECTS (non-live) ============
INSERT INTO public.seller_prospects
 (record_mode, business_name, seller_type, marketplace_category, pipeline_stage, verification_status, priority, notes, bajanmarket_account_status)
VALUES
 ('simulation','KAGS Auto Dealers','vehicle_dealer','vehicles','discovered','unverified','high','Research record supplied by administrator. Contact details require verification before any outreach.','unknown'),
 ('simulation','Barbados Auto Dealers','vehicle_dealer','vehicles','discovered','unverified','high','Research record supplied by administrator. Contact details require verification before any outreach.','unknown'),
 ('simulation','KingAuto','vehicle_dealer','vehicles','discovered','unverified','medium','Research record supplied by administrator. Contact details require verification before any outreach.','unknown'),
 ('simulation','Carzone Inc','vehicle_dealer','vehicles','discovered','unverified','medium','Research record supplied by administrator. Contact details require verification before any outreach.','unknown'),
 ('simulation','West ''N'' Motors Auto','vehicle_dealer','vehicles','discovered','unverified','medium','Research record supplied by administrator. Contact details require verification before any outreach.','unknown'),
 ('simulation','Bim Auto Sales','vehicle_dealer','vehicles','discovered','unverified','medium','Research record supplied by administrator. Contact details require verification before any outreach.','unknown'),
 ('simulation','Pioneer Motors','vehicle_dealer','vehicles','discovered','unverified','medium','Research record supplied by administrator. Contact details require verification before any outreach.','unknown'),
 ('simulation','QV Motors','vehicle_dealer','vehicles','discovered','unverified','medium','Research record supplied by administrator. Contact details require verification before any outreach.','unknown');

INSERT INTO public.seller_pipeline_history (prospect_id, from_stage, to_stage, actor, reason)
SELECT id, NULL, 'discovered', 'seed', 'Seeded as administrator-supplied research record'
FROM public.seller_prospects WHERE record_mode = 'simulation';