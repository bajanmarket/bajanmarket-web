/**
 * Supabase-backed implementation of the Phase 4 CaptureStore.
 *
 * Uses the request-scoped authenticated client, so RLS keeps every write
 * owner-scoped and buyer intents stay private.
 */
import { CAPTURE_CONFIG } from "./matching/weights";
import type { CaptureStore, IntentInsert, IntentUpdate, StoredIntent } from "./matching/capture";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function createSupabaseCaptureStore(supabase: any): CaptureStore {
  return {
    async isCaptureEnabled() {
      const { data, error } = await supabase
        .from("platform_feature_flags")
        .select("enabled")
        .eq("key", CAPTURE_CONFIG.captureFlagKey)
        .maybeSingle();
      if (error) throw error; // fail closed
      return data?.enabled === true;
    },

    async findIntent(userId: string, intentKey: string): Promise<StoredIntent | null> {
      const { data, error } = await supabase
        .from("buyer_intents")
        .select(
          "id, intent_key, normalized_query, keywords, raw_queries, category_id, min_price, max_price, preferred_condition, preferred_parish, signal_count, first_seen, last_seen, active",
        )
        .eq("user_id", userId)
        .eq("intent_key", intentKey)
        .maybeSingle();
      if (error) throw error;
      return (data as StoredIntent | null) ?? null;
    },

    async insertIntent(row: IntentInsert) {
      const { error } = await supabase.from("buyer_intents").insert(row);
      if (error) throw error;
    },

    async updateIntent(id: string, patch: IntentUpdate) {
      const { error } = await supabase.from("buyer_intents").update(patch).eq("id", id);
      if (error) throw error;
    },

    async findLastListingView(userId: string, listingId: string) {
      const { data, error } = await supabase
        .from("buyer_activity_events")
        .select("occurred_at")
        .eq("user_id", userId)
        .eq("listing_id", listingId)
        .eq("event_type", "listing_viewed")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as { occurred_at: string } | null) ?? null;
    },

    async insertListingView(row) {
      const { error } = await supabase
        .from("buyer_activity_events")
        .insert({ ...row, event_type: "listing_viewed" });
      if (error) throw error;
    },
  };
}
