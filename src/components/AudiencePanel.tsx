import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listPrivilegedProfiles } from "@/lib/profiles.functions";
import { Users, Mail, MessageSquare, Phone, Download } from "lucide-react";
import { PARISHES } from "@/lib/parishes";

type Days = 7 | 30 | 90 | 0;

/**
 * Admin-only audience segmentation panel. Reads profiles + marketing_preferences
 * (admin_read policy) and renders a filterable, exportable table.
 */
export function AudiencePanel() {
  const [days, setDays] = useState<Days>(30);
  const [intent, setIntent] = useState<string>("");
  const [parish, setParish] = useState<string>("");
  const [channel, setChannel] = useState<"" | "email" | "sms" | "whatsapp">("");
  const fetchProfiles = useServerFn(listPrivilegedProfiles);

  const { data: prefs } = useQuery({
    queryKey: ["audience_prefs"],
    queryFn: async () => {
      const { data } = await supabase.from("marketing_preferences").select("*").limit(2000);
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["audience_profiles"],
    queryFn: async () => await fetchProfiles({ data: { limit: 2000 } }),
  });

  const prefsById = useMemo(() => new Map((prefs ?? []).map((p) => [p.user_id, p])), [prefs]);
  const totalOptIns = useMemo(() => ({
    email: (prefs ?? []).filter((p) => p.email_opt_in).length,
    sms: (prefs ?? []).filter((p) => p.sms_opt_in).length,
    whatsapp: (prefs ?? []).filter((p) => p.whatsapp_opt_in).length,
  }), [prefs]);

  const rows = useMemo(() => {
    if (!profiles) return [];
    const since = days ? Date.now() - days * 86_400_000 : 0;
    return profiles.filter((p) => {
      if (parish && p.parish !== parish) return false;
      if (intent && p.onboarding_intent !== intent) return false;
      if (since && (!p.last_active_at || new Date(p.last_active_at).getTime() < since)) return false;
      if (channel) {
        const pr = prefsById.get(p.id);
        if (!pr) return false;
        if (channel === "email" && !pr.email_opt_in) return false;
        if (channel === "sms" && !pr.sms_opt_in) return false;
        if (channel === "whatsapp" && !pr.whatsapp_opt_in) return false;
      }
      return true;
    });
  }, [profiles, prefsById, days, parish, intent, channel]);

  const exportCsv = () => {
    const header = ["display_name", "parish", "intent", "top_categories", "last_active_at", "listings", "email_opt_in", "sms_opt_in", "whatsapp_opt_in", "marketing_email", "whatsapp_number"];
    const lines = [header.join(",")];
    for (const p of rows) {
      const pr = prefsById.get(p.id);
      const cells = [
        JSON.stringify(p.display_name ?? ""),
        p.parish ?? "",
        p.onboarding_intent ?? "",
        JSON.stringify((p.onboarding_categories ?? []).join("|")),
        p.last_active_at ?? "",
        String(p.listings_count ?? 0),
        pr?.email_opt_in ? "yes" : "",
        pr?.sms_opt_in ? "yes" : "",
        pr?.whatsapp_opt_in ? "yes" : "",
        pr?.marketing_email ?? "",
        pr?.whatsapp_number ?? "",
      ];
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bajan-audience-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Stat icon={<Users className="size-4" />} label="Total users" value={profiles?.length ?? 0} />
        <Stat icon={<Mail className="size-4" />} label="Email opt-in" value={totalOptIns.email} />
        <Stat icon={<MessageSquare className="size-4" />} label="SMS opt-in" value={totalOptIns.sms} />
        <Stat icon={<Phone className="size-4" />} label="WhatsApp opt-in" value={totalOptIns.whatsapp} />
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex flex-wrap gap-2 items-center">
        <Select label="Active in" value={String(days)} onChange={(v) => setDays(Number(v) as Days)}
          options={[["7","Last 7d"],["30","Last 30d"],["90","Last 90d"],["0","Anytime"]]} />
        <Select label="Intent" value={intent} onChange={setIntent}
          options={[["","All"],["buyer","Buyers"],["seller","Sellers"],["both","Both"]]} />
        <Select label="Parish" value={parish} onChange={setParish}
          options={[["","All parishes"], ...PARISHES.map(p => [p.value, p.label] as [string,string])]} />
        <Select label="Opt-in" value={channel} onChange={(v) => setChannel(v as "" | "email" | "sms" | "whatsapp")}
          options={[["","Any"],["email","Email"],["sms","SMS"],["whatsapp","WhatsApp"]]} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-navy/50">{rows.length} match</span>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="text-xs bg-navy text-white rounded-lg px-3 py-1.5 inline-flex items-center gap-1 disabled:opacity-40"
          >
            <Download className="size-3" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-hairline overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-sand text-navy/60 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Parish</th>
                <th className="text-left px-3 py-2">Intent</th>
                <th className="text-left px-3 py-2">Interests</th>
                <th className="text-right px-3 py-2">Listings</th>
                <th className="text-right px-3 py-2">Msgs</th>
                <th className="text-left px-3 py-2">Opt-ins</th>
                <th className="text-left px-3 py-2">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((p) => {
                const pr = prefsById.get(p.id);
                return (
                  <tr key={p.id} className="border-t border-hairline">
                    <td className="px-3 py-2 font-medium">{p.display_name}</td>
                    <td className="px-3 py-2 text-navy/60">{p.parish ?? "—"}</td>
                    <td className="px-3 py-2 text-navy/60">{p.onboarding_intent ?? "—"}</td>
                    <td className="px-3 py-2 text-navy/60">{(p.onboarding_categories ?? []).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">{p.listings_count ?? 0}</td>
                    <td className="px-3 py-2 text-right">{p.messages_sent_count ?? 0}</td>
                    <td className="px-3 py-2 text-navy/60">
                      {[pr?.email_opt_in && "E", pr?.sms_opt_in && "S", pr?.whatsapp_opt_in && "W"].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-navy/50">{p.last_active_at ? new Date(p.last_active_at).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-navy/40">No users match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 200 && (
          <div className="text-[11px] text-navy/50 p-3 border-t border-hairline">
            Showing first 200 of {rows.length}. Export CSV for the full segment.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
      <div className="flex items-center gap-2 text-navy/50 text-xs">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-navy/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-sand rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
