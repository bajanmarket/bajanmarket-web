/**
 * Client-side fire-and-forget wrappers around the Phase 4 capture endpoints.
 *
 * These NEVER throw and never return anything the UI depends on. Anonymous
 * visitors are skipped entirely (no request, no write).
 */
import { supabase } from "@/integrations/supabase/client";
import { processSearchIntent, recordListingViewIntent } from "./buyerIntent.functions";

async function whenSignedIn(run: () => Promise<unknown>) {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await run();
  } catch {
    // Silent by design: capture must never affect browsing.
  }
}

export function captureSearchIntentClient(payload: {
  query: string;
  categorySlug?: string | null;
  parish?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}) {
  void whenSignedIn(() => processSearchIntent({ data: payload }));
}

export function captureListingViewClient(listingId: string) {
  void whenSignedIn(() => recordListingViewIntent({ data: { listingId } }));
}
