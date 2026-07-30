import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { startWhatsAppVerification, confirmWhatsAppVerification, withdrawWhatsAppConsent } from "@/lib/notify.functions";
import { BellRing, MessageCircle } from "lucide-react";

/**
 * Notification channel preferences plus the WhatsApp opt-in (explicit
 * consent + one-time code verification, as the WhatsApp Business Platform
 * policy requires).
 */
export function NotificationPrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: prefs } = useQuery({
    queryKey: ["notification_prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: consent } = useQuery({
    queryKey: ["whatsapp_consent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_consent")
        .select("phone, verified_at, consented_at, opted_out_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  type Key =
    | "in_app_booking" | "in_app_message" | "in_app_reminder"
    | "email_booking" | "email_message" | "email_reminder"
    | "wa_booking" | "wa_message" | "wa_reminder";

  const DEFAULTS: Record<Key, boolean> = {
    in_app_booking: true, in_app_message: true, in_app_reminder: true,
    email_booking: true, email_message: true, email_reminder: true,
    wa_booking: false, wa_message: false, wa_reminder: false,
  };

  const [state, setState] = useState<Record<Key, boolean>>(DEFAULTS);
  const set = (k: Key) => (v: boolean) => setState((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!prefs) return;
    const p = prefs as unknown as Record<string, boolean>;
    setState((s) => {
      const next = { ...s };
      (Object.keys(DEFAULTS) as Key[]).forEach((k) => {
        if (typeof p[k] === "boolean") next[k] = p[k];
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      ...state,
      // Legacy roll-up columns kept in sync for older readers.
      in_app_enabled: state.in_app_booking || state.in_app_message || state.in_app_reminder,
      email_enabled: state.email_booking || state.email_message || state.email_reminder,
      whatsapp_enabled: state.wa_booking || state.wa_message || state.wa_reminder,
      booking_events: state.in_app_booking || state.email_booking || state.wa_booking,
      message_events: state.in_app_message || state.email_message || state.wa_message,
      reminder_events: state.in_app_reminder || state.email_reminder || state.wa_reminder,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notification settings saved");
    qc.invalidateQueries({ queryKey: ["notification_prefs", user.id] });
  };

  const verified = Boolean(consent?.verified_at && consent?.consented_at && !consent?.opted_out_at);
  const waWanted = state.wa_booking || state.wa_message || state.wa_reminder;

  const groups: { label: string; prefix: "in_app" | "email" | "wa"; note?: string }[] = [
    { label: "In the app", prefix: "in_app" },
    { label: "Email", prefix: "email" },
    { label: "WhatsApp", prefix: "wa", note: "Off unless you verify a number" },
  ];

  return (
    <form onSubmit={save} className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <BellRing className="size-5 text-teal mt-0.5" />
        <div>
          <div className="text-sm font-medium">Booking &amp; message alerts</div>
          <p className="text-xs text-navy/50 mt-1">
            We only ever send activity alerts — never the private answers you give a provider. Security and
            account notices are always sent.
          </p>
        </div>
      </div>

      {groups.map((g, i) => (
        <div key={g.prefix} className="flex flex-col gap-3">
          {i > 0 && <div className="h-px bg-hairline" />}
          <div className="text-xs font-semibold uppercase tracking-wide text-navy/50">
            {g.label}
            {g.note && <span className="ml-2 normal-case font-normal text-navy/40">{g.note}</span>}
          </div>
          <Toggle
            label="Booking updates"
            checked={state[`${g.prefix}_booking` as Key]}
            onChange={set(`${g.prefix}_booking` as Key)}
          />
          <Toggle
            label="New messages"
            checked={state[`${g.prefix}_message` as Key]}
            onChange={set(`${g.prefix}_message` as Key)}
          />
          <Toggle
            label="Appointment reminders"
            checked={state[`${g.prefix}_reminder` as Key]}
            onChange={set(`${g.prefix}_reminder` as Key)}
          />
        </div>
      ))}

      <button
        disabled={saving}
        className="bg-navy text-white rounded-2xl py-3 text-sm font-medium active:scale-95 transition-transform disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>

      {waWanted && <WhatsAppConsent verified={verified} phone={consent?.phone ?? ""} />}
    </form>
  );
}

function WhatsAppConsent({ verified, phone }: { verified: boolean; phone: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [value, setValue] = useState(phone);
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [agreed, setAgreed] = useState(verified);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(phone);
    setAgreed(verified);
  }, [phone, verified]);

  const sendCode = async () => {
    if (!agreed) return toast.error("Please agree to receive WhatsApp alerts first.");
    setBusy(true);
    try {
      const r = await startWhatsAppVerification({ data: { phone: value } });
      setStage("code");
      toast.success(
        r.status === "sent"
          ? "We sent a 6-digit code to your WhatsApp."
          : "Number saved. WhatsApp sending isn't switched on yet — we'll alert you by email meanwhile.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await confirmWhatsAppVerification({ data: { code: code.trim() } });
      toast.success("WhatsApp number verified");
      setStage("idle");
      setCode("");
      qc.invalidateQueries({ queryKey: ["whatsapp_consent", user?.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-sand rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-teal" />
        <span className="text-sm font-medium">WhatsApp alerts</span>
        {verified && <span className="text-[10px] uppercase font-semibold text-teal">Verified</span>}
      </div>

      <label className="flex items-start gap-2 text-xs text-navy/70">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I agree to receive booking and message alerts from Bajan.market on WhatsApp. Reply STOP anytime to opt out.
        </span>
      </label>

      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="+1 246 …"
        className="w-full bg-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal ring-1 ring-hairline"
      />

      {stage === "code" ? (
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            className="flex-1 bg-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal ring-1 ring-hairline"
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={confirm}
            className="bg-teal text-white rounded-xl px-4 text-sm font-medium disabled:opacity-50"
          >
            Verify
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || value.trim().length < 7}
          onClick={sendCode}
          className="bg-white ring-1 ring-hairline rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {verified ? "Update number" : "Send verification code"}
        </button>
      )}

      {verified && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await withdrawWhatsAppConsent({});
              toast.success("WhatsApp alerts switched off");
              qc.invalidateQueries({ queryKey: ["whatsapp_consent", user?.id] });
              qc.invalidateQueries({ queryKey: ["notification_prefs", user?.id] });
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="text-xs text-coral underline underline-offset-2 self-start disabled:opacity-50"
        >
          Withdraw WhatsApp consent
        </button>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-navy">{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-teal" : "bg-sand-deep"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
    </label>
  );
}
