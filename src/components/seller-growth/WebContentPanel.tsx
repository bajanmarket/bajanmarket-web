import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Globe, RefreshCw, Check, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  addLeadSource,
  getLeadContent,
  scanLeadContent,
  setContentIncluded,
} from "@/lib/webContent.functions";

const card = "bg-white rounded-2xl ring-1 ring-hairline p-4";
const btn = "text-xs font-medium px-3 py-1.5 rounded-lg bg-navy text-white disabled:opacity-40";
const btnGhost =
  "text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-hairline text-navy/70 hover:text-navy disabled:opacity-40";

const STATUS_LABEL: Record<string, string> = {
  content_found: "Content found",
  partial: "Partial",
  no_usable_content: "No usable content",
  failed: "Failed",
  not_configured: "Firecrawl not connected",
};

/** Admin-only view of what Firecrawl actually read from a lead's public pages. */
export function WebContentPanel() {
  const qc = useQueryClient();
  const [leadId, setLeadId] = useState<string>("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const scan = useServerFn(scanLeadContent);
  const load = useServerFn(getLeadContent);
  const toggle = useServerFn(setContentIncluded);
  const addSource = useServerFn(addLeadSource);

  const leads = useQuery({
    queryKey: ["web-content-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_prospects")
        .select("id, business_name, parish")
        .order("lead_score", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const content = useQuery({
    queryKey: ["web-content", leadId],
    enabled: Boolean(leadId),
    queryFn: () => load({ data: { prospectId: leadId } }),
  });

  const reload = () => qc.invalidateQueries({ queryKey: ["web-content", leadId] });
  const summary = content.data?.summary;

  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-navy/40" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-navy/50">Web content</h4>
      </div>
      <p className="text-xs text-navy/60 mt-1 leading-relaxed">
        Real business content read from the lead's own public pages. Nothing here is invented — every item keeps its
        source page, date and confidence. Exclude anything that should not appear in the storefront preview.
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <select
          className="text-xs rounded-lg ring-1 ring-hairline px-2 py-1.5 bg-white min-w-52"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
        >
          <option value="">Select a lead…</option>
          {(leads.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.business_name}
              {l.parish ? ` · ${l.parish.replace(/_/g, " ")}` : ""}
            </option>
          ))}
        </select>
        <button
          className={btn}
          disabled={!leadId || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await scan({ data: { prospectId: leadId, force: true } });
              toast.success(
                `${STATUS_LABEL[res.status] ?? res.status} · ${res.products} products · ${res.services} services · ${res.usableImages}/${res.imagesFound} images usable`,
              );
              await reload();
            } catch (e) {
              toast.error((e as Error).message);
            }
            setBusy(false);
          }}
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : "Scan sources"}
        </button>
        <button className={btnGhost} disabled={!leadId} onClick={() => void reload()}>
          <RefreshCw className="size-3 inline" /> Refresh
        </button>
      </div>

      {leadId && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input
            className="text-xs rounded-lg ring-1 ring-hairline px-2 py-1.5 flex-1 min-w-52"
            placeholder="Add a source URL (website, menu, catalogue, social page)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className={btnGhost}
            disabled={!url}
            onClick={async () => {
              try {
                await addSource({ data: { prospectId: leadId, url } });
                setUrl("");
                toast.success("Source added — run a scan to read it.");
                await reload();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Plus className="size-3 inline" /> Add source
          </button>
        </div>
      )}

      {content.isLoading && <p className="text-xs text-navy/50 mt-3">Loading…</p>}

      {summary && (
        <p className="text-[11px] text-navy/60 mt-3">
          {STATUS_LABEL[summary.status] ?? summary.status} · {summary.sourcesScanned}/{summary.sourcesFound} sources
          scanned · {summary.products} products · {summary.services} services · {summary.usableImages}/
          {summary.imagesFound} images usable
          {summary.lastScan ? ` · last scan ${new Date(summary.lastScan).toLocaleString()}` : ""}
          {summary.note ? ` · ${summary.note}` : ""}
        </p>
      )}

      {(content.data?.sources ?? []).length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          {content.data!.sources.map((s) => (
            <div key={s.id} className="text-[11px] text-navy/60 flex items-center gap-2">
              <span className="rounded px-1.5 py-0.5 bg-sand shrink-0">{s.source_type}</span>
              <a href={s.source_url} target="_blank" rel="noreferrer" className="truncate underline">
                {s.source_url}
              </a>
              <span className="ml-auto shrink-0">
                {s.scan_status}
                {s.items_found ? ` · ${s.items_found} items` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {(content.data?.content ?? []).length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {content.data!.content.map((c) => (
            <div key={c.id} className="rounded-xl ring-1 ring-hairline p-2 flex gap-2">
              {c.preview_url ? (
                <img
                  src={c.preview_url}
                  alt={c.title ?? "Discovered content"}
                  loading="lazy"
                  className="size-16 rounded-lg object-cover shrink-0 bg-sand"
                />
              ) : (
                <div className="size-16 rounded-lg bg-sand shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{c.title ?? "Untitled"}</p>
                <p className="text-[11px] text-navy/50">
                  {c.content_type} · {c.extraction_confidence} confidence
                  {c.detected_price ? ` · ${c.currency} ${c.detected_price}` : ""}
                </p>
                {c.cleaned_text && <p className="text-[11px] text-navy/60 line-clamp-2 mt-0.5">{c.cleaned_text}</p>}
                {c.source_url && (
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-navy/40 underline truncate block"
                  >
                    {c.source_url}
                  </a>
                )}
                <button
                  className={`${btnGhost} mt-1`}
                  onClick={async () => {
                    try {
                      await toggle({ data: { contentId: c.id, included: !c.included } });
                      await reload();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {c.included ? (
                    <>
                      <X className="size-3 inline" /> Exclude
                    </>
                  ) : (
                    <>
                      <Check className="size-3 inline" /> Include
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {leadId && !content.isLoading && (content.data?.content ?? []).length === 0 && (
        <p className="text-xs text-navy/50 mt-3">
          No content stored for this lead yet. Run a scan, or add a source URL if their pages are not on file.
        </p>
      )}
    </div>
  );
}
