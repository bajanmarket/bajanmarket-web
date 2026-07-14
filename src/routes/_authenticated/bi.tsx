// BI layout: authenticated-only; access is granted to any user (all sellers
// and admins). Individual page queries scope to the caller via RLS.
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BarChart3, Megaphone, TrendingUp, ShieldCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bi")({
  head: () => ({
    meta: [
      { title: "Business Intelligence — Bajan.market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BiLayout,
});

const tabs = [
  { to: "/bi", label: "Dashboard", icon: BarChart3 },
  { to: "/bi/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/bi/insights", label: "Market Insights", icon: TrendingUp },
  { to: "/bi/trust", label: "Trust Score", icon: ShieldCheck },
  { to: "/bi/reports", label: "Reports", icon: FileText },
] as const;

function BiLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="size-5 text-teal" />
        <h1 className="text-2xl font-medium">Business Intelligence</h1>
      </div>
      <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit">
        {tabs.map((t) => {
          const active = pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                active ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
              }`}
            >
              <t.icon className="size-3" />
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AppShell>
  );
}
