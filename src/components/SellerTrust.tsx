import { CalendarDays, Package, CheckCircle2, Clock, Store } from "lucide-react";

export type SellerTrustData = {
  created_at: string;
  last_active_at?: string | null;
  listings_count?: number | null;
  activeCount?: number;
  soldCount?: number;
  hasStorefront?: boolean;
};

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-BB", { month: "short", year: "numeric" });

function daysSince(iso?: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Trust signals derived only from real account activity — no invented ratings or badges. */
export function sellerTrustBadges(s: SellerTrustData) {
  const badges: Array<{ icon: typeof CalendarDays; label: string }> = [
    { icon: CalendarDays, label: `Member since ${monthYear(s.created_at)}` },
  ];

  const active = s.activeCount ?? 0;
  const total = s.listings_count ?? active + (s.soldCount ?? 0);
  if (total > 0) {
    badges.push({ icon: Package, label: `${total} listing${total === 1 ? "" : "s"} posted` });
  }
  if ((s.soldCount ?? 0) > 0) {
    badges.push({ icon: CheckCircle2, label: `${s.soldCount} marked sold` });
  }

  const d = daysSince(s.last_active_at);
  if (d !== null && d <= 7) {
    badges.push({ icon: Clock, label: d <= 1 ? "Active today" : `Active in the last ${d} days` });
  }

  if (s.hasStorefront) {
    badges.push({ icon: Store, label: "Approved business storefront" });
  }

  return badges;
}

export function SellerTrust({ data, className = "" }: { data: SellerTrustData; className?: string }) {
  const badges = sellerTrustBadges(data);
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b) => (
        <li
          key={b.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-sand-deep/40 px-2.5 py-1 text-[11px] font-medium text-navy/70"
        >
          <b.icon className="size-3 text-teal" aria-hidden="true" />
          {b.label}
        </li>
      ))}
    </ul>
  );
}
