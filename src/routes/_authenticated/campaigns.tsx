import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useIsModerator } from "@/lib/useIsModerator";
import { formatRelative } from "@/lib/format";
import { PARISHES } from "@/lib/parishes";
import { sendCampaign } from "@/lib/campaigns.functions";
import { Megaphone, Send, Users, Mail, Shield, ChevronRight, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — Bajan.market" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CampaignsPage,
});

type Days = 7 | 30 | 90 | 0;
type Filters = {
  parish: string;
  intent: string;
  days: Days;
};

const CAP = 500;

function CampaignsPage() {
  const { data: role, isLoading: roleLoading } = useIsModerator();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [filters, setFilters] = useState<Filters>({ parish: "", intent: "", days: 30 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: prefs } = useQuery({
    queryKey: ["campaigns_prefs"],
    enabled: !!role?.isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_preferences")
        .select("user_id, email_opt_in, marketing_email, unsubscribe_token")
        .eq("email_opt_in", true)
        .limit(5000);
      return data ?? [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["campaigns_profiles"],
    enabled: !!role?.isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, parish, onboarding_intent, last_active_at, banned_at")
        .limit(5000);
      return data ?? [];
    },
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns_list"],
    enabled: !!role?.isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const recipients = useMemo(() => {
    if (!prefs || !profiles) return [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const since = filters.days ? Date.now() - filters.days * 86_400_000 : 0;
    const out: { user_id: string; email: string; name: string | null }[] = [];
    for (const pr of prefs) {
      const email = (pr.marketing_email ?? "").trim();
      if (!email) continue;
      const prof = profileById.get(pr.user_id);
      if (!prof) continue;
      if (prof.banned_at) continue;
      if (filters.parish && prof.parish !== filters.parish) continue;
      if (filters.intent && prof.onboarding_intent !== filters.intent) continue;
      if (since && (!prof.last_active_at || new Date(prof.last_active_at).getTime() < since)) continue;
      out.push({ user_id: pr.user_id, email, name: prof.display_name ?? null });
    }
    // de-dupe by email
    const seen = new Set<string>();
    return out.filter((r) => (seen.has(r.email.toLowerCase()) ? false : (seen.add(r.email.toLowerCase()), true)));
  }, [prefs, profiles, filters]);

  const overCap = recipients.length > CAP;

  const queueCampaign = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !subject.trim() || !bodyText.trim()) {
        throw new Error("Name, subject and message body are required.");
      }
      const recipientsToUse = recipients.slice(0, CAP);
      const { data: user } = await supabase.auth.getUser();
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          created_by: user.user!.id,
          name: name.trim(),
          subject: subject.trim(),
          body_text: bodyText,
          body_html: bodyText.replace(/\n/g, "<br/>"),
          channel: "email",
          filters: filters as unknown as never,
          status: "draft",
          recipients_count: recipientsToUse.length,
        })
        .select()
        .single();
      if (error) throw error;

      // Insert send rows in batches
      const rows = recipientsToUse.map((r) => ({
        campaign_id: campaign.id,
        user_id: r.user_id,
        email: r.email,
        status: "queued" as const,
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error: sErr } = await supabase.from("campaign_sends").insert(chunk);
        if (sErr) throw sErr;
      }
      return campaign;
    },
    onSuccess: (campaign) => {
      toast.success(`Draft saved — ${campaign.recipients_count} recipients queued. Click Send to deliver.`);
      qc.invalidateQueries({ queryKey: ["campaigns_list"] });
      setName("");
      setSubject("");
      setBodyText("");
      setSelectedId(campaign.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sendFn = useServerFn(sendCampaign);
  const sendMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return await sendFn({ data: { campaign_id: campaignId, origin: window.location.origin } });
    },
    onSuccess: (r) => {
      toast.success(`Sent ${r.sent} · Failed ${r.failed} · Skipped ${r.skipped}`);
      qc.invalidateQueries({ queryKey: ["campaigns_list"] });
      qc.invalidateQueries({ queryKey: ["campaign_sends"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (roleLoading) return <AppShell><div className="text-navy/40 text-sm">Checking access…</div></AppShell>;
  if (!role?.isAdmin) {
    return (
      <AppShell>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <Shield className="size-8 mx-auto text-navy/40" />
          <h1 className="text-xl font-medium mt-3">Admins only</h1>
          <p className="text-sm text-navy/60 mt-2">You don't have access to this page.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="size-5 text-teal" />
        <h1 className="text-2xl font-medium">Campaigns</h1>
      </div>

      <div className="rounded-2xl bg-sand ring-1 ring-hairline p-3 text-xs text-navy/70 mb-4">
        Sending via Resend from <b>marketing@bajanmarket.app</b>. Drafts snapshot the recipient list — click <b>Send</b> on a draft below to deliver. Cap: {CAP} recipients per campaign.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Composer */}
        <div className="lg:col-span-2 bg-white rounded-3xl ring-1 ring-hairline p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-4 text-teal" /> Compose
          </div>

          <Field label="Campaign name (internal)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="July promo — Christ Church sellers"
              className="w-full rounded-xl bg-sand px-3 py-2 text-sm outline-none ring-1 ring-hairline focus:ring-teal" />
          </Field>

          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Big weekend on Bajan.market 🇧🇧"
              className="w-full rounded-xl bg-sand px-3 py-2 text-sm outline-none ring-1 ring-hairline focus:ring-teal" />
          </Field>

          <Field label="Message">
            <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={10}
              placeholder="Hi {{name}},&#10;&#10;New listings dropped in your area…"
              className="w-full rounded-xl bg-sand px-3 py-2 text-sm outline-none ring-1 ring-hairline focus:ring-teal resize-y font-mono" />
            <p className="text-[11px] text-navy/50 mt-1">Plain text — line breaks preserved. An unsubscribe footer is always appended.</p>
          </Field>

          <div className="border-t border-hairline pt-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Users className="size-4 text-teal" /> Audience
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select label="Parish" value={filters.parish} onChange={(v) => setFilters((f) => ({ ...f, parish: v }))}>
                <option value="">All parishes</option>
                {PARISHES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
              <Select label="Intent" value={filters.intent} onChange={(v) => setFilters((f) => ({ ...f, intent: v }))}>
                <option value="">Any intent</option>
                <option value="buy">Buying</option>
                <option value="sell">Selling</option>
                <option value="both">Both</option>
              </Select>
              <Select label="Active in" value={String(filters.days)} onChange={(v) => setFilters((f) => ({ ...f, days: Number(v) as Days }))}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="0">Any time</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-hairline pt-4">
            <div className="text-sm">
              <span className="font-medium">{recipients.length}</span>
              <span className="text-navy/60"> email-opted-in recipients match</span>
              {overCap && (
                <span className="ml-2 text-[11px] font-semibold text-terracotta bg-terracotta/10 rounded-full px-2 py-0.5">
                  Capped at {CAP}
                </span>
              )}
            </div>
            <button
              onClick={() => queueCampaign.mutate()}
              disabled={queueCampaign.isPending || recipients.length === 0}
              className="inline-flex items-center gap-1.5 bg-navy text-white rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              <Send className="size-4" />
              {queueCampaign.isPending ? "Saving…" : "Save draft & snapshot audience"}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="size-4 text-teal" /> Recent campaigns
          </div>
          {(campaigns ?? []).length === 0 ? (
            <div className="text-xs text-navy/40">No campaigns yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {(campaigns ?? []).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                  className={`text-left rounded-xl px-3 py-2 ring-1 transition-colors ${
                    selectedId === c.id ? "bg-sand ring-teal" : "ring-hairline hover:bg-sand/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-[11px] text-navy/50 truncate">{c.subject}</div>
                    </div>
                    <ChevronRight className="size-3 text-navy/30 shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-navy/50">
                    <span className="uppercase font-semibold bg-white rounded-full px-1.5 py-0.5 ring-1 ring-hairline">{c.status}</span>
                    <span>{c.recipients_count} recipients</span>
                    <span>· {formatRelative(c.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedId && (() => {
            const c = (campaigns ?? []).find((x) => x.id === selectedId);
            if (!c) return null;
            const canSend = c.status === "draft" || c.status === "failed";
            return (
              <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
                <div className="text-[11px] text-navy/50">
                  {c.sent_count ?? 0} sent · {c.failed_count ?? 0} failed
                </div>
                {canSend && (
                  <button
                    onClick={() => {
                      if (confirm(`Send this campaign to ${c.recipients_count} recipients?`)) {
                        sendMutation.mutate(c.id);
                      }
                    }}
                    disabled={sendMutation.isPending}
                    className="inline-flex items-center gap-1.5 bg-teal text-white rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  >
                    <Send className="size-3" />
                    {sendMutation.isPending ? "Sending…" : "Send now"}
                  </button>
                )}
              </div>
            );
          })()}
          {selectedId && <CampaignDetail campaignId={selectedId} />}
        </div>
      </div>
    </AppShell>
  );
}

function CampaignDetail({ campaignId }: { campaignId: string }) {
  const { data: sends } = useQuery({
    queryKey: ["campaign_sends", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_sends")
        .select("email, status, error, sent_at")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });
  return (
    <div className="border-t border-hairline pt-3 flex flex-col gap-1 max-h-72 overflow-auto">
      <div className="text-[10px] uppercase tracking-wide text-navy/40 font-semibold mb-1">
        Recipients ({sends?.length ?? 0})
      </div>
      {(sends ?? []).map((s, i) => (
        <div key={i} className="flex items-center justify-between text-[11px] text-navy/70">
          <span className="truncate">{s.email}</span>
          <span className="text-navy/40 uppercase text-[9px] font-semibold">{s.status}</span>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-navy/50 font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-navy/40 font-semibold">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-xl bg-sand px-3 py-2 text-sm outline-none ring-1 ring-hairline focus:ring-teal">
        {children}
      </select>
    </label>
  );
}
