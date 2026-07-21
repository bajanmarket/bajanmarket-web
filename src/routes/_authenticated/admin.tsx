import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useIsModerator } from "@/lib/useIsModerator";
import { formatRelative } from "@/lib/format";
import { Shield, Ban, EyeOff, CheckCircle2, XCircle, RotateCcw, BarChart3, Users, Megaphone, ShieldCheck, Store, LineChart, Settings2 } from "lucide-react";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AudiencePanel } from "@/components/AudiencePanel";
import { AdminsPanel } from "@/components/AdminsPanel";
import { BusinessesPanel } from "@/components/BusinessesPanel";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { MarketplaceControlsPanel } from "@/components/MarketplaceControlsPanel";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Moderation — Bajan.market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type ReportRow = {
  id: string;
  created_at: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  target_type: "listing" | "user" | "message";
  target_id: string;
  reporter_id: string;
};

type Tab = "open" | "reviewing" | "resolved" | "dismissed";
type Section = "reports" | "analytics" | "insights" | "audience" | "admins" | "businesses" | "marketplace";

function AdminPage() {
  const { data: role, isLoading: roleLoading } = useIsModerator();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("reports");
  const [tab, setTab] = useState<Tab>("open");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["admin-reports", tab],
    enabled: !!role?.isModerator,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const listingIds = (reports ?? []).filter((r) => r.target_type === "listing").map((r) => r.target_id);
  const userIds = Array.from(new Set([
    ...(reports ?? []).map((r) => r.reporter_id),
    ...(reports ?? []).filter((r) => r.target_type === "user").map((r) => r.target_id),
  ]));

  const { data: listings } = useQuery({
    queryKey: ["admin-listings", listingIds.sort().join(",")],
    enabled: listingIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, title, status, seller_id, cover_image_url")
        .in("id", listingIds);
      return new Map((data ?? []).map((l) => [l.id, l]));
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, banned_at")
        .in("id", userIds);
      return new Map((data ?? []).map((p) => [p.id, p]));
    },
  });

  const setReportStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Tab }) => {
      const { error } = await supabase.from("reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("Report updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setListingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" | "deleted" }) => {
      const { error } = await supabase.from("listings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      toast.success("Listing updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setUserBan = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ banned_at: banned ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success("User updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (roleLoading) return <AppShell><div className="text-navy/40 text-sm">Checking access…</div></AppShell>;
  if (!role?.isModerator) {
    return (
      <AppShell>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <Shield className="size-8 mx-auto text-navy/40" />
          <h1 className="text-xl font-medium mt-3">Moderators only</h1>
          <p className="text-sm text-navy/60 mt-2">You don't have access to this page.</p>
        </div>
      </AppShell>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "reviewing", label: "Reviewing" },
    { key: "resolved", label: "Resolved" },
    { key: "dismissed", label: "Dismissed" },
  ];

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="size-5 text-teal" />
        <h1 className="text-2xl font-medium">Admin</h1>
      </div>

      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit flex-wrap">
        {([
          ["reports", "Reports", Shield],
          ["analytics", "Analytics", LineChart],
          ["insights", "Insights", BarChart3],
          ["audience", "Audience", Users],
          ["admins", "Admins", ShieldCheck],
          ["businesses", "Businesses", Store],
          ["marketplace", "Marketplace", Settings2],
        ] as [Section, string, typeof Shield][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 ${
              section === key ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
            }`}
          >
            <Icon className="size-3" /> {label}
          </button>
        ))}
        <Link
          to="/campaigns"
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 text-navy/60 hover:text-navy"
        >
          <Megaphone className="size-3" /> Campaigns
        </Link>
      </div>


      {section === "analytics" ? (
        <AnalyticsPanel />
      ) : section === "insights" ? (
        <InsightsPanel />
      ) : section === "audience" ? (
        <AudiencePanel />
      ) : section === "admins" ? (
        <AdminsPanel />
      ) : section === "businesses" ? (
        <BusinessesPanel />
      ) : section === "marketplace" ? (
        <MarketplaceControlsPanel />
      ) : (
        <ReportsSection
          tab={tab}
          setTab={setTab}
          tabs={tabs}
          reports={reports}
          isLoading={isLoading}
          listings={listings}
          profiles={profiles}
          setReportStatus={setReportStatus}
          setListingStatus={setListingStatus}
          setUserBan={setUserBan}
        />
      )}
    </AppShell>
  );
}

type ReportsSectionProps = {
  tab: Tab;
  setTab: (t: Tab) => void;
  tabs: { key: Tab; label: string }[];
  reports: ReportRow[] | undefined;
  isLoading: boolean;
  listings: Map<string, { id: string; title: string; status: string; seller_id: string; cover_image_url: string | null }> | undefined;
  profiles: Map<string, { id: string; display_name: string; banned_at: string | null }> | undefined;
  setReportStatus: { mutate: (v: { id: string; status: Tab }) => void };
  setListingStatus: { mutate: (v: { id: string; status: "active" | "paused" | "deleted" }) => void };
  setUserBan: { mutate: (v: { id: string; banned: boolean }) => void };
};

function ReportsSection({
  tab, setTab, tabs, reports, isLoading, listings, profiles,
  setReportStatus, setListingStatus, setUserBan,
}: ReportsSectionProps) {
  return (
    <>
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              tab === t.key ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>


      {isLoading ? (
        <div className="text-navy/40 text-sm">Loading…</div>
      ) : reports && reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reports.map((r) => {
            const listing = r.target_type === "listing" ? listings?.get(r.target_id) : undefined;
            const targetUser = r.target_type === "user" ? profiles?.get(r.target_id) : undefined;
            const reporter = profiles?.get(r.reporter_id);
            const sellerProfile = listing ? profiles?.get(listing.seller_id) : undefined;

            return (
              <div key={r.id} className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide text-navy/40 font-semibold">
                      {r.target_type} · {formatRelative(r.created_at)}
                    </div>
                    <div className="text-sm font-medium mt-1">{r.reason}</div>
                    {r.details && <div className="text-sm text-navy/70 mt-1 whitespace-pre-wrap">{r.details}</div>}
                    <div className="text-xs text-navy/50 mt-2">
                      Reported by {reporter?.display_name ?? "unknown"}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase bg-sand rounded-full px-2 py-1 shrink-0">
                    {r.status}
                  </span>
                </div>

                {listing && (
                  <div className="flex items-center gap-3 bg-sand rounded-xl p-3">
                    <div className="size-12 rounded-lg overflow-hidden bg-sand-deep shrink-0">
                      {listing.cover_image_url && <img src={listing.cover_image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link to="/listing/$id" params={{ id: listing.id }} className="text-sm font-medium truncate block hover:underline">
                        {listing.title}
                      </Link>
                      <div className="text-xs text-navy/50">
                        Status: {listing.status} · Seller: {sellerProfile?.display_name ?? "—"}
                        {sellerProfile?.banned_at && <span className="text-coral font-semibold"> · BANNED</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {listing.status !== "paused" && (
                        <button
                          onClick={() => setListingStatus.mutate({ id: listing.id, status: "paused" })}
                          className="text-xs bg-white ring-1 ring-hairline hover:ring-coral/40 rounded-lg px-2 py-1 inline-flex items-center gap-1"
                        >
                          <EyeOff className="size-3" /> Hide
                        </button>
                      )}
                      {listing.status !== "active" && (
                        <button
                          onClick={() => setListingStatus.mutate({ id: listing.id, status: "active" })}
                          className="text-xs bg-white ring-1 ring-hairline hover:ring-teal/40 rounded-lg px-2 py-1 inline-flex items-center gap-1"
                        >
                          <RotateCcw className="size-3" /> Restore
                        </button>
                      )}
                      {sellerProfile && (
                        sellerProfile.banned_at ? (
                          <button
                            onClick={() => setUserBan.mutate({ id: sellerProfile.id, banned: false })}
                            className="text-xs bg-white ring-1 ring-hairline hover:ring-teal/40 rounded-lg px-2 py-1 inline-flex items-center gap-1"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`Ban ${sellerProfile.display_name}? They won't be able to post listings or send messages.`)) {
                                setUserBan.mutate({ id: sellerProfile.id, banned: true });
                              }
                            }}
                            className="text-xs bg-coral/10 text-coral ring-1 ring-coral/20 hover:bg-coral/20 rounded-lg px-2 py-1 inline-flex items-center gap-1"
                          >
                            <Ban className="size-3" /> Ban seller
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                {targetUser && (
                  <div className="flex items-center gap-3 bg-sand rounded-xl p-3">
                    <div className="flex-1 min-w-0">
                      <Link to="/seller/$id" params={{ id: targetUser.id }} className="text-sm font-medium hover:underline">
                        {targetUser.display_name}
                      </Link>
                      {targetUser.banned_at && <span className="text-coral text-xs font-semibold ml-2">BANNED</span>}
                    </div>
                    <div className="shrink-0">
                      {targetUser.banned_at ? (
                        <button
                          onClick={() => setUserBan.mutate({ id: targetUser.id, banned: false })}
                          className="text-xs bg-white ring-1 ring-hairline rounded-lg px-2 py-1"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (confirm(`Ban ${targetUser.display_name}?`)) {
                              setUserBan.mutate({ id: targetUser.id, banned: true });
                            }
                          }}
                          className="text-xs bg-coral/10 text-coral ring-1 ring-coral/20 hover:bg-coral/20 rounded-lg px-2 py-1 inline-flex items-center gap-1"
                        >
                          <Ban className="size-3" /> Ban
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {r.status !== "reviewing" && (
                    <button
                      onClick={() => setReportStatus.mutate({ id: r.id, status: "reviewing" })}
                      className="text-xs bg-white ring-1 ring-hairline hover:ring-navy/20 rounded-lg px-3 py-1.5"
                    >
                      Mark reviewing
                    </button>
                  )}
                  {r.status !== "resolved" && (
                    <button
                      onClick={() => setReportStatus.mutate({ id: r.id, status: "resolved" })}
                      className="text-xs bg-teal/10 text-teal ring-1 ring-teal/20 hover:bg-teal/20 rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="size-3" /> Resolve
                    </button>
                  )}
                  {r.status !== "dismissed" && (
                    <button
                      onClick={() => setReportStatus.mutate({ id: r.id, status: "dismissed" })}
                      className="text-xs bg-white ring-1 ring-hairline hover:ring-navy/20 rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
                    >
                      <XCircle className="size-3" /> Dismiss
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <h3 className="text-lg font-medium">Nothing here.</h3>
          <p className="text-sm text-navy/60 mt-2">No {tab} reports.</p>
        </div>
      )}
    </>
  );
}
