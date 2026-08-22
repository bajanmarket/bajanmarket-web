import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getPaymentsAdmin,
  setPaymentFlag,
  updateGatewayConfig,
  testGatewayConnection,
  setReadinessCheck,
  saveCommissionRule,
  setSellerPaymentAccountStatus,
  setPaymentTester,
} from "@/lib/paymentsAdmin.functions";
import { CreditCard, Plug, ClipboardCheck, Percent, Users, Receipt, Webhook, ScrollText, AlertTriangle } from "lucide-react";

type Sub = "overview" | "gateway" | "readiness" | "commission" | "sellers" | "ledger" | "webhooks" | "audit";

const money = (cents: number | null | undefined, currency = "BBD") =>
  `${currency} $${((Number(cents) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function PaymentsAdminPanel() {
  const qc = useQueryClient();
  const [sub, setSub] = useState<Sub>("overview");
  const load = useServerFn(getPaymentsAdmin);
  const flagFn = useServerFn(setPaymentFlag);
  const gatewayFn = useServerFn(updateGatewayConfig);
  const testFn = useServerFn(testGatewayConnection);
  const readinessFn = useServerFn(setReadinessCheck);
  const commissionFn = useServerFn(saveCommissionRule);
  const sellerFn = useServerFn(setSellerPaymentAccountStatus);
  const testerFn = useServerFn(setPaymentTester);

  const { data, isLoading } = useQuery({ queryKey: ["payments-admin"], queryFn: () => load() });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payments-admin"] });
    qc.invalidateQueries({ queryKey: ["payments-status"] });
  };

  const mut = <T,>(fn: (v: T) => Promise<unknown>, msg: string) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ({
      run: async (v: T) => {
        try {
          await fn(v);
          refresh();
          toast.success(msg);
        } catch (e) {
          toast.error((e as Error).message);
        }
      },
    });

  const toggleFlag = useMutation({
    mutationFn: (v: { key: "marketplace_payments_enabled" | "marketplace_payments_announcement_enabled"; enabled: boolean }) =>
      flagFn({ data: v }),
    onSuccess: () => {
      refresh();
      toast.success("Updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) return <div className="text-navy/40 text-sm">Loading payments…</div>;

  const paymentsFlag = data.flags.find((f) => f.key === "marketplace_payments_enabled");
  const announceFlag = data.flags.find((f) => f.key === "marketplace_payments_announcement_enabled");
  const passed = data.readiness.filter((r) => r.status === "passed" || r.status === "not_applicable").length;
  const blockers = data.readiness.filter((r) => r.required && r.status !== "passed" && r.status !== "not_applicable");

  const tabs: [Sub, string, typeof CreditCard][] = [
    ["overview", "Overview", CreditCard],
    ["gateway", "Gateway", Plug],
    ["readiness", "Readiness", ClipboardCheck],
    ["commission", "Commission", Percent],
    ["sellers", "Sellers", Users],
    ["ledger", "Ledger", Receipt],
    ["webhooks", "Webhooks", Webhook],
    ["audit", "Audit", ScrollText],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit flex-wrap">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
              sub === key ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
            }`}
          >
            <Icon className="size-3" /> {label}
          </button>
        ))}
      </div>

      {sub === "overview" && (
        <div className="flex flex-col gap-3">
          <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium">Marketplace payments</h3>
                <p className="text-xs text-navy/60 mt-1 max-w-lg">
                  Master switch. While this is off, no buyer or seller payment feature renders anywhere in the app and no
                  money can move. It can only be turned on once the gateway is live and every required readiness item passes.
                </p>
              </div>
              <button
                onClick={() =>
                  toggleFlag.mutate({ key: "marketplace_payments_enabled", enabled: !paymentsFlag?.enabled })
                }
                className={`text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ${
                  paymentsFlag?.enabled ? "bg-teal/10 text-teal ring-1 ring-teal/20" : "bg-sand ring-1 ring-hairline"
                }`}
              >
                {paymentsFlag?.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            {blockers.length > 0 && (
              <div className="mt-3 text-xs text-coral inline-flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{blockers.length} readiness requirement(s) outstanding — activation is blocked.</span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium">Public "coming soon" announcement</h3>
              <p className="text-xs text-navy/60 mt-1 max-w-lg">
                Shows a payments-are-coming message to buyers and sellers without exposing any payment functionality.
              </p>
            </div>
            <button
              onClick={() =>
                toggleFlag.mutate({ key: "marketplace_payments_announcement_enabled", enabled: !announceFlag?.enabled })
              }
              className={`text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 ${
                announceFlag?.enabled ? "bg-teal/10 text-teal ring-1 ring-teal/20" : "bg-sand ring-1 ring-hairline"
              }`}
            >
              {announceFlag?.enabled ? "Showing" : "Hidden"}
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Stat label="Readiness passed" value={`${passed}/${data.readiness.length}`} />
            <Stat label="Gateway" value={data.gateway?.provider ?? "Not selected"} sub={data.gateway?.environment ?? "unconfigured"} />
            <Stat label="Transactions" value={String(data.transactions.length)} sub="most recent 100" />
          </div>
        </div>
      )}

      {sub === "gateway" && (
        <GatewayForm
          gateway={data.gateway}
          onSave={(patch) => mut(gatewayFn, "Gateway saved").run({ data: patch } as never)}
          onTest={async () => {
            try {
              const r = await testFn({});
              refresh();
              (r.ok ? toast.success : toast.error)(r.message);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          testers={data.testers}
          onTester={(email, add) => mut(testerFn, add ? "Tester added" : "Tester removed").run({ data: { email, add } } as never)}
        />
      )}

      {sub === "readiness" && (
        <div className="bg-white rounded-2xl ring-1 ring-hairline divide-y divide-hairline">
          {data.readiness.map((r) => (
            <div key={r.key} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm">{r.label}</div>
                <div className="text-[11px] text-navy/50">
                  {r.evidence_reference ? `Evidence: ${r.evidence_reference}` : "No evidence recorded"}
                </div>
              </div>
              <select
                value={r.status}
                onChange={(e) =>
                  mut(readinessFn, "Requirement updated").run({
                    data: { key: r.key, status: e.target.value },
                  } as never)
                }
                className="text-xs bg-sand rounded-lg px-2 py-1 ring-1 ring-hairline shrink-0"
              >
                {["pending", "in_progress", "passed", "failed", "not_applicable"].map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {sub === "commission" && (
        <CommissionSection
          rules={data.commissions}
          onSave={(rule) => mut(commissionFn, "Commission rule saved").run({ data: rule } as never)}
        />
      )}

      {sub === "sellers" && (
        <div className="bg-white rounded-2xl ring-1 ring-hairline divide-y divide-hairline">
          {data.accounts.length === 0 ? (
            <div className="p-4 text-xs text-navy/50">No seller payment accounts yet.</div>
          ) : (
            data.accounts.map((a) => (
              <div key={a.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono truncate">{a.seller_id}</div>
                  <div className="text-[11px] text-navy/50">
                    {a.onboarding_status} · charges {a.charges_enabled ? "on" : "off"} · payouts {a.payouts_enabled ? "on" : "off"}
                  </div>
                </div>
                <select
                  value={a.onboarding_status}
                  onChange={(e) =>
                    mut(sellerFn, "Seller updated").run({
                      data: { seller_id: a.seller_id, onboarding_status: e.target.value },
                    } as never)
                  }
                  className="text-xs bg-sand rounded-lg px-2 py-1 ring-1 ring-hairline shrink-0"
                >
                  {["not_started", "pending", "requirements_due", "restricted", "active", "rejected", "disabled"].map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      )}

      {sub === "ledger" && (
        <div className="flex flex-col gap-3">
          <LedgerList
            title="Transactions"
            rows={data.transactions.map((t) => ({
              id: t.id,
              left: `${new Date(t.created_at).toLocaleDateString()} · ${t.status} · ${t.environment}`,
              right: `${money(t.gross_amount_cents, t.currency)} → net ${money(t.seller_net_cents, t.currency)}`,
            }))}
          />
          <LedgerList
            title="Payouts"
            rows={data.payouts.map((p) => ({
              id: p.id,
              left: `${new Date(p.created_at).toLocaleDateString()} · ${p.status}`,
              right: money(p.net_payout_cents, p.currency),
            }))}
          />
          <LedgerList
            title="Refunds"
            rows={data.refunds.map((r) => ({
              id: r.id,
              left: `${new Date(r.created_at).toLocaleDateString()} · ${r.status}`,
              right: money(r.amount_cents, r.currency),
            }))}
          />
          <LedgerList
            title="Disputes"
            rows={data.disputes.map((d) => ({
              id: d.id,
              left: `${new Date(d.created_at).toLocaleDateString()} · ${d.status} · ${d.reason_category ?? "—"}`,
              right: money(d.amount_cents, d.currency),
            }))}
          />
        </div>
      )}

      {sub === "webhooks" && (
        <LedgerList
          title="Recent gateway events"
          rows={data.webhooks.map((w) => ({
            id: w.id,
            left: `${new Date(w.received_at).toLocaleString()} · ${w.provider} · ${w.event_type}`,
            right: `${w.status}${w.retry_count ? ` · retries ${w.retry_count}` : ""}`,
          }))}
        />
      )}

      {sub === "audit" && (
        <LedgerList
          title="Payment administration history"
          rows={data.auditLog.map((a) => ({
            id: a.id,
            left: `${new Date(a.created_at).toLocaleString()} · ${a.action}`,
            right: `${a.entity ?? ""} ${a.entity_id ?? ""}`.trim() || "—",
          }))}
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
      <div className="text-xs text-navy/60">{label}</div>
      <div className="text-xl font-medium mt-1">{value}</div>
      {sub && <div className="text-[11px] text-navy/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function LedgerList({ title, rows }: { title: string; rows: { id: string; left: string; right: string }[] }) {
  return (
    <section className="bg-white rounded-2xl ring-1 ring-hairline p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-navy/50">Nothing recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="text-xs flex justify-between gap-3">
              <span className="text-navy/60 truncate">{r.left}</span>
              <span className="font-medium shrink-0">{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type GatewayRow = {
  provider: string | null;
  environment: string;
  credentials_configured: boolean;
  webhook_secret_configured: boolean;
  webhook_verified: boolean;
  webhook_endpoint_url: string | null;
  last_connection_test_at: string | null;
  last_connection_test_ok: boolean | null;
  notes: string | null;
} | null;

function GatewayForm({
  gateway,
  onSave,
  onTest,
  testers,
  onTester,
}: {
  gateway: GatewayRow;
  onSave: (patch: Record<string, unknown>) => void;
  onTest: () => void;
  testers: { id: string; user_id: string; note: string | null }[];
  onTester: (email: string, add: boolean) => void;
}) {
  const [provider, setProvider] = useState(gateway?.provider ?? "");
  const [environment, setEnvironment] = useState(gateway?.environment ?? "unconfigured");
  const [webhookUrl, setWebhookUrl] = useState(gateway?.webhook_endpoint_url ?? "");
  const [credentials, setCredentials] = useState(gateway?.credentials_configured ?? false);
  const [secretSet, setSecretSet] = useState(gateway?.webhook_secret_configured ?? false);
  const [testerEmail, setTesterEmail] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex flex-col gap-3">
        <h3 className="text-sm font-medium">Gateway connection</h3>
        <p className="text-xs text-navy/60">
          API keys and webhook secrets are stored as backend secrets, never in the database and never in this form.
        </p>
        <label className="text-xs text-navy/60">
          Provider
          <input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="e.g. stripe, wipay"
            className="mt-1 w-full text-sm bg-sand rounded-lg px-3 py-2 ring-1 ring-hairline"
          />
        </label>
        <label className="text-xs text-navy/60">
          Environment
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="mt-1 w-full text-sm bg-sand rounded-lg px-3 py-2 ring-1 ring-hairline"
          >
            {["unconfigured", "sandbox", "live"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-navy/60">
          Webhook endpoint
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://bajanmarket.app/api/public/payments/webhook"
            className="mt-1 w-full text-sm bg-sand rounded-lg px-3 py-2 ring-1 ring-hairline"
          />
        </label>
        <div className="flex gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={credentials} onChange={(e) => setCredentials(e.target.checked)} />
            API credentials configured
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={secretSet} onChange={(e) => setSecretSet(e.target.checked)} />
            Webhook secret configured
          </label>
        </div>
        <div className="text-[11px] text-navy/50">
          Webhook verified: {gateway?.webhook_verified ? "yes" : "no"} · Last test:{" "}
          {gateway?.last_connection_test_at
            ? `${new Date(gateway.last_connection_test_at).toLocaleString()} (${gateway.last_connection_test_ok ? "ok" : "failed"})`
            : "never"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              onSave({
                provider: provider || null,
                environment,
                webhook_endpoint_url: webhookUrl || null,
                credentials_configured: credentials,
                webhook_secret_configured: secretSet,
              })
            }
            className="text-xs font-medium bg-navy text-white rounded-lg px-3 py-1.5"
          >
            Save
          </button>
          <button onClick={onTest} className="text-xs font-medium bg-sand ring-1 ring-hairline rounded-lg px-3 py-1.5">
            Test connection
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <h3 className="text-sm font-medium">Internal sandbox testers</h3>
        <p className="text-xs text-navy/60 mt-1">Accounts allowed to exercise payments while the feature stays off for everyone else.</p>
        <div className="flex gap-2 mt-3">
          <input
            value={testerEmail}
            onChange={(e) => setTesterEmail(e.target.value)}
            placeholder="tester@example.com"
            className="flex-1 text-sm bg-sand rounded-lg px-3 py-2 ring-1 ring-hairline"
          />
          <button
            onClick={() => {
              if (testerEmail.trim()) onTester(testerEmail.trim(), true);
              setTesterEmail("");
            }}
            className="text-xs font-medium bg-navy text-white rounded-lg px-3 py-1.5"
          >
            Add
          </button>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {testers.length === 0 ? (
            <li className="text-xs text-navy/50">No testers yet.</li>
          ) : (
            testers.map((t) => (
              <li key={t.id} className="text-xs font-mono text-navy/60">{t.user_id}</li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

type Rule = {
  id: string;
  name: string;
  scope: string;
  percentage_bps: number;
  fixed_fee_cents: number;
  active: boolean;
};

function CommissionSection({ rules, onSave }: { rules: Rule[]; onSave: (r: Record<string, unknown>) => void }) {
  const [name, setName] = useState("Default commission");
  const [pct, setPct] = useState("5");
  const [fee, setFee] = useState("0");

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex flex-col gap-3">
        <h3 className="text-sm font-medium">New default rule</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm bg-sand rounded-lg px-3 py-2 ring-1 ring-hairline"
            placeholder="Rule name"
          />
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="text-sm bg-sand rounded-lg px-3 py-2 ring-1 ring-hairline"
            placeholder="Percent (e.g. 5)"
          />
          <input
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="text-sm bg-sand rounded-lg px-3 py-2 ring-1 ring-hairline"
            placeholder="Fixed fee (cents)"
          />
        </div>
        <button
          onClick={() =>
            onSave({
              name,
              scope: "default",
              percentage_bps: Math.round(Number(pct) * 100),
              fixed_fee_cents: Math.round(Number(fee)),
            })
          }
          className="text-xs font-medium bg-navy text-white rounded-lg px-3 py-1.5 w-fit"
        >
          Save rule
        </button>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-hairline divide-y divide-hairline">
        {rules.length === 0 ? (
          <div className="p-4 text-xs text-navy/50">No commission rules yet.</div>
        ) : (
          rules.map((r) => (
            <div key={r.id} className="p-3 flex items-center justify-between gap-3 text-xs">
              <span>
                {r.name} · {r.scope}
              </span>
              <span className="font-medium">
                {(r.percentage_bps / 100).toFixed(2)}% + {money(r.fixed_fee_cents)} {r.active ? "" : "· inactive"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
