// Seller-logged sales — feeds Revenue/AOV/ROI. Opt-in per seller.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  listingId: z.string().uuid().nullable().optional(),
  buyerId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  amountCents: z.number().int().min(0),
  currency: z.string().default("BBD"),
  soldAt: z.string().datetime().optional(),
  attributionCampaignId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("ci_orders")
      .select("*")
      .eq("seller_id", userId)
      .order("sold_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ci_orders")
      .insert({
        seller_id: userId,
        listing_id: data.listingId ?? null,
        buyer_id: data.buyerId ?? null,
        conversation_id: data.conversationId ?? null,
        amount_cents: data.amountCents,
        currency: data.currency,
        sold_at: data.soldAt ?? new Date().toISOString(),
        attribution_campaign_id: data.attributionCampaignId ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ci_orders").delete().eq("id", data.id).eq("seller_id", userId);
    if (error) throw error;
    return { ok: true };
  });
