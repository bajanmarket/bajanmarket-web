import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updatePlanSettings } from "@/lib/plans.functions";
import { Sparkles, Star } from "lucide-react";

type Plan = "free" | "premium" | "business";
type Row = { plan: Plan; enabled: boolean; price_bbd_cents: number; featured_days: number };

export function MarketplaceControlsPanel() {
  const qc = useQueryClient();
  const update = useServerFn(updatePlanSettings);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plan-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("plan_settings").select("*").order("plan");
      return (data ?? []) as Row[];
    },
  });

  const { data: featuredCount } = useQuery({
    queryKey: ["featured-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .gt("featured_until", new Date().toISOString());
      return count ?? 0;
    },
  });

  const save = useMutation({
    mutationFn: (patch: { plan: Plan; enabled?: boolean; price_bbd_cents?: number; featured_days?: number }) =>
      update({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-settings"] });
      toast.success("Saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !plans) return <div className="text-navy/40 text-sm">Loading…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <div className="flex items-center gap-2 text-xs text-navy/60">
          <Star className="size-4" /> Currently featured listings
        </div>
        <div className="text-2xl font-medium mt-1">{featuredCount ?? 0}</div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {plans.map((p) => (
          <PlanCard key={p.plan} row={p} onSave={(patch) => save.mutate({ plan: p.plan, ...patch })} saving={save.isPending} />
        ))}
      </div>

      <p className="text-xs text-navy/50">
        Payments aren't live yet — enabling a plan makes it visible in the app foundation but won't charge anyone. Featured duration is used when a listing gets promoted via a paid plan.
      </p>
    </div>
  );
}

function PlanCard({ row, onSave, saving }: {
  row: Row;
  onSave: (patch: { enabled?: boolean; price_bbd_cents?: number; featured_days?: number }) => void;
  saving: boolean;
}) {
  const [price, setPrice] = useState(String(row.price_bbd_cents / 100));
  const [days, setDays] = useState(String(row.featured_days));
  useEffect(() => { setPrice(String(row.price_bbd_cents / 100)); setDays(String(row.featured_days)); }, [row]);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-teal" />
        <h3 className="font-medium capitalize">{row.plan}</h3>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={row.enabled}
          disabled={row.plan === "free" || saving}
          onChange={(e) => onSave({ enabled: e.target.checked })}
          className="size-4 accent-teal"
        />
        <span>Enabled</span>
      </label>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-navy/50">Price (BBD $ / month)</label>
        <input
          type="number" min={0} step={0.5} value={price} disabled={row.plan === "free"}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const cents = Math.round(parseFloat(price || "0") * 100);
            if (cents !== row.price_bbd_cents) onSave({ price_bbd_cents: cents });
          }}
          className="w-full bg-sand rounded-xl px-3 py-2 text-sm mt-1 disabled:opacity-60"
        />
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-navy/50">Featured duration (days)</label>
        <input
          type="number" min={0} step={1} value={days} disabled={row.plan === "free"}
          onChange={(e) => setDays(e.target.value)}
          onBlur={() => {
            const d = parseInt(days || "0", 10);
            if (d !== row.featured_days) onSave({ featured_days: d });
          }}
          className="w-full bg-sand rounded-xl px-3 py-2 text-sm mt-1 disabled:opacity-60"
        />
      </div>
    </div>
  );
}
