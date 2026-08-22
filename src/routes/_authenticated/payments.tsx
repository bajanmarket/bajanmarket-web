import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { usePaymentsStatus } from "@/lib/usePayments";
import { getMyPaymentsOverview } from "@/lib/payments.functions";
import { CreditCard, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments & Payouts — BajanMarket" },
      { name: "description", content: "Track your BajanMarket sales, receipts and payouts in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaymentsPage,
});

const money = (cents: number, currency = "BBD") =>
  `${currency} $${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

function PaymentsPage() {
  const { data: status, isLoading: statusLoading } = usePaymentsStatus();
  const fetchOverview = useServerFn(getMyPaymentsOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["my-payments"],
    enabled: status?.enabled === true,
    queryFn: () => fetchOverview(),
  });

  if (statusLoading) return <AppShell><div className="text-navy/40 text-sm">Loading…</div></AppShell>;

  if (!status?.enabled) {
    return (
      <AppShell>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <Clock className="size-8 mx-auto text-navy/40" />
          <h1 className="text-xl font-medium mt-3">
            {status?.announcementEnabled ? "Payments are coming soon" : "Payments aren't available yet"}
          </h1>
          <p className="text-sm text-navy/60 mt-2 max-w-md mx-auto">
            {status?.announcementEnabled
              ? "We're preparing secure in-app payments and seller payouts for BajanMarket. Keep listing as usual — we'll let you know the moment it's live."
              : "Buyers and sellers arrange payment directly for now."}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="size-5 text-teal" />
        <h1 className="text-2xl font-medium">Payments &amp; Payouts</h1>
      </div>

      {isLoading || !data ? (
        <div className="text-navy/40 text-sm">Loading…</div>
      ) : (
        <div className="flex flex-col gap-4">
          <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
            <h2 className="text-sm font-medium">Payout account</h2>
            {data.account ? (
              <div className="text-xs text-navy/60 mt-2">
                Status: {data.account.onboarding_status} · Charges {data.account.charges_enabled ? "on" : "off"} · Payouts{" "}
                {data.account.payouts_enabled ? "on" : "off"}
                {data.account.restriction_reason && (
                  <div className="text-coral mt-1">{data.account.restriction_reason}</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-navy/60 mt-2">You haven't set up a payout account yet.</p>
            )}
          </section>

          <Table title="Sales" rows={data.sales} amountKey="seller_net_cents" />
          <Table title="Purchases" rows={data.purchases} amountKey="gross_amount_cents" />

          <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
            <h2 className="text-sm font-medium mb-2">Payouts</h2>
            {data.payouts.length === 0 ? (
              <p className="text-xs text-navy/50">No payouts yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.payouts.map((p) => (
                  <li key={p.id} className="text-xs flex justify-between gap-3">
                    <span className="text-navy/60">{new Date(p.created_at).toLocaleDateString()} · {p.status}</span>
                    <span className="font-medium">{money(Number(p.net_payout_cents), p.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

type Txn = {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  gross_amount_cents: number;
  seller_net_cents: number;
};

function Table({ title, rows, amountKey }: { title: string; rows: Txn[]; amountKey: "gross_amount_cents" | "seller_net_cents" }) {
  return (
    <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
      <h2 className="text-sm font-medium mb-2">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-navy/50">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((t) => (
            <li key={t.id} className="text-xs flex justify-between gap-3">
              <span className="text-navy/60">{new Date(t.created_at).toLocaleDateString()} · {t.status}</span>
              <span className="font-medium">{money(Number(t[amountKey]), t.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
