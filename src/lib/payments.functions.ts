import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentsStatus = {
  enabled: boolean;
  announcementEnabled: boolean;
};

/** Public: which payment surfaces (if any) should render. */
export const getPaymentsStatus = createServerFn({ method: "GET" }).handler(async (): Promise<PaymentsStatus> => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await client.from("platform_feature_flags").select("key, enabled");
  const map = new Map((data ?? []).map((r: { key: string; enabled: boolean }) => [r.key, r.enabled]));
  return {
    enabled: map.get("marketplace_payments_enabled") === true,
    announcementEnabled: map.get("marketplace_payments_announcement_enabled") === true,
  };
});

/** Seller-facing: my payment account, recent sales, payouts. Empty while disabled. */
export const getMyPaymentsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: flags } = await supabase
      .from("platform_feature_flags")
      .select("key, enabled")
      .eq("key", "marketplace_payments_enabled")
      .maybeSingle();
    const enabled = flags?.enabled === true;
    if (!enabled) {
      return { enabled: false, account: null, sales: [], purchases: [], payouts: [] };
    }

    const [account, sales, purchases, payouts] = await Promise.all([
      supabase.from("seller_payment_accounts").select("*").eq("seller_id", userId).maybeSingle(),
      supabase
        .from("payment_transactions")
        .select("*")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payment_transactions")
        .select("*")
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("seller_payouts")
        .select("*")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      enabled: true,
      account: account.data ?? null,
      sales: sales.data ?? [],
      purchases: purchases.data ?? [],
      payouts: payouts.data ?? [],
    };
  });
