export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attribution_campaigns: {
        Row: {
          archived_at: string | null
          channel: string
          code: string
          cost_cents: number
          created_at: string
          destination_path: string
          id: string
          name: string
          notes: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          channel: string
          code: string
          cost_cents?: number
          created_at?: string
          destination_path?: string
          id?: string
          name: string
          notes?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          channel?: string
          code?: string
          cost_cents?: number
          created_at?: string
          destination_path?: string
          id?: string
          name?: string
          notes?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_answers: {
        Row: {
          booking_id: string
          created_at: string
          field_key: string
          id: string
          label: string | null
          sensitive: boolean
          value: Json
        }
        Insert: {
          booking_id: string
          created_at?: string
          field_key: string
          id?: string
          label?: string | null
          sensitive?: boolean
          value?: Json
        }
        Update: {
          booking_id?: string
          created_at?: string
          field_key?: string
          id?: string
          label?: string | null
          sensitive?: boolean
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "booking_answers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          buyer_contact_phone: string | null
          buyer_id: string
          buyer_note: string | null
          cancelled_reason: string | null
          category_id: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          ends_at: string
          id: string
          location: string | null
          price: number
          provider_id: string
          provider_note: string | null
          reference: string
          requested_starts_at: string | null
          service_listing_id: string
          starts_at: string
          status: Database["public"]["Enums"]["booking_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          buyer_contact_phone?: string | null
          buyer_id: string
          buyer_note?: string | null
          cancelled_reason?: string | null
          category_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: string
          ends_at: string
          id?: string
          location?: string | null
          price?: number
          provider_id: string
          provider_note?: string | null
          reference?: string
          requested_starts_at?: string | null
          service_listing_id: string
          starts_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          buyer_contact_phone?: string | null
          buyer_id?: string
          buyer_note?: string | null
          cancelled_reason?: string | null
          category_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: string
          ends_at?: string
          id?: string
          location?: string | null
          price?: number
          provider_id?: string
          provider_note?: string | null
          reference?: string
          requested_starts_at?: string | null
          service_listing_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_listing_id_fkey"
            columns: ["service_listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      business_reviews: {
        Row: {
          body: string | null
          business_id: string
          created_at: string
          id: string
          rating: number
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string
          id?: string
          rating: number
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string
          id?: string
          rating?: number
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          banner_url: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          hours: Json | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          parish: string | null
          rejection_reason: string | null
          slug: string
          status: string
          tagline: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          parish?: string | null
          rejection_reason?: string | null
          slug: string
          status?: string
          tagline?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          parish?: string | null
          rejection_reason?: string | null
          slug?: string
          status?: string
          tagline?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      buyer_activity_events: {
        Row: {
          category_id: string | null
          event_type: string
          id: string
          listing_id: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          event_type?: string
          id?: string
          listing_id?: string | null
          occurred_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          event_type?: string
          id?: string
          listing_id?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_activity_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_activity_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_activity_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_intents: {
        Row: {
          active: boolean
          attributes: Json
          category_id: string | null
          created_at: string
          first_seen: string
          id: string
          intent_key: string
          intent_score: number
          keywords: string[]
          last_seen: string
          max_price: number | null
          min_price: number | null
          normalized_query: string
          preferred_condition:
            | Database["public"]["Enums"]["listing_condition"]
            | null
          preferred_parish: Database["public"]["Enums"]["parish"] | null
          raw_queries: string[]
          signal_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          attributes?: Json
          category_id?: string | null
          created_at?: string
          first_seen?: string
          id?: string
          intent_key: string
          intent_score?: number
          keywords?: string[]
          last_seen?: string
          max_price?: number | null
          min_price?: number | null
          normalized_query: string
          preferred_condition?:
            | Database["public"]["Enums"]["listing_condition"]
            | null
          preferred_parish?: Database["public"]["Enums"]["parish"] | null
          raw_queries?: string[]
          signal_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          attributes?: Json
          category_id?: string | null
          created_at?: string
          first_seen?: string
          id?: string
          intent_key?: string
          intent_score?: number
          keywords?: string[]
          last_seen?: string
          max_price?: number | null
          min_price?: number | null
          normalized_query?: string
          preferred_condition?:
            | Database["public"]["Enums"]["listing_condition"]
            | null
          preferred_parish?: Database["public"]["Enums"]["parish"] | null
          raw_queries?: string[]
          signal_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_intents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          error: string | null
          id: string
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body_html: string
          body_text: string
          channel: string
          created_at: string
          created_by: string
          failed_count: number
          filters: Json
          id: string
          name: string
          recipients_count: number
          sent_at: string | null
          sent_count: number
          status: string
          subject: string
        }
        Insert: {
          body_html?: string
          body_text?: string
          channel?: string
          created_at?: string
          created_by: string
          failed_count?: number
          filters?: Json
          id?: string
          name: string
          recipients_count?: number
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject: string
        }
        Update: {
          body_html?: string
          body_text?: string
          channel?: string
          created_at?: string
          created_by?: string
          failed_count?: number
          filters?: Json
          id?: string
          name?: string
          recipients_count?: number
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          icon: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      ci_category_stats: {
        Row: {
          active_inventory: number
          avg_price_cents: number | null
          avg_time_to_sell_hours: number | null
          category_id: string
          median_price_cents: number | null
          recommended_post_dow: number | null
          recommended_post_hour: number | null
          recommended_price_cents: number | null
          trending_score: number
          updated_at: string
        }
        Insert: {
          active_inventory?: number
          avg_price_cents?: number | null
          avg_time_to_sell_hours?: number | null
          category_id: string
          median_price_cents?: number | null
          recommended_post_dow?: number | null
          recommended_post_hour?: number | null
          recommended_price_cents?: number | null
          trending_score?: number
          updated_at?: string
        }
        Update: {
          active_inventory?: number
          avg_price_cents?: number | null
          avg_time_to_sell_hours?: number | null
          category_id?: string
          median_price_cents?: number | null
          recommended_post_dow?: number | null
          recommended_post_hour?: number | null
          recommended_price_cents?: number | null
          trending_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      ci_daily_stats: {
        Row: {
          day: string
          favourites: number
          messages: number
          orders: number
          revenue_cents: number
          seller_id: string
          shares: number
          unique_visitors: number
          updated_at: string
          views: number
        }
        Insert: {
          day: string
          favourites?: number
          messages?: number
          orders?: number
          revenue_cents?: number
          seller_id: string
          shares?: number
          unique_visitors?: number
          updated_at?: string
          views?: number
        }
        Update: {
          day?: string
          favourites?: number
          messages?: number
          orders?: number
          revenue_cents?: number
          seller_id?: string
          shares?: number
          unique_visitors?: number
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      ci_events: {
        Row: {
          actor_id: string | null
          browser: string | null
          business_id: string | null
          campaign_code: string | null
          campaign_id: string | null
          category_id: string | null
          created_at: string
          device: string | null
          event_type: string
          id: string
          listing_id: string | null
          medium: string | null
          metadata: Json
          occurred_at: string
          parish: string | null
          path: string | null
          referrer: string | null
          seller_id: string | null
          session_id: string | null
          source: string | null
        }
        Insert: {
          actor_id?: string | null
          browser?: string | null
          business_id?: string | null
          campaign_code?: string | null
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          device?: string | null
          event_type: string
          id?: string
          listing_id?: string | null
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          parish?: string | null
          path?: string | null
          referrer?: string | null
          seller_id?: string | null
          session_id?: string | null
          source?: string | null
        }
        Update: {
          actor_id?: string | null
          browser?: string | null
          business_id?: string | null
          campaign_code?: string | null
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          device?: string | null
          event_type?: string
          id?: string
          listing_id?: string | null
          medium?: string | null
          metadata?: Json
          occurred_at?: string
          parish?: string | null
          path?: string | null
          referrer?: string | null
          seller_id?: string | null
          session_id?: string | null
          source?: string | null
        }
        Relationships: []
      }
      ci_listing_stats: {
        Row: {
          favourites: number
          first_sold_at: string | null
          listing_id: string
          messages: number
          seller_id: string
          shares: number
          time_to_sale_hours: number | null
          updated_at: string
          views: number
        }
        Insert: {
          favourites?: number
          first_sold_at?: string | null
          listing_id: string
          messages?: number
          seller_id: string
          shares?: number
          time_to_sale_hours?: number | null
          updated_at?: string
          views?: number
        }
        Update: {
          favourites?: number
          first_sold_at?: string | null
          listing_id?: string
          messages?: number
          seller_id?: string
          shares?: number
          time_to_sale_hours?: number | null
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      ci_orders: {
        Row: {
          amount_cents: number
          attribution_campaign_id: string | null
          buyer_id: string | null
          conversation_id: string | null
          created_at: string
          currency: string
          id: string
          listing_id: string | null
          notes: string | null
          seller_id: string
          sold_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          attribution_campaign_id?: string | null
          buyer_id?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          seller_id: string
          sold_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          attribution_campaign_id?: string | null
          buyer_id?: string | null
          conversation_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          seller_id?: string
          sold_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_orders_attribution_campaign_id_fkey"
            columns: ["attribution_campaign_id"]
            isOneToOne: false
            referencedRelation: "attribution_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_trust_scores: {
        Row: {
          breakdown: Json
          computed_at: string
          score: number
          seller_id: string
        }
        Insert: {
          breakdown?: Json
          computed_at?: string
          score?: number
          seller_id: string
        }
        Update: {
          breakdown?: Json
          computed_at?: string
          score?: number
          seller_id?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          active: boolean
          approved_by: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          effective_from: string
          effective_to: string | null
          fixed_fee_cents: number
          id: string
          name: string
          percentage_bps: number
          scope: string
          seller_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          fixed_fee_cents?: number
          id?: string
          name: string
          percentage_bps?: number
          scope?: string
          seller_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_from?: string
          effective_to?: string | null
          fixed_fee_cents?: number
          id?: string
          name?: string
          percentage_bps?: number
          scope?: string
          seller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          booking_id: string | null
          buyer_hidden_at: string | null
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string
          listing_id: string | null
          seller_hidden_at: string | null
          seller_id: string
        }
        Insert: {
          booking_id?: string | null
          buyer_hidden_at?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          seller_hidden_at?: string | null
          seller_id: string
        }
        Update: {
          booking_id?: string | null
          buyer_hidden_at?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          seller_hidden_at?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_content: {
        Row: {
          cleaned_text: string | null
          content_type: string
          created_at: string
          currency: string
          detected_price: number | null
          extraction_confidence: string
          extraction_status: string
          id: string
          image_hash: string | null
          included: boolean
          lead_id: string
          merchant_approval_status: string
          original_image_url: string | null
          original_text: string | null
          source_date: string | null
          source_id: string | null
          source_platform: string | null
          source_url: string | null
          stored_image_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          cleaned_text?: string | null
          content_type?: string
          created_at?: string
          currency?: string
          detected_price?: number | null
          extraction_confidence?: string
          extraction_status?: string
          id?: string
          image_hash?: string | null
          included?: boolean
          lead_id: string
          merchant_approval_status?: string
          original_image_url?: string | null
          original_text?: string | null
          source_date?: string | null
          source_id?: string | null
          source_platform?: string | null
          source_url?: string | null
          stored_image_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          cleaned_text?: string | null
          content_type?: string
          created_at?: string
          currency?: string
          detected_price?: number | null
          extraction_confidence?: string
          extraction_status?: string
          id?: string
          image_hash?: string | null
          included?: boolean
          lead_id?: string
          merchant_approval_status?: string
          original_image_url?: string | null
          original_text?: string | null
          source_date?: string | null
          source_id?: string | null
          source_platform?: string | null
          source_url?: string | null
          stored_image_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_content_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_content_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_listings: {
        Row: {
          category: string | null
          content_type: string
          created_at: string
          currency: string
          description: string | null
          draft_store_id: string
          id: string
          image_source: string
          image_url: string | null
          listing_id: string | null
          original_caption: string | null
          price: number | null
          social_post_id: string | null
          source_platform: string | null
          source_posted_at: string | null
          source_url: string | null
          status: string
          stored_media_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          draft_store_id: string
          id?: string
          image_source?: string
          image_url?: string | null
          listing_id?: string | null
          original_caption?: string | null
          price?: number | null
          social_post_id?: string | null
          source_platform?: string | null
          source_posted_at?: string | null
          source_url?: string | null
          status?: string
          stored_media_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          draft_store_id?: string
          id?: string
          image_source?: string
          image_url?: string | null
          listing_id?: string | null
          original_caption?: string | null
          price?: number | null
          social_post_id?: string | null
          source_platform?: string | null
          source_posted_at?: string | null
          source_url?: string | null
          status?: string
          stored_media_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_listings_draft_store_id_fkey"
            columns: ["draft_store_id"]
            isOneToOne: false
            referencedRelation: "draft_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_listings_social_post_id_fkey"
            columns: ["social_post_id"]
            isOneToOne: false
            referencedRelation: "lead_social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_stores: {
        Row: {
          address: string | null
          business_id: string | null
          business_name: string
          category: string | null
          claim_status: string
          claimed_at: string | null
          claimed_by_user_id: string | null
          contact_email: string | null
          contact_phone: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          hours: Json | null
          id: string
          logo_url: string | null
          parish: string | null
          preview_status: string
          prospect_id: string
          published_at: string | null
          slug: string
          social_links: Json
          tagline: string | null
          updated_at: string
          verification_method: string | null
          verification_note: string | null
          verification_status: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          business_id?: string | null
          business_name: string
          category?: string | null
          claim_status?: string
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          parish?: string | null
          preview_status?: string
          prospect_id: string
          published_at?: string | null
          slug: string
          social_links?: Json
          tagline?: string | null
          updated_at?: string
          verification_method?: string | null
          verification_note?: string | null
          verification_status?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          business_id?: string | null
          business_name?: string
          category?: string | null
          claim_status?: string
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          parish?: string | null
          preview_status?: string
          prospect_id?: string
          published_at?: string | null
          slug?: string
          social_links?: Json
          tagline?: string | null
          updated_at?: string
          verification_method?: string | null
          verification_note?: string | null
          verification_status?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_stores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_stores_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: true
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      favourites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_social_posts: {
        Row: {
          availability: string | null
          caption: string | null
          content_type: string
          created_at: string
          cta: string | null
          description: string | null
          detected_category: string | null
          detected_currency: string | null
          detected_price: number | null
          detected_title: string | null
          id: string
          image_url: string | null
          import_status: string
          media_status: string
          posted_at: string | null
          prospect_id: string
          source_platform: string | null
          source_url: string | null
          stored_media_url: string | null
        }
        Insert: {
          availability?: string | null
          caption?: string | null
          content_type?: string
          created_at?: string
          cta?: string | null
          description?: string | null
          detected_category?: string | null
          detected_currency?: string | null
          detected_price?: number | null
          detected_title?: string | null
          id?: string
          image_url?: string | null
          import_status?: string
          media_status?: string
          posted_at?: string | null
          prospect_id: string
          source_platform?: string | null
          source_url?: string | null
          stored_media_url?: string | null
        }
        Update: {
          availability?: string | null
          caption?: string | null
          content_type?: string
          created_at?: string
          cta?: string | null
          description?: string | null
          detected_category?: string | null
          detected_currency?: string | null
          detected_price?: number | null
          detected_title?: string | null
          id?: string
          image_url?: string | null
          import_status?: string
          media_status?: string
          posted_at?: string | null
          prospect_id?: string
          source_platform?: string | null
          source_url?: string | null
          stored_media_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_social_posts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          discovered_at: string
          error_message: string | null
          extraction_status: string | null
          firecrawl_status: string | null
          id: string
          images_found: number
          items_found: number
          last_scanned_at: string | null
          lead_id: string
          scan_status: string
          source_platform: string | null
          source_type: string
          source_url: string
        }
        Insert: {
          created_at?: string
          discovered_at?: string
          error_message?: string | null
          extraction_status?: string | null
          firecrawl_status?: string | null
          id?: string
          images_found?: number
          items_found?: number
          last_scanned_at?: string | null
          lead_id: string
          scan_status?: string
          source_platform?: string | null
          source_type?: string
          source_url: string
        }
        Update: {
          created_at?: string
          discovered_at?: string
          error_message?: string | null
          extraction_status?: string | null
          firecrawl_status?: string | null
          id?: string
          images_found?: number
          items_found?: number
          last_scanned_at?: string | null
          lead_id?: string
          scan_status?: string
          source_platform?: string | null
          source_type?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          category_id: string
          condition: Database["public"]["Enums"]["listing_condition"]
          cover_image_url: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string
          favourite_count: number
          featured_until: string | null
          id: string
          negotiable: boolean
          parish: Database["public"]["Enums"]["parish"]
          price: number
          seller_id: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          category_id: string
          condition?: Database["public"]["Enums"]["listing_condition"]
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description: string
          favourite_count?: number
          featured_until?: string | null
          id?: string
          negotiable?: boolean
          parish: Database["public"]["Enums"]["parish"]
          price: number
          seller_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          category_id?: string
          condition?: Database["public"]["Enums"]["listing_condition"]
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string
          favourite_count?: number
          featured_until?: string | null
          id?: string
          negotiable?: boolean
          parish?: Database["public"]["Enums"]["parish"]
          price?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_preferences: {
        Row: {
          consented_at: string | null
          created_at: string
          email_opt_in: boolean
          marketing_email: string | null
          sms_opt_in: boolean
          unsubscribe_token: string
          updated_at: string
          user_id: string
          whatsapp_number: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          consented_at?: string | null
          created_at?: string
          email_opt_in?: boolean
          marketing_email?: string | null
          sms_opt_in?: boolean
          unsubscribe_token?: string
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          consented_at?: string | null
          created_at?: string
          email_opt_in?: boolean
          marketing_email?: string | null
          sms_opt_in?: boolean
          unsubscribe_token?: string
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
          whatsapp_opt_in?: boolean
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error: string | null
          id: string
          idempotency_key: string | null
          is_test: boolean
          next_retry_at: string | null
          notification_id: string | null
          provider_error_code: string | null
          provider_message_id: string | null
          provider_status: string | null
          status: string
          status_at: string | null
          status_rank: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          is_test?: boolean
          next_retry_at?: string | null
          notification_id?: string | null
          provider_error_code?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          status?: string
          status_at?: string | null
          status_rank?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          is_test?: boolean
          next_retry_at?: string | null
          notification_id?: string | null
          provider_error_code?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          status?: string
          status_at?: string | null
          status_rank?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          booking_events: boolean
          created_at: string
          email_booking: boolean
          email_enabled: boolean
          email_message: boolean
          email_reminder: boolean
          in_app_booking: boolean
          in_app_enabled: boolean
          in_app_message: boolean
          in_app_reminder: boolean
          message_events: boolean
          reminder_events: boolean
          updated_at: string
          user_id: string
          wa_booking: boolean
          wa_message: boolean
          wa_reminder: boolean
          whatsapp_enabled: boolean
        }
        Insert: {
          booking_events?: boolean
          created_at?: string
          email_booking?: boolean
          email_enabled?: boolean
          email_message?: boolean
          email_reminder?: boolean
          in_app_booking?: boolean
          in_app_enabled?: boolean
          in_app_message?: boolean
          in_app_reminder?: boolean
          message_events?: boolean
          reminder_events?: boolean
          updated_at?: string
          user_id: string
          wa_booking?: boolean
          wa_message?: boolean
          wa_reminder?: boolean
          whatsapp_enabled?: boolean
        }
        Update: {
          booking_events?: boolean
          created_at?: string
          email_booking?: boolean
          email_enabled?: boolean
          email_message?: boolean
          email_reminder?: boolean
          in_app_booking?: boolean
          in_app_enabled?: boolean
          in_app_message?: boolean
          in_app_reminder?: boolean
          message_events?: boolean
          reminder_events?: boolean
          updated_at?: string
          user_id?: string
          wa_booking?: boolean
          wa_message?: boolean
          wa_reminder?: boolean
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          booking_id: string | null
          conversation_id: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          booking_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          booking_id?: string | null
          conversation_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          new_value: Json | null
          previous_value: Json | null
          readiness_snapshot: Json | null
          reason: string | null
          request_metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          readiness_snapshot?: Json | null
          reason?: string | null
          request_metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          readiness_snapshot?: Json | null
          reason?: string | null
          request_metadata?: Json | null
        }
        Relationships: []
      }
      payment_disputes: {
        Row: {
          amount_cents: number
          buyer_id: string | null
          created_at: string
          currency: string
          evidence_due_at: string | null
          evidence_reference: string | null
          evidence_submitted_at: string | null
          gateway_dispute_ref: string | null
          id: string
          provider: string | null
          reason_category: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          buyer_id?: string | null
          created_at?: string
          currency?: string
          evidence_due_at?: string | null
          evidence_reference?: string | null
          evidence_submitted_at?: string | null
          gateway_dispute_ref?: string | null
          id?: string
          provider?: string | null
          reason_category?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          buyer_id?: string | null
          created_at?: string
          currency?: string
          evidence_due_at?: string | null
          evidence_reference?: string | null
          evidence_submitted_at?: string | null
          gateway_dispute_ref?: string | null
          id?: string
          provider?: string | null
          reason_category?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_feature_testers: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_gateway_configuration: {
        Row: {
          capabilities: Json
          created_at: string
          credentials_configured: boolean
          environment: Database["public"]["Enums"]["payment_environment"]
          id: string
          last_connection_test_at: string | null
          last_connection_test_ok: boolean | null
          notes: string | null
          provider: string | null
          singleton: boolean
          updated_at: string
          updated_by: string | null
          webhook_endpoint_url: string | null
          webhook_secret_configured: boolean
          webhook_verified: boolean
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          credentials_configured?: boolean
          environment?: Database["public"]["Enums"]["payment_environment"]
          id?: string
          last_connection_test_at?: string | null
          last_connection_test_ok?: boolean | null
          notes?: string | null
          provider?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_endpoint_url?: string | null
          webhook_secret_configured?: boolean
          webhook_verified?: boolean
        }
        Update: {
          capabilities?: Json
          created_at?: string
          credentials_configured?: boolean
          environment?: Database["public"]["Enums"]["payment_environment"]
          id?: string
          last_connection_test_at?: string | null
          last_connection_test_ok?: boolean | null
          notes?: string | null
          provider?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_endpoint_url?: string | null
          webhook_secret_configured?: boolean
          webhook_verified?: boolean
        }
        Relationships: []
      }
      payment_readiness_checks: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string
          evidence_reference: string | null
          id: string
          key: string
          label: string
          required: boolean
          sort_order: number
          status: Database["public"]["Enums"]["readiness_status"]
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          evidence_reference?: string | null
          id?: string
          key: string
          label: string
          required?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["readiness_status"]
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          evidence_reference?: string | null
          id?: string
          key?: string
          label?: string
          required?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["readiness_status"]
          updated_at?: string
        }
        Relationships: []
      }
      payment_refunds: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          amount_cents: number
          buyer_id: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          gateway_refund_ref: string | null
          id: string
          idempotency_key: string | null
          reason: string | null
          requested_by: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["refund_status"]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          amount_cents?: number
          buyer_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gateway_refund_ref?: string | null
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          requested_by?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          amount_cents?: number
          buyer_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          gateway_refund_ref?: string | null
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          requested_by?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          authorized_at: string | null
          booking_id: string | null
          buyer_id: string | null
          captured_at: string | null
          commission_rule_id: string | null
          created_at: string
          currency: string
          environment: Database["public"]["Enums"]["payment_environment"]
          failed_at: string | null
          failure_reason: string | null
          gateway_event_ref: string | null
          gateway_fee_cents: number
          gateway_payment_ref: string | null
          gross_amount_cents: number
          id: string
          idempotency_key: string
          listing_id: string | null
          order_id: string | null
          platform_commission_cents: number
          provider: string | null
          refunded_at: string | null
          seller_id: string
          seller_net_cents: number
          status: Database["public"]["Enums"]["payment_txn_status"]
          updated_at: string
        }
        Insert: {
          authorized_at?: string | null
          booking_id?: string | null
          buyer_id?: string | null
          captured_at?: string | null
          commission_rule_id?: string | null
          created_at?: string
          currency?: string
          environment?: Database["public"]["Enums"]["payment_environment"]
          failed_at?: string | null
          failure_reason?: string | null
          gateway_event_ref?: string | null
          gateway_fee_cents?: number
          gateway_payment_ref?: string | null
          gross_amount_cents?: number
          id?: string
          idempotency_key: string
          listing_id?: string | null
          order_id?: string | null
          platform_commission_cents?: number
          provider?: string | null
          refunded_at?: string | null
          seller_id: string
          seller_net_cents?: number
          status?: Database["public"]["Enums"]["payment_txn_status"]
          updated_at?: string
        }
        Update: {
          authorized_at?: string | null
          booking_id?: string | null
          buyer_id?: string | null
          captured_at?: string | null
          commission_rule_id?: string | null
          created_at?: string
          currency?: string
          environment?: Database["public"]["Enums"]["payment_environment"]
          failed_at?: string | null
          failure_reason?: string | null
          gateway_event_ref?: string | null
          gateway_fee_cents?: number
          gateway_payment_ref?: string | null
          gross_amount_cents?: number
          id?: string
          idempotency_key?: string
          listing_id?: string | null
          order_id?: string | null
          platform_commission_cents?: number
          provider?: string | null
          refunded_at?: string | null
          seller_id?: string
          seller_net_cents?: number
          status?: Database["public"]["Enums"]["payment_txn_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_commission_rule_id_fkey"
            columns: ["commission_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ci_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          event_type: string
          failure_summary: string | null
          gateway_event_id: string
          id: string
          processed_at: string | null
          provider: string
          received_at: string
          retry_count: number
          safe_payload: Json
          status: Database["public"]["Enums"]["webhook_process_status"]
        }
        Insert: {
          event_type: string
          failure_summary?: string | null
          gateway_event_id: string
          id?: string
          processed_at?: string | null
          provider: string
          received_at?: string
          retry_count?: number
          safe_payload?: Json
          status?: Database["public"]["Enums"]["webhook_process_status"]
        }
        Update: {
          event_type?: string
          failure_summary?: string | null
          gateway_event_id?: string
          id?: string
          processed_at?: string | null
          provider?: string
          received_at?: string
          retry_count?: number
          safe_payload?: Json
          status?: Database["public"]["Enums"]["webhook_process_status"]
        }
        Relationships: []
      }
      plan_settings: {
        Row: {
          enabled: boolean
          featured_days: number
          plan: Database["public"]["Enums"]["seller_plan"]
          price_bbd_cents: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          featured_days?: number
          plan: Database["public"]["Enums"]["seller_plan"]
          price_bbd_cents?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          featured_days?: number
          plan?: Database["public"]["Enums"]["seller_plan"]
          price_bbd_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profile_private: {
        Row: {
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          bio: string | null
          created_at: string
          display_name: string
          favourites_count: number
          first_listing_at: string | null
          first_message_at: string | null
          id: string
          last_active_at: string | null
          listings_count: number
          messages_sent_count: number
          onboarded_at: string | null
          onboarding_categories: string[] | null
          onboarding_intent: string | null
          parish: Database["public"]["Enums"]["parish"] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          favourites_count?: number
          first_listing_at?: string | null
          first_message_at?: string | null
          id: string
          last_active_at?: string | null
          listings_count?: number
          messages_sent_count?: number
          onboarded_at?: string | null
          onboarding_categories?: string[] | null
          onboarding_intent?: string | null
          parish?: Database["public"]["Enums"]["parish"] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          favourites_count?: number
          first_listing_at?: string | null
          first_message_at?: string | null
          id?: string
          last_active_at?: string | null
          listings_count?: number
          messages_sent_count?: number
          onboarded_at?: string | null
          onboarding_categories?: string[] | null
          onboarding_intent?: string | null
          parish?: Database["public"]["Enums"]["parish"] | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_availability: {
        Row: {
          active: boolean
          advance_days: number
          break_end: string | null
          break_start: string | null
          buffer_minutes: number
          created_at: string
          end_time: string
          id: string
          max_daily_bookings: number
          min_notice_hours: number
          provider_id: string
          service_listing_id: string | null
          slot_minutes: number
          start_time: string
          timezone: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          advance_days?: number
          break_end?: string | null
          break_start?: string | null
          buffer_minutes?: number
          created_at?: string
          end_time?: string
          id?: string
          max_daily_bookings?: number
          min_notice_hours?: number
          provider_id: string
          service_listing_id?: string | null
          slot_minutes?: number
          start_time?: string
          timezone?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          advance_days?: number
          break_end?: string | null
          break_start?: string | null
          buffer_minutes?: number
          created_at?: string
          end_time?: string
          id?: string
          max_daily_bookings?: number
          min_notice_hours?: number
          provider_id?: string
          service_listing_id?: string | null
          slot_minutes?: number
          start_time?: string
          timezone?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_service_listing_id_fkey"
            columns: ["service_listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          provider_id: string
          reason: string | null
          service_listing_id: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          provider_id: string
          reason?: string | null
          service_listing_id?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          provider_id?: string
          reason?: string | null
          service_listing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_blocked_dates_service_listing_id_fkey"
            columns: ["service_listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: []
      }
      search_events: {
        Row: {
          category_slug: string | null
          created_at: string
          id: string
          parish: Database["public"]["Enums"]["parish"] | null
          query: string
          result_count: number
          user_id: string | null
        }
        Insert: {
          category_slug?: string | null
          created_at?: string
          id?: string
          parish?: Database["public"]["Enums"]["parish"] | null
          query: string
          result_count?: number
          user_id?: string | null
        }
        Update: {
          category_slug?: string | null
          created_at?: string
          id?: string
          parish?: Database["public"]["Enums"]["parish"] | null
          query?: string
          result_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      seller_approval_requests: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          draft_id: string | null
          duplicate_result: Json
          id: string
          prospect_id: string
          recommended_action: string | null
          record_mode: Database["public"]["Enums"]["seller_record_mode"]
          request_type: string
          risk_warnings: string[]
          status: Database["public"]["Enums"]["seller_approval_status"]
          summary: Json
          updated_at: string
          verification_result: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          draft_id?: string | null
          duplicate_result?: Json
          id?: string
          prospect_id: string
          recommended_action?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          request_type?: string
          risk_warnings?: string[]
          status?: Database["public"]["Enums"]["seller_approval_status"]
          summary?: Json
          updated_at?: string
          verification_result?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          draft_id?: string | null
          duplicate_result?: Json
          id?: string
          prospect_id?: string
          recommended_action?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          request_type?: string
          risk_warnings?: string[]
          status?: Database["public"]["Enums"]["seller_approval_status"]
          summary?: Json
          updated_at?: string
          verification_result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "seller_approval_requests_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "seller_outreach_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_approval_requests_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_followup_tasks: {
        Row: {
          assigned_admin_id: string | null
          cancelled_reason: string | null
          channel: Database["public"]["Enums"]["seller_outreach_channel"] | null
          created_at: string
          created_by: string | null
          due_at: string
          id: string
          playbook_id: string | null
          prospect_id: string
          record_mode: Database["public"]["Enums"]["seller_record_mode"]
          sequence_step: string
          status: Database["public"]["Enums"]["seller_task_status"]
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          cancelled_reason?: string | null
          channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          created_at?: string
          created_by?: string | null
          due_at: string
          id?: string
          playbook_id?: string | null
          prospect_id: string
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          sequence_step?: string
          status?: Database["public"]["Enums"]["seller_task_status"]
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          cancelled_reason?: string | null
          channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          id?: string
          playbook_id?: string | null
          prospect_id?: string
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          sequence_step?: string
          status?: Database["public"]["Enums"]["seller_task_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_followup_tasks_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "seller_outreach_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_followup_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_growth_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      seller_growth_settings: {
        Row: {
          allowlist_required: boolean
          business_hours_end: number
          business_hours_start: number
          daily_contact_limit: number
          email_paused: boolean
          global_outreach_paused: boolean
          id: number
          live_sending_enabled: boolean
          max_contact_attempts: number
          outreach_days: string[]
          simulation_mode: boolean
          social_paused: boolean
          test_recipients: string[]
          timezone: string
          updated_at: string
          updated_by: string | null
          weekly_contact_limit: number
          whatsapp_paused: boolean
        }
        Insert: {
          allowlist_required?: boolean
          business_hours_end?: number
          business_hours_start?: number
          daily_contact_limit?: number
          email_paused?: boolean
          global_outreach_paused?: boolean
          id?: number
          live_sending_enabled?: boolean
          max_contact_attempts?: number
          outreach_days?: string[]
          simulation_mode?: boolean
          social_paused?: boolean
          test_recipients?: string[]
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekly_contact_limit?: number
          whatsapp_paused?: boolean
        }
        Update: {
          allowlist_required?: boolean
          business_hours_end?: number
          business_hours_start?: number
          daily_contact_limit?: number
          email_paused?: boolean
          global_outreach_paused?: boolean
          id?: number
          live_sending_enabled?: boolean
          max_contact_attempts?: number
          outreach_days?: string[]
          simulation_mode?: boolean
          social_paused?: boolean
          test_recipients?: string[]
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          weekly_contact_limit?: number
          whatsapp_paused?: boolean
        }
        Relationships: []
      }
      seller_onboarding_items: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_hint: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_urls: string[]
          missing_fields: string[]
          price: number | null
          published_listing_id: string | null
          session_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_hint?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          missing_fields?: string[]
          price?: number | null
          published_listing_id?: string | null
          session_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_hint?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          missing_fields?: string[]
          price?: number | null
          published_listing_id?: string | null
          session_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_onboarding_items_published_listing_id_fkey"
            columns: ["published_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_onboarding_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "seller_onboarding_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_onboarding_sessions: {
        Row: {
          accepted_at: string | null
          business_confirmed: boolean
          business_id: string | null
          completed_at: string | null
          content_permission_granted: boolean
          created_at: string
          created_by: string | null
          id: string
          invite_expires_at: string
          invite_token: string
          logo_permission_granted: boolean
          prefilled: Json
          prospect_id: string
          record_mode: Database["public"]["Enums"]["seller_record_mode"]
          seller_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          business_confirmed?: boolean
          business_id?: string | null
          completed_at?: string | null
          content_permission_granted?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          invite_expires_at?: string
          invite_token: string
          logo_permission_granted?: boolean
          prefilled?: Json
          prospect_id: string
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          seller_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          business_confirmed?: boolean
          business_id?: string | null
          completed_at?: string | null
          content_permission_granted?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          invite_expires_at?: string
          invite_token?: string
          logo_permission_granted?: boolean
          prefilled?: Json
          prospect_id?: string
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          seller_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_onboarding_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_onboarding_sessions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_outreach_drafts: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at: string
          created_by: string | null
          id: string
          playbook_id: string | null
          prospect_id: string
          record_mode: Database["public"]["Enums"]["seller_record_mode"]
          risk_warnings: string[]
          sequence_step: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          playbook_id?: string | null
          prospect_id: string
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          risk_warnings?: string[]
          sequence_step?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at?: string
          created_by?: string | null
          id?: string
          playbook_id?: string | null
          prospect_id?: string
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          risk_warnings?: string[]
          sequence_step?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_outreach_drafts_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "seller_outreach_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_outreach_drafts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_outreach_events: {
        Row: {
          channel: Database["public"]["Enums"]["seller_outreach_channel"] | null
          created_at: string
          detail: Json
          event_type: string
          id: string
          message_id: string | null
          occurred_at: string
          prospect_id: string | null
        }
        Insert: {
          channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          prospect_id?: string | null
        }
        Update: {
          channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          prospect_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_outreach_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "seller_outreach_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_outreach_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_outreach_messages: {
        Row: {
          approval_request_id: string | null
          body: string
          channel: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at: string
          created_by: string | null
          draft_id: string | null
          error: string | null
          id: string
          idempotency_key: string
          prospect_id: string
          provider_message_id: string | null
          recipient: string | null
          record_mode: Database["public"]["Enums"]["seller_record_mode"]
          replied_at: string | null
          sent_at: string | null
          sequence_step: string
          simulated: boolean
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          approval_request_id?: string | null
          body: string
          channel: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at?: string
          created_by?: string | null
          draft_id?: string | null
          error?: string | null
          id?: string
          idempotency_key: string
          prospect_id: string
          provider_message_id?: string | null
          recipient?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          replied_at?: string | null
          sent_at?: string | null
          sequence_step?: string
          simulated?: boolean
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          approval_request_id?: string | null
          body?: string
          channel?: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at?: string
          created_by?: string | null
          draft_id?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string
          prospect_id?: string
          provider_message_id?: string | null
          recipient?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          replied_at?: string | null
          sent_at?: string | null
          sequence_step?: string
          simulated?: boolean
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_outreach_messages_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "seller_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_outreach_messages_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "seller_outreach_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_outreach_messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_outreach_playbooks: {
        Row: {
          active: boolean
          created_at: string
          followup_1_template: string
          followup_final_template: string
          followup_interval_days: number
          id: string
          initial_template: string
          key: string
          max_attempts: number
          name: string
          onboarding_offer: string | null
          recommended_channel: Database["public"]["Enums"]["seller_outreach_channel"]
          required_info: string[]
          requires_approval: boolean
          seller_type: string | null
          sort_order: number
          updated_at: string
          value_proposition: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          followup_1_template?: string
          followup_final_template?: string
          followup_interval_days?: number
          id?: string
          initial_template?: string
          key: string
          max_attempts?: number
          name: string
          onboarding_offer?: string | null
          recommended_channel?: Database["public"]["Enums"]["seller_outreach_channel"]
          required_info?: string[]
          requires_approval?: boolean
          seller_type?: string | null
          sort_order?: number
          updated_at?: string
          value_proposition?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          followup_1_template?: string
          followup_final_template?: string
          followup_interval_days?: number
          id?: string
          initial_template?: string
          key?: string
          max_attempts?: number
          name?: string
          onboarding_offer?: string | null
          recommended_channel?: Database["public"]["Enums"]["seller_outreach_channel"]
          required_info?: string[]
          requires_approval?: boolean
          seller_type?: string | null
          sort_order?: number
          updated_at?: string
          value_proposition?: string
        }
        Relationships: []
      }
      seller_payment_accounts: {
        Row: {
          charges_enabled: boolean
          created_at: string
          default_commission_rule_id: string | null
          environment: Database["public"]["Enums"]["payment_environment"]
          gateway_account_ref: string | null
          id: string
          last_synced_at: string | null
          onboarding_status: Database["public"]["Enums"]["seller_payment_onboarding_status"]
          payouts_enabled: boolean
          provider: string | null
          requirements_due: Json
          restriction_reason: string | null
          seller_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          charges_enabled?: boolean
          created_at?: string
          default_commission_rule_id?: string | null
          environment?: Database["public"]["Enums"]["payment_environment"]
          gateway_account_ref?: string | null
          id?: string
          last_synced_at?: string | null
          onboarding_status?: Database["public"]["Enums"]["seller_payment_onboarding_status"]
          payouts_enabled?: boolean
          provider?: string | null
          requirements_due?: Json
          restriction_reason?: string | null
          seller_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          charges_enabled?: boolean
          created_at?: string
          default_commission_rule_id?: string | null
          environment?: Database["public"]["Enums"]["payment_environment"]
          gateway_account_ref?: string | null
          id?: string
          last_synced_at?: string | null
          onboarding_status?: Database["public"]["Enums"]["seller_payment_onboarding_status"]
          payouts_enabled?: boolean
          provider?: string | null
          requirements_due?: Json
          restriction_reason?: string | null
          seller_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      seller_payouts: {
        Row: {
          adjustments_cents: number
          created_at: string
          currency: string
          environment: Database["public"]["Enums"]["payment_environment"]
          expected_arrival_at: string | null
          failure_reason: string | null
          gateway_payout_ref: string | null
          gross_earnings_cents: number
          id: string
          idempotency_key: string | null
          net_payout_cents: number
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          provider: string | null
          seller_id: string
          status: Database["public"]["Enums"]["payout_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          adjustments_cents?: number
          created_at?: string
          currency?: string
          environment?: Database["public"]["Enums"]["payment_environment"]
          expected_arrival_at?: string | null
          failure_reason?: string | null
          gateway_payout_ref?: string | null
          gross_earnings_cents?: number
          id?: string
          idempotency_key?: string | null
          net_payout_cents?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          adjustments_cents?: number
          created_at?: string
          currency?: string
          environment?: Database["public"]["Enums"]["payment_environment"]
          expected_arrival_at?: string | null
          failure_reason?: string | null
          gateway_payout_ref?: string | null
          gross_earnings_cents?: number
          id?: string
          idempotency_key?: string | null
          net_payout_cents?: number
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          provider?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payouts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_pipeline_history: {
        Row: {
          actor: string
          approval_request_id: string | null
          changed_by: string | null
          created_at: string
          from_stage:
            | Database["public"]["Enums"]["seller_pipeline_stage"]
            | null
          id: string
          outreach_message_id: string | null
          prospect_id: string
          reason: string | null
          to_stage: Database["public"]["Enums"]["seller_pipeline_stage"]
        }
        Insert: {
          actor?: string
          approval_request_id?: string | null
          changed_by?: string | null
          created_at?: string
          from_stage?:
            | Database["public"]["Enums"]["seller_pipeline_stage"]
            | null
          id?: string
          outreach_message_id?: string | null
          prospect_id: string
          reason?: string | null
          to_stage: Database["public"]["Enums"]["seller_pipeline_stage"]
        }
        Update: {
          actor?: string
          approval_request_id?: string | null
          changed_by?: string | null
          created_at?: string
          from_stage?:
            | Database["public"]["Enums"]["seller_pipeline_stage"]
            | null
          id?: string
          outreach_message_id?: string | null
          prospect_id?: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["seller_pipeline_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "seller_pipeline_history_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_prospect_contacts: {
        Row: {
          channel: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at: string
          id: string
          is_public_business_contact: boolean
          label: string | null
          prospect_id: string
          source_url: string | null
          updated_at: string
          value: string
          value_norm: string | null
          verified_at: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at?: string
          id?: string
          is_public_business_contact?: boolean
          label?: string | null
          prospect_id: string
          source_url?: string | null
          updated_at?: string
          value: string
          value_norm?: string | null
          verified_at?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["seller_outreach_channel"]
          created_at?: string
          id?: string
          is_public_business_contact?: boolean
          label?: string | null
          prospect_id?: string
          source_url?: string | null
          updated_at?: string
          value?: string
          value_norm?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_prospect_contacts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_prospect_scores: {
        Row: {
          breakdown: Json
          computed_by: string | null
          created_at: string
          explanation: string | null
          id: string
          missing_evidence: string[]
          prospect_id: string
          recommended_channel:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          recommended_priority:
            | Database["public"]["Enums"]["seller_priority"]
            | null
          total_score: number
        }
        Insert: {
          breakdown?: Json
          computed_by?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          missing_evidence?: string[]
          prospect_id: string
          recommended_channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          recommended_priority?:
            | Database["public"]["Enums"]["seller_priority"]
            | null
          total_score: number
        }
        Update: {
          breakdown?: Json
          computed_by?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          missing_evidence?: string[]
          prospect_id?: string
          recommended_channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          recommended_priority?:
            | Database["public"]["Enums"]["seller_priority"]
            | null
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_prospect_scores_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_prospect_sources: {
        Row: {
          claim: string
          confidence: string
          created_at: string
          id: string
          prospect_id: string
          researched_at: string
          researched_by: string | null
          source_type: string | null
          source_url: string | null
        }
        Insert: {
          claim: string
          confidence?: string
          created_at?: string
          id?: string
          prospect_id: string
          researched_at?: string
          researched_by?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Update: {
          claim?: string
          confidence?: string
          created_at?: string
          id?: string
          prospect_id?: string
          researched_at?: string
          researched_by?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_prospect_sources_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_prospects: {
        Row: {
          acquisition_status: string
          address: string | null
          assigned_admin_id: string | null
          audience_estimate: number | null
          bajanmarket_account_status: string
          business_description: string | null
          business_name: string
          business_name_norm: string | null
          contact_name: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          delivery_available: boolean | null
          duplicate_of_id: string | null
          estimated_potential_listings: number | null
          facebook_group_activity: string | null
          facebook_url: string | null
          has_existing_website: boolean | null
          id: string
          instagram_url: string | null
          last_checked_at: string | null
          last_contact_at: string | null
          lead_score: number | null
          location_note: string | null
          marketplace_category: string | null
          next_followup_at: string | null
          notes: string | null
          opening_hours: Json | null
          opted_out: boolean
          other_source_url: string | null
          outreach_status: string | null
          parish: string | null
          pipeline_stage: Database["public"]["Enums"]["seller_pipeline_stage"]
          posting_frequency: string | null
          preferred_channel:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          priority: Database["public"]["Enums"]["seller_priority"]
          profile_image_url: string | null
          public_email: string | null
          public_phone: string | null
          public_whatsapp: string | null
          record_mode: Database["public"]["Enums"]["seller_record_mode"]
          seller_type: string | null
          social_platform: string | null
          suppression_reason: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["seller_verification_status"]
          visible_product_count: number | null
          website_domain: string | null
          website_url: string | null
        }
        Insert: {
          acquisition_status?: string
          address?: string | null
          assigned_admin_id?: string | null
          audience_estimate?: number | null
          bajanmarket_account_status?: string
          business_description?: string | null
          business_name: string
          business_name_norm?: string | null
          contact_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          delivery_available?: boolean | null
          duplicate_of_id?: string | null
          estimated_potential_listings?: number | null
          facebook_group_activity?: string | null
          facebook_url?: string | null
          has_existing_website?: boolean | null
          id?: string
          instagram_url?: string | null
          last_checked_at?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          location_note?: string | null
          marketplace_category?: string | null
          next_followup_at?: string | null
          notes?: string | null
          opening_hours?: Json | null
          opted_out?: boolean
          other_source_url?: string | null
          outreach_status?: string | null
          parish?: string | null
          pipeline_stage?: Database["public"]["Enums"]["seller_pipeline_stage"]
          posting_frequency?: string | null
          preferred_channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          priority?: Database["public"]["Enums"]["seller_priority"]
          profile_image_url?: string | null
          public_email?: string | null
          public_phone?: string | null
          public_whatsapp?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          seller_type?: string | null
          social_platform?: string | null
          suppression_reason?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["seller_verification_status"]
          visible_product_count?: number | null
          website_domain?: string | null
          website_url?: string | null
        }
        Update: {
          acquisition_status?: string
          address?: string | null
          assigned_admin_id?: string | null
          audience_estimate?: number | null
          bajanmarket_account_status?: string
          business_description?: string | null
          business_name?: string
          business_name_norm?: string | null
          contact_name?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          delivery_available?: boolean | null
          duplicate_of_id?: string | null
          estimated_potential_listings?: number | null
          facebook_group_activity?: string | null
          facebook_url?: string | null
          has_existing_website?: boolean | null
          id?: string
          instagram_url?: string | null
          last_checked_at?: string | null
          last_contact_at?: string | null
          lead_score?: number | null
          location_note?: string | null
          marketplace_category?: string | null
          next_followup_at?: string | null
          notes?: string | null
          opening_hours?: Json | null
          opted_out?: boolean
          other_source_url?: string | null
          outreach_status?: string | null
          parish?: string | null
          pipeline_stage?: Database["public"]["Enums"]["seller_pipeline_stage"]
          posting_frequency?: string | null
          preferred_channel?:
            | Database["public"]["Enums"]["seller_outreach_channel"]
            | null
          priority?: Database["public"]["Enums"]["seller_priority"]
          profile_image_url?: string | null
          public_email?: string | null
          public_phone?: string | null
          public_whatsapp?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          seller_type?: string | null
          social_platform?: string | null
          suppression_reason?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["seller_verification_status"]
          visible_product_count?: number | null
          website_domain?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_prospects_duplicate_of_id_fkey"
            columns: ["duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_research_tasks: {
        Row: {
          assigned_admin_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          parish: string | null
          prospect_id: string | null
          record_mode: Database["public"]["Enums"]["seller_record_mode"]
          result_notes: string | null
          seller_type: string | null
          source_hint: string | null
          status: Database["public"]["Enums"]["seller_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_admin_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          parish?: string | null
          prospect_id?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          result_notes?: string | null
          seller_type?: string | null
          source_hint?: string | null
          status?: Database["public"]["Enums"]["seller_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_admin_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          parish?: string | null
          prospect_id?: string | null
          record_mode?: Database["public"]["Enums"]["seller_record_mode"]
          result_notes?: string | null
          seller_type?: string | null
          source_hint?: string | null
          status?: Database["public"]["Enums"]["seller_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_research_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_scoring_rules: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          max_points: number
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          max_points?: number
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          max_points?: number
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      seller_suppressions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          match_type: string
          match_value: string
          match_value_norm: string | null
          permanent: boolean
          prospect_id: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_type: string
          match_value: string
          match_value_norm?: string | null
          permanent?: boolean
          prospect_id?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          match_type?: string
          match_value?: string
          match_value_norm?: string | null
          permanent?: boolean
          prospect_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_suppressions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean
          cancellation_policy: string | null
          created_at: string
          description: string | null
          duration_options: number[]
          icon: string
          id: string
          instant_booking_allowed: boolean
          name: string
          requires_provider_approval: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cancellation_policy?: string | null
          created_at?: string
          description?: string | null
          duration_options?: number[]
          icon?: string
          id?: string
          instant_booking_allowed?: boolean
          name: string
          requires_provider_approval?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cancellation_policy?: string | null
          created_at?: string
          description?: string | null
          duration_options?: number[]
          icon?: string
          id?: string
          instant_booking_allowed?: boolean
          name?: string
          requires_provider_approval?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_listing_answers: {
        Row: {
          created_at: string
          field_key: string
          id: string
          service_listing_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          field_key: string
          id?: string
          service_listing_id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          field_key?: string
          id?: string
          service_listing_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "service_listing_answers_service_listing_id_fkey"
            columns: ["service_listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      service_listings: {
        Row: {
          areas_served: string[]
          business_id: string | null
          cancellation_policy: string | null
          category_id: string
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string
          duration_minutes: number
          id: string
          images: string[]
          instant_booking: boolean
          location_note: string | null
          mobile_service: boolean
          parish: Database["public"]["Enums"]["parish"] | null
          price: number
          price_unit: string
          provider_id: string
          rating_avg: number
          rating_count: number
          status: Database["public"]["Enums"]["service_listing_status"]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          areas_served?: string[]
          business_id?: string | null
          cancellation_policy?: string | null
          category_id: string
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string
          duration_minutes?: number
          id?: string
          images?: string[]
          instant_booking?: boolean
          location_note?: string | null
          mobile_service?: boolean
          parish?: Database["public"]["Enums"]["parish"] | null
          price?: number
          price_unit?: string
          provider_id: string
          rating_avg?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["service_listing_status"]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          areas_served?: string[]
          business_id?: string | null
          cancellation_policy?: string | null
          category_id?: string
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string
          duration_minutes?: number
          id?: string
          images?: string[]
          instant_booking?: boolean
          location_note?: string | null
          mobile_service?: boolean
          parish?: Database["public"]["Enums"]["parish"] | null
          price?: number
          price_unit?: string
          provider_id?: string
          rating_avg?: number
          rating_count?: number
          status?: Database["public"]["Enums"]["service_listing_status"]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_template_fields: {
        Row: {
          active: boolean
          audience: Database["public"]["Enums"]["service_field_audience"]
          category_id: string
          created_at: string
          field_key: string
          field_type: Database["public"]["Enums"]["service_field_type"]
          help_text: string | null
          id: string
          label: string
          options: string[]
          required: boolean
          sensitive: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience: Database["public"]["Enums"]["service_field_audience"]
          category_id: string
          created_at?: string
          field_key: string
          field_type?: Database["public"]["Enums"]["service_field_type"]
          help_text?: string | null
          id?: string
          label: string
          options?: string[]
          required?: boolean
          sensitive?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: Database["public"]["Enums"]["service_field_audience"]
          category_id?: string
          created_at?: string
          field_key?: string
          field_type?: Database["public"]["Enums"]["service_field_type"]
          help_text?: string | null
          id?: string
          label?: string
          options?: string[]
          required?: boolean
          sensitive?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_template_fields_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      share_visits: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      store_claim_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          detail: Json
          draft_store_id: string | null
          event: string
          id: string
          prospect_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          draft_store_id?: string | null
          event: string
          id?: string
          prospect_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          draft_store_id?: string | null
          event?: string
          id?: string
          prospect_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_claim_audit_draft_store_id_fkey"
            columns: ["draft_store_id"]
            isOneToOne: false
            referencedRelation: "draft_stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_claim_audit_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      store_claim_tokens: {
        Row: {
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          created_by: string | null
          draft_store_id: string
          expires_at: string | null
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          revoked_at: string | null
          token_hash: string
          token_hint: string | null
          view_count: number
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_store_id: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_hint?: string | null
          view_count?: number
        }
        Update: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          created_by?: string | null
          draft_store_id?: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_hint?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_claim_tokens_draft_store_id_fkey"
            columns: ["draft_store_id"]
            isOneToOne: false
            referencedRelation: "draft_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["seller_plan"]
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["seller_plan"]
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["seller_plan"]
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_connection_tests: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          ok: boolean
          run_by: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          ok: boolean
          run_by?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          ok?: boolean
          run_by?: string | null
        }
        Relationships: []
      }
      whatsapp_consent: {
        Row: {
          consent_method: string | null
          consent_source: string | null
          consent_text_version: string | null
          consented_at: string | null
          created_at: string
          last_code_sent_at: string | null
          last_delivery_at: string | null
          last_delivery_status: string | null
          opted_out_at: string | null
          phone: string
          updated_at: string
          user_id: string
          verification_code_hash: string | null
          verification_expires_at: string | null
          verified_at: string | null
          verify_attempts: number
        }
        Insert: {
          consent_method?: string | null
          consent_source?: string | null
          consent_text_version?: string | null
          consented_at?: string | null
          created_at?: string
          last_code_sent_at?: string | null
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          opted_out_at?: string | null
          phone: string
          updated_at?: string
          user_id: string
          verification_code_hash?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
          verify_attempts?: number
        }
        Update: {
          consent_method?: string | null
          consent_source?: string | null
          consent_text_version?: string | null
          consented_at?: string | null
          created_at?: string
          last_code_sent_at?: string | null
          last_delivery_at?: string | null
          last_delivery_status?: string | null
          opted_out_at?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
          verification_code_hash?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
          verify_attempts?: number
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          id: number
          production_enabled: boolean
          test_mode: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          production_enabled?: boolean
          test_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          production_enabled?: boolean
          test_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      whatsapp_test_numbers: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          label: string | null
          phone: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          phone: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          phone?: string
        }
        Relationships: []
      }
      whatsapp_webhook_events: {
        Row: {
          event_key: string
          kind: string
          received_at: string
        }
        Insert: {
          event_key: string
          kind: string
          received_at?: string
        }
        Update: {
          event_key?: string
          kind?: string
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ci_compute_trust_score: { Args: { _seller_id: string }; Returns: number }
      ci_log_event: {
        Args: {
          _browser?: string
          _business_id?: string
          _campaign_code?: string
          _category_id?: string
          _device?: string
          _event_type: string
          _listing_id?: string
          _medium?: string
          _metadata?: Json
          _parish?: string
          _path?: string
          _referrer?: string
          _seller_id?: string
          _session_id?: string
          _source?: string
        }
        Returns: undefined
      }
      ci_refresh_category_stats: { Args: never; Returns: undefined }
      ci_refresh_rollups: { Args: never; Returns: undefined }
      ci_refresh_trust_scores: { Args: never; Returns: undefined }
      conversation_listing_seller: {
        Args: { _listing_id: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_interest_tags: {
        Args: { _user_id: string }
        Returns: {
          top_categories: string[]
          top_parishes: string[]
        }[]
      }
      increment_listing_view: {
        Args: { _listing_id: string }
        Returns: undefined
      }
      is_user_banned: { Args: { _user_id: string }; Returns: boolean }
      log_share_visit: {
        Args: {
          _path: string
          _referrer: string
          _utm_campaign: string
          _utm_medium: string
          _utm_source: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      payments_enabled: { Args: never; Returns: boolean }
      providers_with_availability: {
        Args: { _provider_ids: string[] }
        Returns: {
          provider_id: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      service_blocked_dates: {
        Args: { _provider_id: string }
        Returns: {
          blocked_date: string
        }[]
      }
      service_busy_slots: {
        Args: { _from: string; _provider_id: string; _to: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      service_public_availability: {
        Args: { _provider_id: string; _service_listing_id: string }
        Returns: {
          active: boolean
          advance_days: number
          break_end: string
          break_start: string
          buffer_minutes: number
          end_time: string
          id: string
          max_daily_bookings: number
          min_notice_hours: number
          service_listing_id: string
          slot_minutes: number
          start_time: string
          timezone: string
          weekday: number
        }[]
      }
    }
    Enums: {
      app_role: "user" | "moderator" | "admin"
      booking_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "reschedule_requested"
        | "cancelled_by_buyer"
        | "cancelled_by_provider"
        | "completed"
        | "no_show"
        | "disputed"
      dispute_status:
        | "open"
        | "under_review"
        | "evidence_required"
        | "evidence_submitted"
        | "won"
        | "lost"
        | "cancelled"
      listing_condition: "new" | "like_new" | "good" | "fair" | "for_parts"
      listing_status: "active" | "paused" | "sold" | "deleted"
      parish:
        | "christ_church"
        | "saint_andrew"
        | "saint_george"
        | "saint_james"
        | "saint_john"
        | "saint_joseph"
        | "saint_lucy"
        | "saint_michael"
        | "saint_peter"
        | "saint_philip"
        | "saint_thomas"
      payment_environment: "unconfigured" | "sandbox" | "live"
      payment_txn_status:
        | "created"
        | "requires_action"
        | "authorized"
        | "captured"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
        | "disputed"
      payout_status:
        | "pending"
        | "processing"
        | "paid"
        | "failed"
        | "reversed"
        | "cancelled"
      readiness_status:
        | "pending"
        | "in_progress"
        | "passed"
        | "failed"
        | "not_applicable"
      refund_status:
        | "requested"
        | "pending"
        | "approved"
        | "completed"
        | "partially_refunded"
        | "failed"
        | "cancelled"
        | "rejected"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_target: "listing" | "user" | "message"
      seller_approval_status:
        | "pending"
        | "approved"
        | "edited_approved"
        | "rejected"
        | "archived"
      seller_outreach_channel:
        | "email"
        | "whatsapp"
        | "facebook"
        | "instagram"
        | "phone"
        | "in_person"
        | "other"
      seller_payment_onboarding_status:
        | "not_started"
        | "pending"
        | "requirements_due"
        | "restricted"
        | "active"
        | "rejected"
        | "disabled"
      seller_pipeline_stage:
        | "discovered"
        | "verification_required"
        | "qualified"
        | "ready_for_outreach"
        | "awaiting_approval"
        | "contacted"
        | "replied"
        | "demo_scheduled"
        | "onboarding"
        | "trial_active"
        | "activated_seller"
        | "declined"
        | "suppressed"
      seller_plan: "free" | "premium" | "business"
      seller_priority: "low" | "medium" | "high" | "urgent"
      seller_record_mode: "demo" | "simulation" | "live"
      seller_task_status: "open" | "in_progress" | "done" | "cancelled"
      seller_verification_status:
        | "unverified"
        | "needs_review"
        | "verified"
        | "rejected"
        | "duplicate_suspected"
      service_field_audience: "provider" | "buyer"
      service_field_type:
        | "text"
        | "textarea"
        | "number"
        | "select"
        | "multiselect"
        | "boolean"
        | "date"
        | "time"
        | "phone"
        | "images"
      service_listing_status: "draft" | "active" | "paused" | "removed"
      webhook_process_status: "received" | "processed" | "ignored" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "moderator", "admin"],
      booking_status: [
        "pending",
        "confirmed",
        "declined",
        "reschedule_requested",
        "cancelled_by_buyer",
        "cancelled_by_provider",
        "completed",
        "no_show",
        "disputed",
      ],
      dispute_status: [
        "open",
        "under_review",
        "evidence_required",
        "evidence_submitted",
        "won",
        "lost",
        "cancelled",
      ],
      listing_condition: ["new", "like_new", "good", "fair", "for_parts"],
      listing_status: ["active", "paused", "sold", "deleted"],
      parish: [
        "christ_church",
        "saint_andrew",
        "saint_george",
        "saint_james",
        "saint_john",
        "saint_joseph",
        "saint_lucy",
        "saint_michael",
        "saint_peter",
        "saint_philip",
        "saint_thomas",
      ],
      payment_environment: ["unconfigured", "sandbox", "live"],
      payment_txn_status: [
        "created",
        "requires_action",
        "authorized",
        "captured",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
        "disputed",
      ],
      payout_status: [
        "pending",
        "processing",
        "paid",
        "failed",
        "reversed",
        "cancelled",
      ],
      readiness_status: [
        "pending",
        "in_progress",
        "passed",
        "failed",
        "not_applicable",
      ],
      refund_status: [
        "requested",
        "pending",
        "approved",
        "completed",
        "partially_refunded",
        "failed",
        "cancelled",
        "rejected",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target: ["listing", "user", "message"],
      seller_approval_status: [
        "pending",
        "approved",
        "edited_approved",
        "rejected",
        "archived",
      ],
      seller_outreach_channel: [
        "email",
        "whatsapp",
        "facebook",
        "instagram",
        "phone",
        "in_person",
        "other",
      ],
      seller_payment_onboarding_status: [
        "not_started",
        "pending",
        "requirements_due",
        "restricted",
        "active",
        "rejected",
        "disabled",
      ],
      seller_pipeline_stage: [
        "discovered",
        "verification_required",
        "qualified",
        "ready_for_outreach",
        "awaiting_approval",
        "contacted",
        "replied",
        "demo_scheduled",
        "onboarding",
        "trial_active",
        "activated_seller",
        "declined",
        "suppressed",
      ],
      seller_plan: ["free", "premium", "business"],
      seller_priority: ["low", "medium", "high", "urgent"],
      seller_record_mode: ["demo", "simulation", "live"],
      seller_task_status: ["open", "in_progress", "done", "cancelled"],
      seller_verification_status: [
        "unverified",
        "needs_review",
        "verified",
        "rejected",
        "duplicate_suspected",
      ],
      service_field_audience: ["provider", "buyer"],
      service_field_type: [
        "text",
        "textarea",
        "number",
        "select",
        "multiselect",
        "boolean",
        "date",
        "time",
        "phone",
        "images",
      ],
      service_listing_status: ["draft", "active", "paused", "removed"],
      webhook_process_status: ["received", "processed", "ignored", "failed"],
    },
  },
} as const
