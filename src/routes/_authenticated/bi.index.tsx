// Module 1 — Seller dashboard: KPIs + revenue chart + best listings + top categories.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { getSellerDashboard, getSellerTopCategories } from "@/lib/ci/dashboard.functions";
import { KpiCard } from "@/components/ci/KpiCard";
import { formatMoneyCents, formatNumber, formatPercent } from "@/lib/ci/format";

export const Route = createFileRoute("/_authenticated/bi/")({
  component: Dashboard,
});

function Dashboard() {
  const [days, setDays] = useState(30);
  const fetchDashboard = useServerFn(getSellerDashboard);
  const fetchCats = useServerFn(getSellerTopCategories);

  const { data, isLoading } = useQuery({
    queryKey: ["ci-dashboard", days],
    queryFn: () => fetchDashboard({ data: { days } }),
  });

  const { data: cats } = useQuery({
    queryKey: ["ci-top-categories"],
    queryFn: () => fetchCats(),
  });

  if (isLoading || !data) return <div className="text-sm text-navy/40">Loading…</div>;

  const k = data.kpis;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-navy/60">Window:</span>
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`text-xs px-2.5 py-1 rounded-lg ${days === d ? "bg-navy text-white" : "bg-white ring-1 ring-hairline"}`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Sales" value={formatNumber(k.totalSales)} />
        <KpiCard label="Total Revenue" value={formatMoneyCents(k.totalRevenueCents)} />
        <KpiCard
          label="Revenue Growth"
          value={formatPercent(k.revenueGrowthPct)}
          tone={k.revenueGrowthPct >= 0 ? "positive" : "negative"}
        />
        <KpiCard label="Avg Order" value={formatMoneyCents(k.avgOrderCents)} />
        <KpiCard label="Repeat Customers" value={formatNumber(k.repeatCustomers)} />
        <KpiCard label="Conversion" value={formatPercent(k.conversionRate)} />
        <KpiCard label="Listing Views" value={formatNumber(k.listingViews)} />
        <KpiCard label="Messages" value={formatNumber(k.messagesReceived)} />
      </div>

      <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <h2 className="text-sm font-semibold mb-3">Revenue over time</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `$${Math.round(v / 100)}`} />
              <Tooltip formatter={(v: number) => formatMoneyCents(v)} />
              <Line type="monotone" dataKey="revenue_cents" stroke="#14b8a6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <h2 className="text-sm font-semibold mb-3">Traffic &amp; engagement</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="views" fill="#0f172a" />
              <Bar dataKey="messages" fill="#ff6b6b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
          <h2 className="text-sm font-semibold mb-3">Best performing listings</h2>
          {data.bestListings.length ? (
            <ul className="flex flex-col divide-y divide-hairline">
              {data.bestListings.map((l) => (
                <li key={l.listing_id} className="py-2 flex items-center justify-between text-sm">
                  <span className="truncate min-w-0 mr-2">{l.title}</span>
                  <span className="text-navy/60 text-xs shrink-0">{formatNumber(l.views)} views</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-navy/50">No data yet.</p>}
        </section>

        <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
          <h2 className="text-sm font-semibold mb-3">Top categories by revenue</h2>
          {cats && cats.length ? (
            <ul className="flex flex-col divide-y divide-hairline">
              {cats.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="truncate min-w-0 mr-2">{c.name}</span>
                  <span className="text-navy/60 text-xs shrink-0">{formatMoneyCents(c.revenueCents)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-navy/50">Log a completed sale to populate this.</p>}
        </section>
      </div>
    </div>
  );
}
