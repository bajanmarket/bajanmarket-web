import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Parish = Database["public"]["Enums"]["parish"];

const recent = new Map<string, number>();

/**
 * Fire-and-forget search log. De-duplicates identical searches within 2s
 * (e.g. React StrictMode double-fires, rapid refetches).
 */
export function logSearchEvent(opts: {
  query: string;
  parish?: Parish | null;
  categorySlug?: string | null;
  resultCount: number;
}) {
  const query = opts.query.trim().toLowerCase();
  if (!query) return;
  if (query.length > 200) return;

  const key = `${query}|${opts.parish ?? ""}|${opts.categorySlug ?? ""}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < 2000) return;
  recent.set(key, now);

  // Prune periodically
  if (recent.size > 50) {
    for (const [k, t] of recent) if (now - t > 10_000) recent.delete(k);
  }

  supabase.auth.getUser().then(({ data }) => {
    supabase
      .from("search_events")
      .insert({
        query,
        parish: opts.parish ?? null,
        category_slug: opts.categorySlug ?? null,
        result_count: opts.resultCount,
        user_id: data.user?.id ?? null,
      })
      .then(() => {});
  });
}
