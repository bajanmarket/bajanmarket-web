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
          buyer_hidden_at: string | null
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string
          listing_id: string
          seller_hidden_at: string | null
          seller_id: string
        }
        Insert: {
          buyer_hidden_at?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id: string
          seller_hidden_at?: string | null
          seller_id: string
        }
        Update: {
          buyer_hidden_at?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string
          seller_hidden_at?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "user" | "moderator" | "admin"
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
    },
  },
} as const
