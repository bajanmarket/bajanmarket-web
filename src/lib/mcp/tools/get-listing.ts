import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "get_listing",
  title: "Get listing",
  description: "Fetch full details for a single active listing by id, including images and seller display name.",
  inputSchema: {
    id: z.string().uuid().describe("Listing UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const sb = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data, error } = await sb
      .from("listings")
      .select("*, listing_images(url, sort_order), profiles!listings_seller_id_fkey(display_name, parish)")
      .eq("id", id)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Listing not found." }], isError: true };
    const out = { ...data, url: `https://bajanmarket.app/listing/${data.id}` };
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      structuredContent: { listing: out },
    };
  },
});
