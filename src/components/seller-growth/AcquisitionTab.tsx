import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, RefreshCw, Ban, Store } from "lucide-react";
import {
  generateDraftStore,
  issueClaimLink,
  listDraftStores,
  revokeClaimLinks,
} from "@/lib/draftStore.functions";
import { WebContentPanel } from "@/components/seller-growth/WebContentPanel";

const card = "bg-white rounded-2xl ring-1 ring-hairline p-4";
const btn = "text-xs font-medium px-3 py-1.5 rounded-lg bg-navy text-white disabled:opacity-40";
const btnGhost =
  "text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-hairline text-navy/70 hover:text-navy disabled:opacity-40";

export function AcquisitionTab() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const generate = useServerFn(generateDraftStore);
  const issue = useServerFn(issueClaimLink);
  const revoke = useServerFn(revokeClaimLinks);
  const list = useServerFn(listDraftStores);

  const stores = useQuery({ queryKey: ["draft-stores"], queryFn: () => list({}) });

  const leads = useQuery({
    queryKey: ["acquisition-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_prospects")
        .select("id, business_name, parish, seller_type, lead_score, acquisition_status, public_email, public_whatsapp")
        .order("lead_score", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["draft-stores"] }),
      qc.invalidateQueries({ queryKey: ["acquisition-leads"] }),
    ]);
  };

  const withDraft = new Set((stores.data?.stores ?? []).map((s) => s.prospect_id));

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <h3 className="text-sm font-medium">Draft storefronts</h3>
        <p className="text-xs text-navy/60 mt-1 leading-relaxed">
          Build a private preview of a lead's BajanMarket storefront from their public business information, then send
          them a claim link. Nothing is public until the owner claims and publishes it.
        </p>
      </div>

      <WebContentPanel />



      <div className={card}>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy/50 mb-3">Leads without a draft store</h4>
        <div className="flex flex-col gap-2">
          {(leads.data ?? [])
            .filter((l) => !withDraft.has(l.id))
            .slice(0, 30)
            .map((l) => (
              <div key={l.id} className="flex items-center gap-3 text-sm border-b border-hairline last:border-0 pb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{l.business_name}</p>
                  <p className="text-[11px] text-navy/50">
                    Score {l.lead_score ?? 0} · {l.parish ?? "parish unknown"} · {l.acquisition_status ?? "discovered"}
                  </p>
                </div>
                <button
                  className={btn}
                  disabled={busy === l.id}
                  onClick={async () => {
                    setBusy(l.id);
                    try {
                      const res = await generate({ data: { prospectId: l.id, regenerate: false } });
                      if (!res.ok) toast.error(res.error);
                      else toast.success(`Draft storefront ready (${res.items ?? 0} items)`);
                      await refresh();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                    setBusy(null);
                  }}
                >
                  {busy === l.id ? <Loader2 className="size-3 animate-spin" /> : "Build draft store"}
                </button>
              </div>
            ))}
          {(leads.data ?? []).filter((l) => !withDraft.has(l.id)).length === 0 && (
            <p className="text-xs text-navy/50">Every lead already has a draft storefront.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {(stores.data?.stores ?? []).map((s) => {
          const items = (stores.data?.items ?? []).filter((i) => i.draft_store_id === s.id);
          const tokens = (stores.data?.tokens ?? []).filter((t) => t.draft_store_id === s.id);
          const live = tokens.find((t) => !t.revoked_at && !t.claimed_at);
          return (
            <div key={s.id} className={card}>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-sand grid place-items-center shrink-0">
                  <Store className="size-4 text-navy/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.business_name}</p>
                  <p className="text-[11px] text-navy/50 mt-0.5">
                    /{s.slug} · {items.length} items · {s.claim_status ?? "unclaimed"}
                    {live ? ` · ${live.view_count ?? 0} preview views` : ""}
                  </p>
                </div>
              </div>

              {items.length > 0 && (
                <details className="mt-3 rounded-xl bg-sand/60 px-3 py-2">
                  <summary className="text-[11px] font-medium text-navy/60 cursor-pointer">
                    Image source debug (admin only)
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {items.map((i) => (
                      <div key={i.id} className="text-[11px] text-navy/60 leading-relaxed border-b border-hairline last:border-0 pb-1">
                        <span className="font-medium text-navy/80">{i.title}</span>
                        <br />
                        Source: {i.source_platform ?? "—"}
                        {i.source_url ? (
                          <>
                            {" · "}
                            <a href={i.source_url} target="_blank" rel="noreferrer" className="underline">
                              post
                            </a>
                          </>
                        ) : null}
                        {i.source_posted_at ? ` · ${new Date(i.source_posted_at).toLocaleDateString()}` : ""}
                        <br />
                        Original media: {i.image_url ? "available" : "unavailable"} · Stored media:{" "}
                        {i.stored_media_url ? "available" : "unavailable"} · Preview image:{" "}
                        {i.stored_media_url
                          ? "stored copy"
                          : i.image_url
                            ? "original"
                            : "placeholder"}
                        {i.image_source ? ` (${i.image_source})` : ""}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  className={btnGhost}
                  disabled={busy === s.id}
                  onClick={async () => {
                    setBusy(s.id);
                    try {
                      const res = await generate({ data: { prospectId: s.prospect_id, regenerate: true } });
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Draft regenerated");
                      await refresh();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                    setBusy(null);
                  }}
                >
                  <RefreshCw className="size-3 inline mr-1" /> Regenerate
                </button>

                <button
                  className={btn}
                  disabled={busy === s.id || s.claim_status === "claimed"}
                  onClick={async () => {
                    setBusy(s.id);
                    try {
                      const res = await issue({ data: { draftStoreId: s.id } });
                      await navigator.clipboard.writeText(res.url).catch(() => {});
                      toast.success("Claim link copied to clipboard");
                      await refresh();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                    setBusy(null);
                  }}
                >
                  <Copy className="size-3 inline mr-1" /> New claim link
                </button>

                {live && (
                  <button
                    className={btnGhost}
                    disabled={busy === s.id}
                    onClick={async () => {
                      setBusy(s.id);
                      try {
                        await revoke({ data: { draftStoreId: s.id } });
                        toast.success("Claim links revoked");
                        await refresh();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                      setBusy(null);
                    }}
                  >
                    <Ban className="size-3 inline mr-1" /> Revoke links
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {stores.isLoading && <p className="text-xs text-navy/50">Loading draft storefronts…</p>}
        {!stores.isLoading && (stores.data?.stores ?? []).length === 0 && (
          <p className="text-xs text-navy/50">No draft storefronts yet.</p>
        )}
      </div>
    </div>
  );
}
