// Module — Reports (CSV export of orders + dashboard series).
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { listMyOrders } from "@/lib/ci/orders.functions";
import { getSellerDashboard } from "@/lib/ci/dashboard.functions";

export const Route = createFileRoute("/_authenticated/bi/reports")({
  component: Reports,
});

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// Minimal CSV encoder — escape quotes and wrap in double quotes.
function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function Reports() {
  const fetchOrders = useServerFn(listMyOrders);
  const fetchDaily = useServerFn(getSellerDashboard);

  const ordersMut = useMutation({
    mutationFn: async () => {
      const rows = await fetchOrders();
      download("orders.csv", toCsv(rows));
      toast.success(`Exported ${rows.length} orders`);
    },
  });

  const dailyMut = useMutation({
    mutationFn: async () => {
      const data = await fetchDaily({ data: { days: 365 } });
      download("daily-stats.csv", toCsv(data.series));
      toast.success(`Exported ${data.series.length} days`);
    },
  });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <button onClick={() => ordersMut.mutate()} className="bg-white rounded-2xl ring-1 ring-hairline p-6 text-left hover:ring-teal/40">
        <Download className="size-5 text-teal" />
        <div className="font-medium mt-2">Orders CSV</div>
        <div className="text-xs text-navy/50">All logged sales, including attribution.</div>
      </button>
      <button onClick={() => dailyMut.mutate()} className="bg-white rounded-2xl ring-1 ring-hairline p-6 text-left hover:ring-teal/40">
        <Download className="size-5 text-teal" />
        <div className="font-medium mt-2">Daily performance CSV</div>
        <div className="text-xs text-navy/50">Views, messages, orders, revenue by day.</div>
      </button>
    </div>
  );
}
