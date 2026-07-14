// Module 3 — Marketplace intelligence for the current seller (public data).
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMarketOverview, getTrendingSearches } from "@/lib/ci/market.functions";
import { formatMoneyCents, formatNumber } from "@/lib/ci/format";

export const Route = createFileRoute("/_authenticated/bi/insights")({
  component: Insights,
});

function Insights() {
  const fetchMarket = useServerFn(getMarketOverview);
  const fetchTrend = useServerFn(getTrendingSearches);
  const { data: market } = useQuery({ queryKey: ["ci-market"], queryFn: () => fetchMarket() });
  const { data: trending } = useQuery({ queryKey: ["ci-trending"], queryFn: () => fetchTrend() });

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <h2 className="text-sm font-semibold mb-3">Category snapshot</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase text-navy/50 border-b border-hairline">
              <tr>
                <th className="p-2">Category</th>
                <th className="p-2">Active inventory</th>
                <th className="p-2">Avg price</th>
                <th className="p-2">Suggested price</th>
                <th className="p-2">Trend (7d views)</th>
              </tr>
            </thead>
            <tbody>
              {(market ?? []).map((c) => (
                <tr key={c.id} className="border-b border-hairline last:border-0">
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2">{formatNumber(c.stats?.active_inventory)}</td>
                  <td className="p-2">{formatMoneyCents(c.stats?.avg_price_cents)}</td>
                  <td className="p-2">{formatMoneyCents(c.stats?.recommended_price_cents)}</td>
                  <td className="p-2">{formatNumber(c.stats?.trending_score ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-navy/50 mt-3">Stats refresh hourly. Post on the recommended day/time to maximise views.</p>
      </section>

      <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <h2 className="text-sm font-semibold mb-3">Trending searches (7 days)</h2>
        {trending?.length ? (
          <div className="flex flex-wrap gap-2">
            {trending.map((t) => (
              <span key={t.query} className="rounded-full bg-sand ring-1 ring-hairline px-3 py-1 text-xs">
                {t.query} · <span className="text-navy/50">{t.count}</span>
              </span>
            ))}
          </div>
        ) : <p className="text-sm text-navy/50">Not enough search activity yet.</p>}
      </section>
    </div>
  );
}
