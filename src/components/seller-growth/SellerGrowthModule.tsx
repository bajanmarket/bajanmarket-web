import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PIPELINE_STAGES,
  SELLER_TYPES,
  OUTREACH_CHANNELS,
  stageLabel,
  sellerTypeLabel,
  formatBarbados,
} from "@/lib/sellerGrowth";
import {
  upsertProspect,
  runVerification,
  scoreProspect,
  moveStage,
  runOpportunityScan,
  generateDraft,
  submitForApproval,
  decideApproval,
  sendApprovedOutreach,
  recordReply,
  addSuppression,
  updateGrowthSettings,
  upsertScoringRule,
  upsertPlaybook,
  createOnboardingSession,
  approveOnboardingItem,
} from "@/lib/sellerGrowth.functions";
import {
  Gauge, Users, Radar, ShieldCheck, BookOpen, Inbox, Rocket, Settings2, Loader2, Plus, Ban,
} from "lucide-react";

type Tab = "dashboard" | "prospects" | "scanner" | "approvals" | "playbooks" | "onboarding" | "settings";

const card = "bg-white rounded-2xl ring-1 ring-hairline p-4";
const btn = "text-xs font-medium px-3 py-1.5 rounded-lg bg-navy text-white disabled:opacity-40";
const btnGhost = "text-xs font-medium px-3 py-1.5 rounded-lg ring-1 ring-hairline text-navy/70 hover:text-navy disabled:opacity-40";
const input = "w-full text-sm rounded-lg ring-1 ring-hairline px-3 py-2 bg-white";

