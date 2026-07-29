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
          channel: string
          created_at: string
          error: string | null
          id: string
          notification_id: string | null
          provider_message_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string | null
          provider_message_id?: string | null
          status?: string
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
          email_enabled: boolean
          in_app_enabled: boolean
          message_events: boolean
          reminder_events: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          booking_events?: boolean
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          message_events?: boolean
          reminder_events?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          booking_events?: boolean
          created_at?: string
          email_enabled?: boolean
          in_app_enabled?: boolean
          message_events?: boolean
          reminder_events?: boolean
          updated_at?: string
          user_id?: string
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
      whatsapp_consent: {
        Row: {
          consent_method: string | null
          consented_at: string | null
          created_at: string
          opted_out_at: string | null
          phone: string
          updated_at: string
          user_id: string
          verification_code: string | null
          verification_expires_at: string | null
          verified_at: string | null
        }
        Insert: {
          consent_method?: string | null
          consented_at?: string | null
          created_at?: string
          opted_out_at?: string | null
          phone: string
          updated_at?: string
          user_id: string
          verification_code?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
        }
        Update: {
          consent_method?: string | null
          consented_at?: string | null
          created_at?: string
          opted_out_at?: string | null
          phone?: string
          updated_at?: string
          user_id?: string
          verification_code?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
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
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      service_busy_slots: {
        Args: { _from: string; _provider_id: string; _to: string }
        Returns: {
          ends_at: string
          starts_at: string
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
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      report_target: "listing" | "user" | "message"
      seller_plan: "free" | "premium" | "business"
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
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      report_target: ["listing", "user", "message"],
      seller_plan: ["free", "premium", "business"],
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
    },
  },
} as const
