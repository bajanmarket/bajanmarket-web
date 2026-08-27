/**
 * Phase 4 — authenticated, silent buyer-intent capture endpoints.
 *
 * Data collection only: nothing here ranks, recommends, or notifies. Every
 * write is gated by the `buyer_intent_capture_enabled` flag and fails closed.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSupabaseCaptureStore } from "./buyerIntentStore";
import { captureSearchIntent, captureListingView } from "./matching/capture";
import type { ListingCondition, Parish } from "./matching/types";

export type SearchIntentPayload = {
  query: string;
  categorySlug?: string | null;
  parish?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
};

export const processSearchIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SearchIntentPayload) => input)
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const query = (data?.query ?? "").toString().slice(0, 200);
      if (!query.trim()) return { ok: true };

      let categoryId: string | null = null;
      if (data.categorySlug) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", data.categorySlug)
          .maybeSingle();
        categoryId = cat?.id ?? null;
      }

      const store = createSupabaseCaptureStore(supabase);
      await captureSearchIntent(store, {
        userId,
        query,
        categoryId,
        parish: (data.parish as Parish | null) ?? null,
        minPrice: data.minPrice ?? null,
        maxPrice: data.maxPrice ?? null,
      });
    } catch {
      // Silent: capture must never surface to the buyer.
      console.warn("[buyer-intent] search capture skipped");
    }
    return { ok: true };
  });

export const recordListingViewIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { listingId: string }) => input)
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const listingId = (data?.listingId ?? "").toString();
      if (!listingId) return { ok: true };

      const { data: listing } = await supabase
        .from("listings")
        .select("id, category_id")
        .eq("id", listingId)
        .maybeSingle();
      if (!listing) return { ok: true };

      const store = createSupabaseCaptureStore(supabase);
      await captureListingView(store, {
        userId,
        listingId: listing.id,
        categoryId: listing.category_id ?? null,
      });
    } catch {
      console.warn("[buyer-intent] listing-view capture skipped");
    }
    return { ok: true };
  });

export type { ListingCondition };
