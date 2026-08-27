/**
 * Client-side fire-and-forget wrappers around the Phase 4 capture endpoints.
 *
 * These NEVER throw and never return anything the UI depends on. Anonymous
 * visitors are skipped entirely (no request, no write).
 */
import { supabase } from "@/integrations/supabase/client";
import { processSearchIntent, recordListingViewIntent } from "./buyerIntent.functions";
import { CAPTURE_CONFIG } from "./matching/weights";

/** Guards against a remount/refetch of the same search URL re-firing capture.
 *  The browse route only searches on explicit submit/navigation, so this is a
 *  belt-and-braces guard, not the primary keystroke protection. */
const recentSearchCaptures = new Map<string, number>();

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
  const key = [
    payload.query.trim().toLowerCase(),
    payload.categorySlug ?? "",
    payload.parish ?? "",
    payload.minPrice ?? "",
    payload.maxPrice ?? "",
  ].join("|");
  const now = Date.now();
  const last = recentSearchCaptures.get(key);
  if (last && now - last < CAPTURE_CONFIG.searchCaptureDedupeSeconds * 1000) return;
  recentSearchCaptures.set(key, now);
  if (recentSearchCaptures.size > 50) {
    for (const [k, t] of recentSearchCaptures) {
      if (now - t > CAPTURE_CONFIG.searchCaptureDedupeSeconds * 1000) recentSearchCaptures.delete(k);
    }
  }
  void whenSignedIn(() => processSearchIntent({ data: payload }));
}

export function captureListingViewClient(listingId: string) {
  void whenSignedIn(() => recordListingViewIntent({ data: { listingId } }));
}
