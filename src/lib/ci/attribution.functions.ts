// Marketing attribution — seller-generated tracking campaigns and ROI.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CHANNELS = [
  "facebook","instagram","tiktok","whatsapp","email","qr","influencer","flyer","radio","event","other",
] as const;

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel: z.enum(CHANNELS),
  destinationPath: z.string().trim().min(1).max(512).regex(/^\//, "Must start with /"),
  costCents: z.number().int().min(0).default(0),
  notes: z.string().trim().max(1000).optional(),
});

/** Generate a random URL-safe 8-char code. */
function randomCode() {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("attribution_campaigns")
      .select("*")
      .eq("seller_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Retry up to 5 times on unique-code collision
    for (let i = 0; i < 5; i++) {
      const code = randomCode();
      const { data: row, error } = await supabase
        .from("attribution_campaigns")
        .insert({
          seller_id: userId,
          code,
          name: data.name,
          channel: data.channel,
          destination_path: data.destinationPath,
          cost_cents: data.costCents,
          notes: data.notes ?? null,
        })
        .select()
        .single();
      if (!error) return row;
      if (!/duplicate/i.test(error.message)) throw error;
    }
    throw new Error("Could not allocate campaign code — try again");
  });

export const archiveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("attribution_campaigns")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("seller_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export interface CampaignReportRow {
  id: string;
  code: string;
  name: string;
  channel: string;
  costCents: number;
  clicks: number;
  visitors: number;
  orders: number;
  revenueCents: number;
  conversionRate: number;
  roi: number;
  costPerSale: number | null;
}

/** ROI report for all of the current seller's campaigns. */
export const getCampaignReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: campaigns } = await supabase
      .from("attribution_campaigns")
      .select("id, code, name, channel, cost_cents")
      .eq("seller_id", userId);
    if (!campaigns?.length) return [] as CampaignReportRow[];

    const ids = campaigns.map((c) => c.id);
    // Clicks + unique visitors from ci_events
    const { data: events } = await supabase
      .from("ci_events")
      .select("campaign_id, session_id, event_type")
      .in("campaign_id", ids);

    // Orders attributed to these campaigns
    const { data: orders } = await supabase
      .from("ci_orders")
      .select("attribution_campaign_id, amount_cents, status")
      .in("attribution_campaign_id", ids)
      .eq("status", "completed");

    const byCid = new Map<string, { clicks: number; visitors: Set<string>; orders: number; revenue: number }>();
    for (const c of campaigns) byCid.set(c.id, { clicks: 0, visitors: new Set(), orders: 0, revenue: 0 });

    for (const e of events ?? []) {
      const b = byCid.get(e.campaign_id!);
      if (!b) continue;
      if (e.event_type === "CampaignVisited") b.clicks++;
      if (e.session_id) b.visitors.add(e.session_id);
    }
    for (const o of orders ?? []) {
      const b = byCid.get(o.attribution_campaign_id!);
      if (!b) continue;
      b.orders++;
      b.revenue += o.amount_cents;
    }

    return campaigns.map<CampaignReportRow>((c) => {
      const b = byCid.get(c.id)!;
      const visitors = b.visitors.size;
      const conversion = visitors > 0 ? Math.round((b.orders / visitors) * 10_000) / 100 : 0;
      const roi = c.cost_cents > 0 ? Math.round(((b.revenue - c.cost_cents) / c.cost_cents) * 100) : 0;
      const costPerSale = b.orders > 0 ? Math.round(c.cost_cents / b.orders) : null;
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        channel: c.channel,
        costCents: c.cost_cents,
        clicks: b.clicks,
        visitors,
        orders: b.orders,
        revenueCents: b.revenue,
        conversionRate: conversion,
        roi,
        costPerSale,
      };
    });
  });
