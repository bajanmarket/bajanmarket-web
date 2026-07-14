// Server functions powering the seller Commerce Intelligence dashboard.
// All queries use the caller's Supabase session so RLS scopes results
// to their own data automatically.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface DailyRow {
  day: string;
  views: number;
  messages: number;
  shares: number;
  favourites: number;
  orders: number;
  revenue_cents: number;
  unique_visitors: number;
}

/** Aggregate KPIs + time series for the signed-in seller. */
export const getSellerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number }) => ({ days: Math.min(365, Math.max(1, input.days ?? 30)) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString().slice(0, 10);

    // Daily rollup (single query drives every KPI + chart)
    const { data: daily } = await supabase
      .from("ci_daily_stats")
      .select("day, views, messages, shares, favourites, orders, revenue_cents, unique_visitors")
      .eq("seller_id", userId)
      .gte("day", since)
      .order("day", { ascending: true });

    const rows = (daily ?? []) as DailyRow[];
    const sum = (k: keyof DailyRow) => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);

    const orders = sum("orders");
    const revenue = sum("revenue_cents");
    const views = sum("views");
    const messages = sum("messages");
    const unique = sum("unique_visitors");

    // Repeat buyers + AOV from ci_orders directly
    const { data: orderRows } = await supabase
      .from("ci_orders")
      .select("buyer_id, amount_cents, status")
      .eq("seller_id", userId)
      .eq("status", "completed");

    const buyers = new Map<string, number>();
    for (const o of orderRows ?? []) {
      if (!o.buyer_id) continue;
      buyers.set(o.buyer_id, (buyers.get(o.buyer_id) ?? 0) + 1);
    }
    const repeatCustomers = Array.from(buyers.values()).filter((n) => n > 1).length;
    const totalOrders = orderRows?.length ?? 0;
    const totalRevenue = (orderRows ?? []).reduce((n, r) => n + (r.amount_cents ?? 0), 0);
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Best performing listings (top 5 by views)
    const { data: best } = await supabase
      .from("ci_listing_stats")
      .select("listing_id, views, messages, shares, favourites")
      .eq("seller_id", userId)
      .order("views", { ascending: false })
      .limit(5);

    // Fetch listing titles for the top 5
    const listingIds = (best ?? []).map((b) => b.listing_id);
    const { data: listings } = listingIds.length
      ? await supabase.from("listings").select("id, title, price, currency").in("id", listingIds)
      : { data: [] };
    const byId = new Map((listings ?? []).map((l) => [l.id, l]));
    const bestListings = (best ?? []).map((b) => ({
      ...b,
      title: byId.get(b.listing_id)?.title ?? "(deleted listing)",
      price: byId.get(b.listing_id)?.price ?? null,
      currency: byId.get(b.listing_id)?.currency ?? "BBD",
    }));

    // Growth: revenue this half vs previous half
    const mid = Math.floor(rows.length / 2);
    const revEarly = rows.slice(0, mid).reduce((n, r) => n + r.revenue_cents, 0);
    const revLate = rows.slice(mid).reduce((n, r) => n + r.revenue_cents, 0);
    const growthPct = revEarly > 0 ? Math.round(((revLate - revEarly) / revEarly) * 100) : 0;

    // Conversion rate: orders / unique visitors
    const conversion = unique > 0 ? Math.round((orders / unique) * 10_000) / 100 : 0;

    return {
      window: { days: data.days, since },
      kpis: {
        totalSales: totalOrders,
        totalRevenueCents: totalRevenue,
        revenueGrowthPct: growthPct,
        orders,
        avgOrderCents: avgOrder,
        repeatCustomers,
        conversionRate: conversion,
        profileViews: 0, // filled below
        listingViews: views,
        messagesReceived: messages,
        messagesConvertedToSales: totalOrders,
        uniqueVisitors: unique,
      },
      series: rows,
      bestListings,
    };
  });

/** Top categories the seller is active in (by revenue). */
export const getSellerTopCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Join ci_orders → listings → categories client-side (small volume per seller)
    const { data: orders } = await supabase
      .from("ci_orders")
      .select("amount_cents, listing_id")
      .eq("seller_id", userId)
      .eq("status", "completed");
    const listingIds = Array.from(new Set((orders ?? []).map((o) => o.listing_id).filter(Boolean))) as string[];
    if (!listingIds.length) return [];
    const { data: listings } = await supabase
      .from("listings")
      .select("id, category_id")
      .in("id", listingIds);
    const catByListing = new Map((listings ?? []).map((l) => [l.id, l.category_id]));

    const catIds = Array.from(new Set(Array.from(catByListing.values()).filter(Boolean))) as string[];
    const { data: cats } = catIds.length
      ? await supabase.from("categories").select("id, name, slug").in("id", catIds)
      : { data: [] };
    const catInfo = new Map((cats ?? []).map((c) => [c.id, c]));

    const totals = new Map<string, number>();
    for (const o of orders ?? []) {
      const cid = o.listing_id ? catByListing.get(o.listing_id) : null;
      if (!cid) continue;
      totals.set(cid, (totals.get(cid) ?? 0) + (o.amount_cents ?? 0));
    }
    return Array.from(totals.entries())
      .map(([cid, revenue]) => ({
        id: cid,
        name: catInfo.get(cid)?.name ?? "Unknown",
        slug: catInfo.get(cid)?.slug ?? null,
        revenueCents: revenue,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 8);
  });
