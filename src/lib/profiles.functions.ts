import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Privileged reads of moderation / behavioural profile fields.
 * These columns are no longer readable by anon or authenticated roles directly;
 * only admins and moderators can fetch them, and only through this function.
 */
async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "moderator"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: staff only");
}

export const listPrivilegedProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        user_ids: z.array(z.string().uuid()).max(5000).optional(),
        limit: z.number().int().min(1).max(5000).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("profiles")
      .select(
        "id, display_name, parish, banned_at, onboarding_intent, onboarding_categories, last_active_at, listings_count, favourites_count, messages_sent_count, first_listing_at",
      )
      .limit(data.limit ?? 2000);

    if (data.user_ids && data.user_ids.length > 0) {
      q = q.in("id", data.user_ids);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
