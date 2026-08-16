import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useIsModerator } from "@/lib/useIsModerator";
import { SellerGrowthModule } from "@/components/seller-growth/SellerGrowthModule";

export const Route = createFileRoute("/_authenticated/admin/seller-growth")({
  head: () => ({
    meta: [
      { title: "Seller Growth Agent — BajanMarket" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SellerGrowthPage,
});

function SellerGrowthPage() {
  const { data: role, isLoading } = useIsModerator();

  if (isLoading) return <AppShell><div className="text-navy/40 text-sm">Checking access…</div></AppShell>;

  if (!role?.isAdmin) {
    return (
      <AppShell>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <Shield className="size-8 mx-auto text-navy/40" />
          <h1 className="text-xl font-medium mt-3">Admins only</h1>
          <p className="text-sm text-navy/60 mt-2">The Seller Growth Agent is restricted to administrators.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link to="/admin" className="text-xs text-navy/50 hover:text-navy inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="size-3" /> Back to Admin
      </Link>
      <SellerGrowthModule />
    </AppShell>
  );
}
