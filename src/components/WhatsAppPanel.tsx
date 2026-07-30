import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageCircle, CheckCircle2, XCircle, AlertTriangle, Trash2, Send, Plug } from "lucide-react";
import {
  getWhatsAppStatus,
  updateWhatsAppSettings,
  addWhatsAppTestNumber,
  removeWhatsAppTestNumber,
  runWhatsAppConnectionTest,
  sendWhatsAppTestMessage,
} from "@/lib/whatsapp-admin.functions";
import { WA_EVENT_LABELS } from "@/lib/whatsapp-events";

function Row({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 text-sm py-1">
      {ok ? (
        <CheckCircle2 className="size-4 text-teal mt-0.5 shrink-0" />
      ) : (
        <XCircle className="size-4 text-navy/30 mt-0.5 shrink-0" />
      )}
      <div>
        <div className={ok ? "text-navy" : "text-navy/60"}>{label}</div>
        {hint ? <div className="text-xs text-navy/40">{hint}</div> : null}
      </div>
    </div>
  );
}

export function WhatsAppPanel() {
  const qc = useQueryClient();
  const status = useServerFn(getWhatsAppStatus);
  const update = useServerFn(updateWhatsAppSettings);
  const addNumber = useServerFn(addWhatsAppTestNumber);
  const removeNumber = useServerFn(removeWhatsAppTestNumber);
  const testConn = useServerFn(runWhatsAppConnectionTest);
  const testSend = useServerFn(sendWhatsAppTestMessage);

  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const [event, setEvent] = useState<string>("booking_confirmed");

  const { data, isLoading } = useQuery({ queryKey: ["whatsapp-status"], queryFn: () => status({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["whatsapp-status"] });

  const saveSettings = useMutation({
    mutationFn: (patch: { production_enabled?: boolean; test_mode?: boolean }) => update({ data: patch }),
    onSuccess: () => { refresh(); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const add = useMutation({
    mutationFn: () => addNumber({ data: { phone, label: label || undefined } }),
    onSuccess: () => { setPhone(""); setLabel(""); refresh(); toast.success("Test number added"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeNumber({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("Removed"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const conn = useMutation({
    mutationFn: () => testConn({}),
    onSuccess: (r: any) => { refresh(); r.ok ? toast.success(r.detail) : toast.error(r.detail); },
    onError: (e) => toast.error((e as Error).message),
  });
  const send = useMutation({
    mutationFn: (id: string) => testSend({ data: { id, event } }),
    onSuccess: (r: any) => { refresh(); r.status === "sent" ? toast.success(r.detail) : toast.error(r.detail); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) return <div className="text-navy/40 text-sm">Loading…</div>;

  const templatesConfigured = Object.values(data.templates).filter((t: any) => t.configured).length;
  const totalTemplates = Object.keys(data.templates).length;

  const state = !data.credentialsComplete
    ? "Configuration incomplete"
    : data.settings.production_enabled
      ? "Production enabled"
      : data.metaVerified
        ? "Test mode"
        : "Credentials configured";

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <div className="flex items-center gap-2 text-xs text-navy/60">
          <MessageCircle className="size-4" /> WhatsApp Business Platform
        </div>
        <div className="text-2xl font-medium mt-1">{state}</div>
        <div className="text-xs text-navy/50 mt-1">
          Outbound transactional notifications only. Two-way WhatsApp conversations are not enabled.
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
          <div className="text-sm font-medium mb-2">Credentials</div>
          {Object.entries(data.required).map(([k, ok]) => (
            <Row key={k} ok={Boolean(ok)} label={k} />
          ))}
          <div className="text-xs text-navy/40 mt-2">
            Values are stored server-side only and are never shown again after saving.
          </div>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
          <div className="text-sm font-medium mb-2">Approved templates ({templatesConfigured}/{totalTemplates})</div>
          {Object.entries(data.templates).map(([ev, t]: [string, any]) => (
            <Row
              key={ev}
              ok={t.configured}
              label={WA_EVENT_LABELS[ev as keyof typeof WA_EVENT_LABELS] ?? ev}
              hint={t.env}
            />
          ))}
          <Row
            ok={data.verificationTemplate.configured}
            label="Verification code (optional)"
            hint={data.verificationTemplate.env}
          />
          <div className="text-xs text-navy/40 mt-2">Template language: {data.templateLang}</div>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
          <div className="text-sm font-medium mb-2">Connection</div>
          <Row ok={data.metaVerified} label="Meta connection verified" />
          <Row ok={data.webhookVerified} label="Webhook receiving events" />
          <div className="text-xs text-navy/50 mt-2">
            Last success: {data.lastSuccessfulTest ? new Date(data.lastSuccessfulTest.created_at).toLocaleString() : "—"}
            <br />
            Last failure: {data.lastFailedTest ? new Date(data.lastFailedTest.created_at).toLocaleString() : "—"}
          </div>
          <button
            onClick={() => conn.mutate()}
            disabled={conn.isPending}
            className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg bg-navy text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plug className="size-3" /> {conn.isPending ? "Testing…" : "Test Meta connection"}
          </button>
        </div>

        <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
          <div className="text-sm font-medium mb-2">Delivery (last 7 days)</div>
          <div className="text-sm text-navy/70">
            Sent {data.delivery.sent} · Failed {data.delivery.failed} · Suppressed {data.delivery.suppressed}
          </div>
          <div className="text-xs text-navy/50 mt-1">
            Success rate:{" "}
            {data.delivery.total ? Math.round((data.delivery.sent / data.delivery.total) * 100) : 0}% ·
            {" "}Test sends: {data.delivery.testSends}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <div className="text-sm font-medium mb-2">Activation</div>
        <label className="flex items-center gap-2 text-sm py-1">
          <input
            type="checkbox"
            checked={data.settings.test_mode}
            onChange={(e) => saveSettings.mutate({ test_mode: e.target.checked })}
          />
          Test mode — only allowlisted numbers can receive
        </label>
        <label className="flex items-center gap-2 text-sm py-1">
          <input
            type="checkbox"
            checked={data.settings.production_enabled}
            onChange={(e) => saveSettings.mutate({ production_enabled: e.target.checked })}
          />
          Production sending enabled
        </label>
        {!data.settings.production_enabled ? (
          <div className="text-xs text-navy/50 mt-2 flex items-start gap-1.5">
            <AlertTriangle className="size-3.5 mt-0.5 text-amber-500" />
            Production sending is off. Real marketplace users cannot receive WhatsApp messages.
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-hairline p-4">
        <div className="text-sm font-medium mb-2">Approved test numbers</div>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="text-sm px-3 py-1.5 rounded-lg ring-1 ring-hairline"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="text-sm px-3 py-1.5 rounded-lg ring-1 ring-hairline"
          />
          <button
            onClick={() => add.mutate()}
            disabled={!phone || add.isPending}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-navy text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-navy/50">Test template:</span>
          <select
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg ring-1 ring-hairline"
          >
            {Object.entries(WA_EVENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {(data.testNumbers ?? []).length === 0 ? (
          <div className="text-xs text-navy/40">No test numbers yet.</div>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {data.testNumbers.map((n: any) => (
              <li key={n.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  +{n.phone} {n.label ? <span className="text-navy/40">· {n.label}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => send.mutate(n.id)}
                    disabled={send.isPending}
                    className="text-xs px-2 py-1 rounded-lg ring-1 ring-hairline inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Send className="size-3" /> Send test
                  </button>
                  <button onClick={() => remove.mutate(n.id)} className="text-navy/40 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="text-xs text-navy/40 mt-2">
          Test messages are prefixed with “TEST” and logged separately. Removing a number stops further test sends immediately.
        </div>
      </div>
    </div>
  );
}
