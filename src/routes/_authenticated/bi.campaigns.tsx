// Module 2 — Attribution campaigns: create tracking links + view ROI.
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Copy, QrCode, Archive } from "lucide-react";
import {
  listCampaigns,
  createCampaign,
  archiveCampaign,
  getCampaignReport,
} from "@/lib/ci/attribution.functions";
import { formatMoneyCents, formatNumber, formatPercent } from "@/lib/ci/format";

export const Route = createFileRoute("/_authenticated/bi/campaigns")({
  component: CampaignsPage,
});

const CHANNELS = ["facebook","instagram","tiktok","whatsapp","email","qr","influencer","flyer","radio","event","other"] as const;

function trackingUrl(code: string) {
  if (typeof window === "undefined") return `/api/public/ci/c/${code}`;
  return `${window.location.origin}/api/public/ci/c/${code}`;
}

function CampaignsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listCampaigns);
  const fetchReport = useServerFn(getCampaignReport);
  const create = useServerFn(createCampaign);
  const archive = useServerFn(archiveCampaign);

  const { data: campaigns } = useQuery({ queryKey: ["ci-campaigns"], queryFn: () => fetchList() });
  const { data: report } = useQuery({ queryKey: ["ci-campaign-report"], queryFn: () => fetchReport() });

  const [form, setForm] = useState({
    name: "",
    channel: "facebook" as (typeof CHANNELS)[number],
    destinationPath: "/",
    costCents: 0,
  });

  const createMut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Campaign created");
      setForm({ name: "", channel: "facebook", destinationPath: "/", costCents: 0 });
      qc.invalidateQueries({ queryKey: ["ci-campaigns"] });
      qc.invalidateQueries({ queryKey: ["ci-campaign-report"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ci-campaigns"] });
      qc.invalidateQueries({ queryKey: ["ci-campaign-report"] });
    },
  });

  async function copyLink(code: string) {
    const url = trackingUrl(code);
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  async function showQr(code: string) {
    const url = trackingUrl(code);
    const png = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    const win = window.open("", "_blank", "width=560,height=640");
    if (win) win.document.write(`<title>QR — ${code}</title><body style="font-family:sans-serif;text-align:center;padding:20px"><img src="${png}" style="width:100%;max-width:512px"/><p><code>${url}</code></p></body>`);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <h2 className="text-sm font-semibold mb-3">Create a tracking campaign</h2>
        <div className="grid md:grid-cols-4 gap-2">
          <input
            className="rounded-lg ring-1 ring-hairline px-3 py-2 text-sm md:col-span-2"
            placeholder="Campaign name (e.g. May Instagram Story)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="rounded-lg ring-1 ring-hairline px-3 py-2 text-sm"
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value as (typeof CHANNELS)[number] })}
          >
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            className="rounded-lg ring-1 ring-hairline px-3 py-2 text-sm"
            placeholder="Cost (BBD)"
            type="number"
            min={0}
            value={form.costCents / 100}
            onChange={(e) => setForm({ ...form, costCents: Math.round(Number(e.target.value) * 100) })}
          />
          <input
            className="rounded-lg ring-1 ring-hairline px-3 py-2 text-sm md:col-span-3"
            placeholder="Destination path (e.g. /listing/abc or /)"
            value={form.destinationPath}
            onChange={(e) => setForm({ ...form, destinationPath: e.target.value })}
          />
          <button
            className="rounded-lg bg-coral text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={createMut.isPending || !form.name.trim()}
            onClick={() => createMut.mutate()}
          >
            Create link
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl ring-1 ring-hairline overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase text-navy/50 border-b border-hairline">
            <tr>
              <th className="p-3">Campaign</th>
              <th className="p-3">Channel</th>
              <th className="p-3">Cost</th>
              <th className="p-3">Clicks</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Revenue</th>
              <th className="p-3">ROI</th>
              <th className="p-3">Conv.</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).filter((c) => !c.archived_at).map((c) => {
              const r = report?.find((x) => x.id === c.id);
              return (
                <tr key={c.id} className="border-b border-hairline last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-navy/50">/{c.code}</div>
                  </td>
                  <td className="p-3 capitalize">{c.channel}</td>
                  <td className="p-3">{formatMoneyCents(c.cost_cents)}</td>
                  <td className="p-3">{formatNumber(r?.clicks ?? 0)}</td>
                  <td className="p-3">{formatNumber(r?.orders ?? 0)}</td>
                  <td className="p-3">{formatMoneyCents(r?.revenueCents ?? 0)}</td>
                  <td className={`p-3 ${(r?.roi ?? 0) >= 0 ? "text-teal" : "text-coral"}`}>{formatPercent(r?.roi ?? 0)}</td>
                  <td className="p-3">{formatPercent(r?.conversionRate ?? 0)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <button onClick={() => copyLink(c.code)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ring-1 ring-hairline mr-1"><Copy className="size-3" />Copy</button>
                    <button onClick={() => showQr(c.code)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ring-1 ring-hairline mr-1"><QrCode className="size-3" />QR</button>
                    <button onClick={() => archiveMut.mutate(c.id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ring-1 ring-hairline"><Archive className="size-3" /></button>
                  </td>
                </tr>
              );
            })}
            {!campaigns?.length && (
              <tr><td colSpan={9} className="p-6 text-center text-sm text-navy/50">No campaigns yet. Create your first tracking link above.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
