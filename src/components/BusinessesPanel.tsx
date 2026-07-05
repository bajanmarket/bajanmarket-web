import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ExternalLink, Store } from "lucide-react";

type Tab = "pending" | "approved" | "rejected";

export function BusinessesPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");

  const { data: businesses, isLoading } = useQuery({
    queryKey: ["admin-businesses", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: Tab; reason?: string | null }) => {
      const { error } = await supabase
        .from("businesses")
        .update({ status, rejection_reason: reason ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-businesses"] });
      toast.success("Business updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

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
      ) : businesses && businesses.length > 0 ? (
        <div className="flex flex-col gap-3">
          {businesses.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex gap-4">
              <div className="size-16 rounded-xl bg-sand-deep overflow-hidden shrink-0 grid place-items-center">
                {b.logo_url ? <img src={b.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="size-6 text-navy/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{b.name}</h3>
                  <span className="text-[10px] font-semibold uppercase bg-sand rounded-full px-2 py-0.5">{b.status}</span>
                </div>
                <div className="text-xs text-navy/50 mt-0.5">/business/{b.slug}</div>
                {b.tagline && <p className="text-sm text-navy/70 mt-1 line-clamp-2">{b.tagline}</p>}
                <div className="text-xs text-navy/50 mt-2 flex flex-wrap gap-3">
                  {b.contact_email && <span>{b.contact_email}</span>}
                  {b.contact_phone && <span>{b.contact_phone}</span>}
                  {b.website && <span className="truncate">{b.website}</span>}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {b.status !== "approved" && (
                    <button
                      onClick={() => setStatus.mutate({ id: b.id, status: "approved", reason: null })}
                      className="text-xs bg-teal/10 text-teal ring-1 ring-teal/20 hover:bg-teal/20 rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="size-3" /> Approve
                    </button>
                  )}
                  {b.status !== "rejected" && (
                    <button
                      onClick={() => {
                        const reason = window.prompt("Reason for rejection (shown to owner):", b.rejection_reason ?? "");
                        if (reason === null) return;
                        setStatus.mutate({ id: b.id, status: "rejected", reason });
                      }}
                      className="text-xs bg-white ring-1 ring-hairline hover:ring-coral/40 rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
                    >
                      <XCircle className="size-3" /> Reject
                    </button>
                  )}
                  {b.status === "approved" && (
                    <Link
                      to="/business/$slug"
                      params={{ slug: b.slug }}
                      className="text-xs bg-white ring-1 ring-hairline hover:ring-navy/20 rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
                    >
                      <ExternalLink className="size-3" /> View
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <h3 className="text-lg font-medium">Nothing here.</h3>
          <p className="text-sm text-navy/60 mt-2">No {tab} businesses.</p>
        </div>
      )}
    </>
  );
}
