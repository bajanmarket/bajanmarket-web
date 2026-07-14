// Module 4 — Trust score breakdown for the signed-in seller.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getTrustScore, recomputeMyTrustScore } from "@/lib/ci/trust.functions";
import { useAuth } from "@/lib/useAuth";
import { ShieldCheck, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bi/trust")({
  component: Trust,
});

const FACTORS: { key: string; label: string; weight: string }[] = [
  { key: "email_verified", label: "Email verified", weight: "15 pts" },
  { key: "phone_verified", label: "Phone verified", weight: "10 pts" },
  { key: "business_verified", label: "Business verified", weight: "15 pts" },
  { key: "completed_sales", label: "Completed sales", weight: "up to 20 pts" },
  { key: "repeat_customers", label: "Repeat customers", weight: "up to 10 pts" },
  { key: "reviews_avg", label: "Average review", weight: "up to 15 pts" },
  { key: "years_on_platform", label: "Years on platform", weight: "up to 10 pts" },
  { key: "refund_pct", label: "Refund rate", weight: "−15 pts penalty" },
];

function Trust() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchScore = useServerFn(getTrustScore);
  const recompute = useServerFn(recomputeMyTrustScore);

  const { data } = useQuery({
    queryKey: ["trust-score", user?.id],
    enabled: !!user,
    queryFn: () => fetchScore({ data: { sellerId: user!.id } }),
  });

  const recomputeMut = useMutation({
    mutationFn: () => recompute(),
    onSuccess: () => {
      toast.success("Score refreshed");
      qc.invalidateQueries({ queryKey: ["trust-score"] });
    },
  });

  const breakdown = (data?.breakdown ?? {}) as Record<string, unknown>;

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white rounded-2xl ring-1 ring-hairline p-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-navy/50 font-semibold">Your trust score</div>
          <div className="text-5xl font-medium mt-1 text-teal flex items-center gap-3">
            <ShieldCheck className="size-8" /> {data?.score ?? "—"} <span className="text-sm text-navy/40 font-normal">/ 100</span>
          </div>
          {data?.computed_at && <div className="text-xs text-navy/50 mt-1">Updated {new Date(data.computed_at).toLocaleString()}</div>}
        </div>
        <button
          onClick={() => recomputeMut.mutate()}
          disabled={recomputeMut.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-navy text-white px-4 py-2 text-sm"
        >
          <RefreshCw className={`size-4 ${recomputeMut.isPending ? "animate-spin" : ""}`} /> Recompute
        </button>
      </section>

      <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <h2 className="text-sm font-semibold mb-3">How it's calculated</h2>
        <div className="grid md:grid-cols-2 gap-2">
          {FACTORS.map((f) => (
            <div key={f.key} className="flex items-center justify-between text-sm bg-sand rounded-lg p-3">
              <div>
                <div className="font-medium">{f.label}</div>
                <div className="text-xs text-navy/50">{f.weight}</div>
              </div>
              <div className="text-sm text-navy/80 tabular-nums">
                {String(breakdown[f.key] ?? "—")}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
