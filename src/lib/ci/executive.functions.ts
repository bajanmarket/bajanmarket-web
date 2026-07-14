// Module 5 — Admin-only marketplace executive dashboard.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getExecutiveOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [{ data: orders }, { data: users }, { data: listings }, { data: events }, { data: parishes }] =
      await Promise.all([
        supabase.from("ci_orders").select("amount_cents, seller_id, buyer_id, sold_at, status").eq("status", "completed"),
        supabase.from("profiles").select("id, created_at, last_active_at, listings_count"),
        supabase.from("listings").select("id, category_id, parish, status, created_at, price"),
        supabase.from("ci_events").select("event_type, occurred_at, session_id").gte("occurred_at", since30),
        supabase.from("listings").select("parish, price").eq("status", "sold"),
      ]);

    const totalRevenue = (orders ?? []).reduce((n, o) => n + (o.amount_cents ?? 0), 0);
    const gmv = totalRevenue; // for now GMV == sum of logged completed orders
    const activeSellers = new Set((listings ?? []).filter((l) => l.status === "active").map((l) => l.category_id)).size;
    const uniqueSellers = new Set((orders ?? []).map((o) => o.seller_id)).size;
    const uniqueBuyers = new Set((orders ?? []).map((o) => o.buyer_id).filter(Boolean)).size;
    const dailyTx = (orders ?? []).filter((o) => new Date(o.sold_at).getTime() > Date.now() - 86_400_000).length;
    const newUsers30 = (users ?? []).filter((u) => new Date(u.created_at).getTime() > Date.now() - 30 * 86_400_000).length;
    const activeUsers30 = (users ?? []).filter((u) => u.last_active_at && new Date(u.last_active_at).getTime() > Date.now() - 30 * 86_400_000).length;
    const retention = users?.length ? Math.round((activeUsers30 / users.length) * 100) : 0;

    // Revenue by parish (from listings marked sold as a fallback)
    const parishRevenue = new Map<string, number>();
    for (const l of parishes ?? []) {
      if (!l.parish) continue;
      parishRevenue.set(l.parish, (parishRevenue.get(l.parish) ?? 0) + Number(l.price ?? 0) * 100);
    }

    return {
      totals: {
        marketplaceRevenueCents: totalRevenue,
        gmvCents: gmv,
        activeSellers: uniqueSellers || activeSellers,
        activeBuyers: uniqueBuyers,
        dailyTransactions: dailyTx,
        newUsers30,
        retentionPct: retention,
        totalUsers: users?.length ?? 0,
        totalListings: listings?.length ?? 0,
        pageviews30: (events ?? []).filter((e) => e.event_type === "PageViewed").length,
        uniqueVisitors30: new Set((events ?? []).map((e) => e.session_id).filter(Boolean)).size,
      },
      revenueByParish: Array.from(parishRevenue.entries())
        .map(([parish, cents]) => ({ parish, revenueCents: cents }))
        .sort((a, b) => b.revenueCents - a.revenueCents),
    };
  });
