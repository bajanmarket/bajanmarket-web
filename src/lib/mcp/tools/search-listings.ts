import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "search_listings",
  title: "Search listings",
  description:
    "Search active public listings on Bajan.market by keyword, parish, category, and price range. Returns titles, prices, condition, parish, and links.",
  inputSchema: {
    query: z.string().trim().max(200).optional().describe("Free-text search across title and description."),
    parish: z.string().trim().max(50).optional().describe("Filter by Barbados parish (e.g. 'St. Michael')."),
    category_slug: z.string().trim().max(50).optional().describe("Filter by category slug (e.g. 'vehicles')."),
    min_price: z.number().min(0).optional(),
    max_price: z.number().min(0).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const sb = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    let cat_id: string | undefined;
    if (input.category_slug) {
      const { data } = await sb.from("categories").select("id").eq("slug", input.category_slug).maybeSingle();
      cat_id = data?.id;
    }

    let q = sb
      .from("listings")
      .select("id, title, description, price, currency, condition, parish, cover_image_url, created_at, views, favourite_count")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 20);

    if (input.query) q = q.or(`title.ilike.%${input.query}%,description.ilike.%${input.query}%`);
    if (input.parish) q = q.eq("parish", input.parish as Database["public"]["Enums"]["parish"]);
    if (cat_id) q = q.eq("category_id", cat_id);
    if (typeof input.min_price === "number") q = q.gte("price", input.min_price);
    if (typeof input.max_price === "number") q = q.lte("price", input.max_price);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []).map((l) => ({
      ...l,
      url: `https://bajanmarket.app/listing/${l.id}`,
      description: l.description?.slice(0, 240) ?? "",
    }));
    return {
      content: [{ type: "text", text: `Found ${rows.length} listings.\n\n${JSON.stringify(rows, null, 2)}` }],
      structuredContent: { count: rows.length, listings: rows },
    };
  },
});
