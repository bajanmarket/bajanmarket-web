// Module 5 — Admin-only executive dashboard.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useIsModerator } from "@/lib/useIsModerator";
import { getExecutiveOverview } from "@/lib/ci/executive.functions";
import { KpiCard } from "@/components/ci/KpiCard";
import { formatMoneyCents, formatNumber, formatPercent } from "@/lib/ci/format";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/executive")({
  head: () => ({
    meta: [
      { title: "Executive Dashboard — Bajan.market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Exec,
});

function Exec() {
  const { data: role, isLoading: rl } = useIsModerator();
  const fetchExec = useServerFn(getExecutiveOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["ci-exec"],
    enabled: !!role?.isAdmin,
    queryFn: () => fetchExec(),
  });

  if (rl) return <AppShell><div className="text-sm text-navy/40">Checking access…</div></AppShell>;
  if (!role?.isAdmin) {
    return (
      <AppShell>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <Shield className="size-8 mx-auto text-navy/40" />
          <h1 className="text-xl font-medium mt-3">Admins only</h1>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-medium mb-4">Executive Dashboard</h1>
      {isLoading || !data ? (
        <div className="text-sm text-navy/40">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Marketplace Revenue" value={formatMoneyCents(data.totals.marketplaceRevenueCents)} />
            <KpiCard label="GMV" value={formatMoneyCents(data.totals.gmvCents)} />
            <KpiCard label="Active Sellers" value={formatNumber(data.totals.activeSellers)} />
            <KpiCard label="Active Buyers" value={formatNumber(data.totals.activeBuyers)} />
            <KpiCard label="Daily Transactions" value={formatNumber(data.totals.dailyTransactions)} />
            <KpiCard label="New Users (30d)" value={formatNumber(data.totals.newUsers30)} />
            <KpiCard label="Retention" value={formatPercent(data.totals.retentionPct)} />
            <KpiCard label="Unique Visitors (30d)" value={formatNumber(data.totals.uniqueVisitors30)} />
          </div>

          <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
            <h2 className="text-sm font-semibold mb-3">Revenue by parish (sold listings)</h2>
            <ul className="divide-y divide-hairline">
              {data.revenueByParish.map((p) => (
                <li key={p.parish} className="flex justify-between py-2 text-sm">
                  <span>{p.parish}</span>
                  <span className="text-navy/60">{formatMoneyCents(p.revenueCents)}</span>
                </li>
              ))}
              {!data.revenueByParish.length && <li className="py-2 text-sm text-navy/50">No parish revenue yet.</li>}
            </ul>
          </section>
        </>
      )}
    </AppShell>
  );
}
