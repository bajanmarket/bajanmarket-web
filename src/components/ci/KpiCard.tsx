// Small stat tile used across every BI dashboard.
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}

export function KpiCard({ label, value, hint, tone = "default" }: Props) {
  const hintCls =
    tone === "positive" ? "text-teal" :
    tone === "negative" ? "text-coral" : "text-navy/50";
  return (
    <div className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex flex-col gap-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-navy/50 font-semibold">{label}</div>
      <div className="text-2xl font-medium text-navy truncate">{value}</div>
      {hint ? <div className={`text-xs ${hintCls}`}>{hint}</div> : null}
    </div>
  );
}
