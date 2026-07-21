import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PlanEnum = z.enum(["free", "premium", "business"]);

export const updatePlanSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      plan: PlanEnum,
      enabled: z.boolean().optional(),
      price_bbd_cents: z.number().int().min(0).max(1_000_000).optional(),
      featured_days: z.number().int().min(0).max(365).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.price_bbd_cents !== undefined) patch.price_bbd_cents = data.price_bbd_cents;
    if (data.featured_days !== undefined) patch.featured_days = data.featured_days;
    const { error } = await supabaseAdmin
      .from("plan_settings")
      .update(patch)
      .eq("plan", data.plan);
    if (error) throw error;
    return { ok: true };
  });