export function SellerGrowthModule() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const settings = useQuery({
    queryKey: ["sg-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seller_growth_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tabs: [Tab, string, typeof Gauge][] = [
    ["dashboard", "Dashboard", Gauge],
    ["prospects", "Prospects", Users],
    ["scanner", "Opportunity Scanner", Radar],
    ["approvals", "Approval Center", ShieldCheck],
    ["playbooks", "Playbooks & Scoring", BookOpen],
    ["onboarding", "Onboarding", Rocket],
    ["settings", "Controls", Settings2],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-medium">Seller Growth Agent</h2>
        <span className="text-[10px] font-semibold uppercase bg-sand rounded-full px-2 py-1">
          {settings.data?.simulation_mode ? "Simulation mode" : "Live mode"}
        </span>
        {settings.data?.global_outreach_paused && (
          <span className="text-[10px] font-semibold uppercase bg-coral/15 text-coral rounded-full px-2 py-1">
            Outreach paused
          </span>
        )}
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit flex-wrap">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
              tab === key ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
            }`}
          >
            <Icon className="size-3" /> {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "prospects" && <ProspectsTab />}
      {tab === "scanner" && <ScannerTab />}
      {tab === "approvals" && <ApprovalsTab />}
      {tab === "playbooks" && <PlaybooksTab />}
      {tab === "onboarding" && <OnboardingTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

function DashboardTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["sg-dashboard"],
    queryFn: async () => {
      const [prospects, approvals, tasks, activity] = await Promise.all([
        supabase.from("seller_prospects").select("id, pipeline_stage, lead_score, priority, business_name, seller_type, record_mode"),
        supabase.from("seller_approval_requests").select("id").eq("status", "pending"),
        supabase.from("seller_followup_tasks").select("id, due_at, prospect_id, sequence_step").eq("status", "open").order("due_at").limit(10),
        supabase.from("seller_growth_audit_log").select("action, created_at, detail").order("created_at", { ascending: false }).limit(12),
      ]);
      return {
        prospects: prospects.data ?? [],
        pendingApprovals: approvals.data?.length ?? 0,
        tasks: tasks.data ?? [],
        activity: activity.data ?? [],
      };
    },
  });

  if (isLoading || !data) return <Loading />;

  const byStage = new Map<string, number>();
  for (const p of data.prospects) byStage.set(p.pipeline_stage, (byStage.get(p.pipeline_stage) ?? 0) + 1);
  const top = [...data.prospects].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Prospects" value={data.prospects.length} />
        <Stat label="Awaiting approval" value={data.pendingApprovals} />
        <Stat label="Open follow-ups" value={data.tasks.length} />
        <Stat label="Activated sellers" value={byStage.get("activated_seller") ?? 0} />
      </div>

      <div className={card}>
        <h3 className="text-sm font-medium mb-3">Pipeline</h3>
        <div className="flex flex-wrap gap-2">
          {PIPELINE_STAGES.map((s) => (
            <div key={s.key} className="rounded-xl bg-sand px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-navy/50">{s.label}</div>
              <div className="text-lg font-medium">{byStage.get(s.key) ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className={card}>
          <h3 className="text-sm font-medium mb-3">Highest-value opportunities</h3>
          {top.length === 0 ? (
            <Empty text="No prospects researched yet." />
          ) : (
            <ul className="flex flex-col gap-2">
              {top.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {p.business_name}
                    <span className="text-navy/40"> · {sellerTypeLabel(p.seller_type)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold">{p.lead_score ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={card}>
          <h3 className="text-sm font-medium mb-3">Recent agent activity</h3>
          {data.activity.length === 0 ? (
            <Empty text="No activity recorded yet." />
          ) : (
            <ul className="flex flex-col gap-1.5 text-xs text-navy/70">
              {data.activity.map((a, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{a.action}</span>
                  <span className="shrink-0 text-navy/40">{formatBarbados(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Prospects ---------------- */

function ProspectsTab() {
  const qc = useQueryClient();
  const [stage, setStage] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["sg-prospects", stage, q],
    queryFn: async () => {
      let query = supabase.from("seller_prospects").select("*").order("lead_score", { ascending: false, nullsFirst: false }).limit(200);
      if (stage !== "all") query = query.eq("pipeline_stage", stage as never);
      if (q.trim()) query = query.ilike("business_name", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sg-prospects"] });
    qc.invalidateQueries({ queryKey: ["sg-dashboard"] });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select className={`${input} w-auto`} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="all">All stages</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <input className={`${input} w-56`} placeholder="Search business name" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btn} onClick={() => setAdding((v) => !v)}>
          <Plus className="size-3 inline mr-1" /> Add prospect
        </button>
      </div>

      {adding && <ProspectForm onDone={() => { setAdding(false); invalidate(); }} />}

      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty text="No prospects match these filters yet. Add one manually or run the Opportunity Scanner." />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((p) => (
            <div key={p.id} className={card}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.business_name}</div>
                  <div className="text-xs text-navy/50 mt-0.5">
                    {sellerTypeLabel(p.seller_type)} · {p.parish ?? "parish unknown"} · {stageLabel(p.pipeline_stage)}
                  </div>
                  <div className="text-xs text-navy/50 mt-0.5">
                    Score {p.lead_score ?? "—"} · {p.priority} priority · {p.verification_status.replace(/_/g, " ")} · {p.record_mode}
                  </div>
                </div>
                <button className={btnGhost} onClick={() => setSelected(selected === p.id ? null : p.id)}>
                  {selected === p.id ? "Close" : "Open"}
                </button>
              </div>
              {selected === p.id && <ProspectDetail prospectId={p.id} onChange={invalidate} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProspectForm({ onDone }: { onDone: () => void }) {
  const save = useServerFn(upsertProspect);
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const m = useMutation({
    mutationFn: async () => {
      if (!f['business_name']) throw new Error("Business name is required");
      return save({
        data: {
          business_name: f['business_name'],
          contact_name: f['contact_name'] || null,
          seller_type: f['seller_type'] || null,
          marketplace_category: f['marketplace_category'] || null,
          parish: f['parish'] || null,
          website_url: f['website_url'] || null,
          facebook_url: f['facebook_url'] || null,
          instagram_url: f['instagram_url'] || null,
          public_phone: f['public_phone'] || null,
          public_email: f['public_email'] || null,
          public_whatsapp: f['public_whatsapp'] || null,
          visible_product_count: f['visible_product_count'] ? Number(f['visible_product_count']) : null,
          posting_frequency: f['posting_frequency'] || null,
          notes: f['notes'] || null,
          source_url: f['source_url'] || null,
        },
      });
    },
    onSuccess: (r) => {
      if (r.duplicates?.length) toast.warning(`Possible duplicate of ${r.duplicates.map((d) => d.business_name).join(", ")}`);
      else toast.success("Prospect added");
      onDone();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className={`${card} grid md:grid-cols-3 gap-2`}>
      <input className={input} placeholder="Business name *" onChange={set("business_name")} />
      <input className={input} placeholder="Contact name (only if public)" onChange={set("contact_name")} />
      <select className={input} onChange={set("seller_type")} defaultValue="">
        <option value="">Seller type</option>
        {SELLER_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <input className={input} placeholder="Marketplace category" onChange={set("marketplace_category")} />
      <input className={input} placeholder="Parish" onChange={set("parish")} />
      <input className={input} placeholder="Website URL" onChange={set("website_url")} />
      <input className={input} placeholder="Facebook page URL" onChange={set("facebook_url")} />
      <input className={input} placeholder="Instagram URL" onChange={set("instagram_url")} />
      <input className={input} placeholder="Public phone" onChange={set("public_phone")} />
      <input className={input} placeholder="Public WhatsApp" onChange={set("public_whatsapp")} />
      <input className={input} placeholder="Public email" onChange={set("public_email")} />
      <input className={input} placeholder="Visible product count" onChange={set("visible_product_count")} />
      <input className={input} placeholder="Posting frequency (daily/weekly…)" onChange={set("posting_frequency")} />
      <input className={input} placeholder="Source URL (evidence)" onChange={set("source_url")} />
      <input className={input} placeholder="Notes" onChange={set("notes")} />
      <div className="md:col-span-3 flex justify-end">
        <button className={btn} disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? "Saving…" : "Save prospect"}
        </button>
      </div>
    </div>
  );
}

function ProspectDetail({ prospectId, onChange }: { prospectId: string; onChange: () => void }) {
  const verify = useServerFn(runVerification);
  const score = useServerFn(scoreProspect);
  const move = useServerFn(moveStage);
  const draft = useServerFn(generateDraft);
  const submit = useServerFn(submitForApproval);
  const reply = useServerFn(recordReply);
  const suppress = useServerFn(addSuppression);
  const onboard = useServerFn(createOnboardingSession);

  const [result, setResult] = useState<string | null>(null);
  const [playbookId, setPlaybookId] = useState("");

  const { data: sources } = useQuery({
    queryKey: ["sg-sources", prospectId],
    queryFn: async () => (await supabase.from("seller_prospect_sources").select("*").eq("prospect_id", prospectId)).data ?? [],
  });
  const { data: history } = useQuery({
    queryKey: ["sg-history", prospectId],
    queryFn: async () =>
      (await supabase.from("seller_pipeline_history").select("*").eq("prospect_id", prospectId).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: playbooks } = useQuery({
    queryKey: ["sg-playbooks"],
    queryFn: async () => (await supabase.from("seller_outreach_playbooks").select("*").eq("active", true)).data ?? [],
  });

  const run = (fn: () => Promise<unknown>, label: string) =>
    fn()
      .then((r) => {
        setResult(JSON.stringify(r, null, 2));
        toast.success(label);
        onChange();
      })
      .catch((e) => toast.error((e as Error).message));

  return (
    <div className="mt-3 border-t border-hairline pt-3 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button className={btnGhost} onClick={() => run(() => verify({ data: { prospectId } }), "Verification complete")}>Run verification</button>
        <button className={btnGhost} onClick={() => run(() => score({ data: { prospectId } }), "Lead score updated")}>Recalculate score</button>
        <button className={btnGhost} onClick={() => run(() => move({ data: { prospectId, stage: "qualified" } }), "Marked qualified")}>Mark qualified</button>
        <button className={btnGhost} onClick={() => run(() => reply({ data: { prospectId } }), "Reply recorded")}>Record reply</button>
        <button className={btnGhost} onClick={() => run(() => onboard({ data: { prospectId } }), "Onboarding invitation created")}>Create onboarding invite</button>
        <button
          className={`${btnGhost} text-coral`}
          onClick={() =>
            run(
              () => suppress({ data: { prospectId, matchType: "business_name", matchValue: prospectId, reason: "Do not contact (admin)" } }),
              "Prospect suppressed",
            )
          }
        >
          <Ban className="size-3 inline mr-1" /> Do not contact
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select className={`${input} w-auto`} value={playbookId} onChange={(e) => setPlaybookId(e.target.value)}>
          <option value="">Choose playbook</option>
          {(playbooks ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button
          className={btn}
          disabled={!playbookId}
          onClick={() =>
            run(async () => {
              const d = await draft({ data: { prospectId, playbookId, step: "initial" } });
              return submit({ data: { draftId: d.id } });
            }, "Draft submitted to the Approval Center")
          }
        >
          Draft &amp; submit for approval
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="font-medium mb-1">Sources</div>
          {sources?.length ? (
            <ul className="text-navy/60 flex flex-col gap-1">
              {sources.map((s) => <li key={s.id} className="truncate">{s.claim} — {s.source_url}</li>)}
            </ul>
          ) : <span className="text-navy/40">No sources recorded.</span>}
        </div>
        <div>
          <div className="font-medium mb-1">Pipeline history</div>
          {history?.length ? (
            <ul className="text-navy/60 flex flex-col gap-1">
              {history.map((h) => (
                <li key={h.id}>{stageLabel(h.to_stage)} · {formatBarbados(h.created_at)}{h.reason ? ` — ${h.reason}` : ""}</li>
              ))}
            </ul>
          ) : <span className="text-navy/40">No stage changes yet.</span>}
        </div>
      </div>

      {result && <pre className="bg-sand rounded-xl p-3 text-[11px] overflow-auto max-h-60">{result}</pre>}
    </div>
  );
}

/* ---------------- Scanner ---------------- */

function ScannerTab() {
  const qc = useQueryClient();
  const scan = useServerFn(runOpportunityScan);
  const [f, setF] = useState({ category: "", sellerType: "", parish: "", minActivity: "", minInventory: "", seedUrls: "", maxProspects: "10" });

  const { data: tasks } = useQuery({
    queryKey: ["sg-tasks"],
    queryFn: async () =>
      (await supabase.from("seller_research_tasks").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  const m = useMutation({
    mutationFn: () =>
      scan({
        data: {
          category: f.category || undefined,
          sellerType: f.sellerType || undefined,
          parish: f.parish || undefined,
          minActivity: f.minActivity || undefined,
          minInventory: f.minInventory ? Number(f.minInventory) : undefined,
          maxProspects: Number(f.maxProspects) || 10,
          sources: ["facebook_marketplace", "instagram_business", "google_business", "local_directory"],
          seedUrls: f.seedUrls.split("\n").map((s) => s.trim()).filter(Boolean),
          liveResearch: false,
        },
      }),
    onSuccess: (r) => {
      if (r.prospectsCreated) {
        toast.success(
          `${r.prospectsCreated} candidate prospect(s) added for verification` +
            (r.duplicatesSkipped ? ` · ${r.duplicatesSkipped} duplicate(s) skipped` : ""),
        );
      } else {
        toast.message(r.note ?? "No new candidates found", {
          description: `${r.tasksCreated} manual research task(s) created`,
        });
      }
      qc.invalidateQueries({ queryKey: ["sg-tasks"] });
      qc.invalidateQueries({ queryKey: ["sg-prospects"] });
      qc.invalidateQueries({ queryKey: ["sg-dashboard"] });
    },
    onError: (e) => toast.error((e as Error).message),

  });

  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} text-xs text-navy/60`}>
        The scanner suggests candidate Barbados businesses from public knowledge and files each one under{" "}
        <strong>Verification required</strong> — nothing is treated as verified and no contact details are invented. It also creates
        structured manual research tasks so you can confirm or expand on what it surfaced.
      </div>

      <div className={`${card} grid md:grid-cols-3 gap-2`}>
        <input className={input} placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <select className={input} value={f.sellerType} onChange={(e) => setF({ ...f, sellerType: e.target.value })}>
          <option value="">Seller type</option>
          {SELLER_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <input className={input} placeholder="Parish" value={f.parish} onChange={(e) => setF({ ...f, parish: e.target.value })} />
        <input className={input} placeholder="Minimum activity (e.g. weekly)" value={f.minActivity} onChange={(e) => setF({ ...f, minActivity: e.target.value })} />
        <input className={input} placeholder="Minimum inventory" value={f.minInventory} onChange={(e) => setF({ ...f, minInventory: e.target.value })} />
        <input className={input} placeholder="Max tasks" value={f.maxProspects} onChange={(e) => setF({ ...f, maxProspects: e.target.value })} />
        <textarea
          className={`${input} md:col-span-3`}
          rows={3}
          placeholder="Optional: one public source URL per line"
          value={f.seedUrls}
          onChange={(e) => setF({ ...f, seedUrls: e.target.value })}
        />
        <div className="md:col-span-3 flex justify-end">
          <button className={btn} disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Running…" : "Run scan"}
          </button>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-medium mb-3">Research tasks</h3>
        {!tasks?.length ? (
          <Empty text="No research tasks yet." />
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate">{t.title}</span>
                <span className="text-xs text-navy/40 shrink-0">{t.status} · {formatBarbados(t.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Approvals ---------------- */

function ApprovalsTab() {
  const qc = useQueryClient();
  const decide = useServerFn(decideApproval);
  const send = useServerFn(sendApprovedOutreach);
  const [edited, setEdited] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["sg-approvals"],
    queryFn: async () =>
      (await supabase.from("seller_approval_requests").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sg-approvals"] });
    qc.invalidateQueries({ queryKey: ["sg-dashboard"] });
  };

  if (isLoading) return <Loading />;
  if (!data?.length) return <Empty text="Nothing is waiting for approval. Drafts appear here before anything can be sent." />;

  return (
    <div className="flex flex-col gap-3">
      {data.map((r) => {
        const s = (r.summary ?? {}) as Record<string, string>;
        const v = (r.verification_result ?? {}) as { checks?: { label: string; status: string; note?: string }[] };
        return (
          <div key={r.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{s['business_name']}</div>
                <div className="text-xs text-navy/50">
                  {r.request_type} · {s['channel']} · score {s['lead_score'] ?? "—"} · {r.record_mode}
                </div>
              </div>
              <span className="text-[10px] font-semibold uppercase bg-sand rounded-full px-2 py-1">{r.status}</span>
            </div>

            <div className="mt-2 text-xs text-navy/60">
              {(v.checks ?? []).map((c) => (
                <div key={c.label}>
                  {c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "?"} {c.label}
                  {c.note ? ` — ${c.note}` : ""}
                </div>
              ))}
            </div>

            {r.risk_warnings?.length > 0 && (
              <div className="mt-2 text-xs text-coral">{r.risk_warnings.join(" · ")}</div>
            )}

            <textarea
              className={`${input} mt-2`}
              rows={6}
              defaultValue={s['body']}
              onChange={(e) => setEdited((x) => ({ ...x, [r.id]: e.target.value }))}
            />

            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className={btn}
                disabled={r.status !== "pending"}
                onClick={() =>
                  decide({ data: { requestId: r.id, decision: edited[r.id] ? "edited_approved" : "approved", ...(edited[r.id] ? { editedBody: edited[r.id] } : {}) } })
                    .then(() => { toast.success("Approved"); refresh(); })
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Approve
              </button>
              <button
                className={btnGhost}
                disabled={r.status !== "pending"}
                onClick={() =>
                  decide({ data: { requestId: r.id, decision: "rejected" } })
                    .then(() => { toast.success("Rejected"); refresh(); })
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Reject
              </button>
              <button
                className={btnGhost}
                disabled={!r.status.includes("approved")}
                onClick={() =>
                  send({ data: { requestId: r.id } })
                    .then((res) => {
                      if (res.sent && !res.simulated) toast.success("Sent for real");
                      else if (res.sent)
                        toast.warning("Recorded as a simulated send", {
                          description: res.reasons.find((x) => x.includes("Controls")) ?? "Enable live sending in Controls",
                        });
                      else toast.error(res.reasons.join(" · "));
                      refresh();
                    })

                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Send (respects pauses &amp; limits)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Playbooks & scoring ---------------- */

function PlaybooksTab() {
  const qc = useQueryClient();
  const savePb = useServerFn(upsertPlaybook);
  const saveRule = useServerFn(upsertScoringRule);

  const { data: playbooks } = useQuery({
    queryKey: ["sg-playbooks-all"],
    queryFn: async () => (await supabase.from("seller_outreach_playbooks").select("*").order("name")).data ?? [],
  });
  const { data: rules } = useQuery({
    queryKey: ["sg-rules"],
    queryFn: async () => (await supabase.from("seller_scoring_rules").select("*").order("sort_order")).data ?? [],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <h3 className="text-sm font-medium mb-3">Lead scoring rules</h3>
        <div className="flex flex-col gap-2">
          {(rules ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 min-w-40">{r.label}</span>
              <input
                className={`${input} w-24`}
                type="number"
                defaultValue={r.max_points}
                onBlur={(e) =>
                  saveRule({ data: { id: r.id, max_points: Number(e.target.value) } })
                    .then(() => { toast.success("Rule updated"); qc.invalidateQueries({ queryKey: ["sg-rules"] }); })
                    .catch((err) => toast.error((err as Error).message))
                }
              />
              <label className="text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  defaultChecked={r.active}
                  onChange={(e) =>
                    saveRule({ data: { id: r.id, active: e.target.checked } }).then(() => toast.success("Rule updated"))
                  }
                />
                active
              </label>
            </div>
          ))}
        </div>
      </div>

      {(playbooks ?? []).map((p) => (
        <div key={p.id} className={card}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{p.name}</h3>
            <span className="text-[10px] uppercase bg-sand rounded-full px-2 py-1">approval required</span>
          </div>
          <textarea className={`${input} mt-2`} rows={2} defaultValue={p.value_proposition ?? ""} id={`vp-${p.id}`} />
          <textarea className={`${input} mt-2`} rows={5} defaultValue={p.initial_template} id={`t1-${p.id}`} />
          <textarea className={`${input} mt-2`} rows={3} defaultValue={p.followup_1_template} id={`t2-${p.id}`} />
          <textarea className={`${input} mt-2`} rows={3} defaultValue={p.followup_final_template} id={`t3-${p.id}`} />
          <div className="flex justify-end mt-2">
            <button
              className={btn}
              onClick={() => {
                const val = (id: string) => (document.getElementById(id) as HTMLTextAreaElement | null)?.value ?? "";
                savePb({
                  data: {
                    id: p.id,
                    value_proposition: val(`vp-${p.id}`),
                    initial_template: val(`t1-${p.id}`),
                    followup_1_template: val(`t2-${p.id}`),
                    followup_final_template: val(`t3-${p.id}`),
                  },
                })
                  .then(() => toast.success("Playbook saved"))
                  .catch((e) => toast.error((e as Error).message));
              }}
            >
              Save playbook
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Onboarding ---------------- */

function OnboardingTab() {
  const approve = useServerFn(approveOnboardingItem);
  const move = useServerFn(moveStage);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sg-onboarding"],
    queryFn: async () => {
      const sessions = (await supabase.from("seller_onboarding_sessions").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [];
      const items = (await supabase.from("seller_onboarding_items").select("*").limit(500)).data ?? [];
      return { sessions, items };
    },
  });

  if (isLoading || !data) return <Loading />;
  if (!data.sessions.length) return <Empty text="No onboarding sessions yet. Create an invitation from a prospect that replied." />;

  return (
    <div className="flex flex-col gap-3">
      {data.sessions.map((s) => {
        const items = data.items.filter((i) => i.session_id === s.id);
        return (
          <div key={s.id} className={card}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{(s.prefilled as Record<string, string>)?.['business_name'] ?? "Prospect"}</div>
                <div className="text-xs text-navy/50">
                  {s.status} · {items.length} draft item(s) ·{" "}
                  {s.content_permission_granted ? "content permission granted" : "awaiting content permission"}
                </div>
              </div>
              <button
                className={btnGhost}
                onClick={() =>
                  move({ data: { prospectId: s.prospect_id, stage: "activated_seller" } })
                    .then(() => { toast.success("Marked as activated seller"); qc.invalidateQueries({ queryKey: ["sg-onboarding"] }); })
                    .catch((e) => toast.error((e as Error).message))
                }
              >
                Mark activated
              </button>
            </div>
            {items.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span className="truncate">{i.title} — {i.status}</span>
                    <button
                      className={btnGhost}
                      onClick={() =>
                        approve({ data: { itemId: i.id } })
                          .then(() => { toast.success("Item approved"); qc.invalidateQueries({ queryKey: ["sg-onboarding"] }); })
                          .catch((e) => toast.error((e as Error).message))
                      }
                    >
                      Approve
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Settings ---------------- */

function SettingsTab() {
  const qc = useQueryClient();
  const save = useServerFn(updateGrowthSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["sg-settings-full"],
    queryFn: async () => (await supabase.from("seller_growth_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const patch = (p: Record<string, unknown>) =>
    save({ data: p as never })
      .then(() => {
        toast.success("Controls updated");
        qc.invalidateQueries({ queryKey: ["sg-settings-full"] });
        qc.invalidateQueries({ queryKey: ["sg-settings"] });
      })
      .catch((e) => toast.error((e as Error).message));

  if (isLoading || !data) return <Loading />;

  const toggles: [string, string, boolean][] = [
    ["simulation_mode", "Simulation mode (nothing is sent externally)", data.simulation_mode],
    ["global_outreach_paused", "Global outreach pause", data.global_outreach_paused],
    ["live_sending_enabled", "Live sending enabled", data.live_sending_enabled],
    ["email_paused", "Email channel paused", data.email_paused],
    ["whatsapp_paused", "WhatsApp channel paused", data.whatsapp_paused],
    ["social_paused", "Social channels paused", data.social_paused],
  ];
  const numbers: [string, string, number][] = [
    ["daily_contact_limit", "Daily contact limit", data.daily_contact_limit],
    ["weekly_contact_limit", "Weekly contact limit", data.weekly_contact_limit],
    ["max_contact_attempts", "Max contact attempts per prospect", data.max_contact_attempts],
    ["business_hours_start", "Business hours start (AST)", data.business_hours_start],
    ["business_hours_end", "Business hours end (AST)", data.business_hours_end],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <h3 className="text-sm font-medium mb-3">Safety controls</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {toggles.map(([key, label, value]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={value} onChange={(e) => patch({ [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-medium mb-3">Limits &amp; hours (Barbados, AST)</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {numbers.map(([key, label, value]) => (
            <label key={key} className="text-sm flex items-center justify-between gap-2">
              {label}
              <input className={`${input} w-24`} type="number" defaultValue={value} onBlur={(e) => patch({ [key]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-medium mb-2">Outreach days (AST)</h3>
        <p className="text-xs text-navy/50 mb-2">Sends are only allowed on the days you tick here.</p>
        <div className="flex flex-wrap gap-3">
          {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((d) => {
            const days: string[] = (data as { outreach_days?: string[] }).outreach_days ?? [];
            const on = days.includes(d);
            return (
              <label key={d} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    patch({ outreach_days: on ? days.filter((x) => x !== d) : [...days, d] })
                  }
                />
                {d}
              </label>
            );
          })}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-medium mb-2">Test recipients</h3>
        <p className="text-xs text-navy/50 mb-2">
          Live sending only ever delivers to this validated allowlist. Channels available: {OUTREACH_CHANNELS.join(", ")}.
        </p>
        <textarea
          className={input}
          rows={3}
          defaultValue={data.test_recipients.join("\n")}
          onBlur={(e) => patch({ test_recipients: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={card}>
      <div className="text-[10px] uppercase tracking-wide text-navy/50">{label}</div>
      <div className="text-2xl font-medium mt-1">{value}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="text-navy/40 text-sm inline-flex items-center gap-2">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-sm text-navy/50 flex items-center gap-2">
      <Inbox className="size-4" /> {text}
    </div>
  );
}
