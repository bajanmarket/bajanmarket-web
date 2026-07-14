// Module 3 — Marketplace intelligence (public/read-only category stats).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Publishable-key server client — public reads only, RLS as anon. */
function serverPublic() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        // opaque sb_ keys aren't JWTs; strip auth so PostgREST accepts apikey
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getMarketOverview = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverPublic();
  const { data: cats } = await supabase.from("categories").select("id, name, slug").order("name");
  const { data: stats } = await supabase.from("ci_category_stats").select("*");
  const byId = new Map((stats ?? []).map((s) => [s.category_id, s]));
  return (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    stats: byId.get(c.id) ?? null,
  }));
});

export const getTrendingSearches = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverPublic();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("search_events")
    .select("query")
    .gte("created_at", since)
    .not("query", "is", null)
    .limit(2000);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const q = (r.query ?? "").trim().toLowerCase();
    if (!q || q.length < 2) continue;
    counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));
});
