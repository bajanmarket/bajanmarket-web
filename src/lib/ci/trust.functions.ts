// Trust Score — Module 4. Reads a cached public score for any seller,
// and lets the signed-in seller trigger a fresh compute.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function serverPublic() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Public: fetch a seller's current trust score (may be null if never computed). */
export const getTrustScore = createServerFn({ method: "GET" })
  .inputValidator((input: { sellerId: string }) => ({ sellerId: z.string().uuid().parse(input.sellerId) }))
  .handler(async ({ data }) => {
    const supabase = serverPublic();
    const { data: row } = await supabase
      .from("ci_trust_scores")
      .select("score, breakdown, computed_at")
      .eq("seller_id", data.sellerId)
      .maybeSingle();
    return row;
  });

/** Signed-in seller can force recompute of their own score. */
export const recomputeMyTrustScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("ci_compute_trust_score", { _seller_id: userId });
    if (error) throw error;
    return { score: data as number };
  });
