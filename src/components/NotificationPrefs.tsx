import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { startWhatsAppVerification, confirmWhatsAppVerification } from "@/lib/notify.functions";
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

  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(true);
  const [whatsapp, setWhatsapp] = useState(false);
  const [messageEvents, setMessageEvents] = useState(true);
  const [bookingEvents, setBookingEvents] = useState(true);
  const [reminderEvents, setReminderEvents] = useState(true);

  useEffect(() => {
    if (!prefs) return;
    setInApp(prefs.in_app_enabled);
    setEmail(prefs.email_enabled);
    setWhatsapp(prefs.whatsapp_enabled);
    setMessageEvents(prefs.message_events);
    setBookingEvents(prefs.booking_events);
    setReminderEvents(prefs.reminder_events);
  }, [prefs]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      in_app_enabled: inApp,
      email_enabled: email,
      whatsapp_enabled: whatsapp,
      message_events: messageEvents,
      booking_events: bookingEvents,
      reminder_events: reminderEvents,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notification settings saved");
    qc.invalidateQueries({ queryKey: ["notification_prefs", user.id] });
  };

  const verified = Boolean(consent?.consented_at && !consent?.opted_out_at);

  return (
    <form onSubmit={save} className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <BellRing className="size-5 text-teal mt-0.5" />
        <div>
          <div className="text-sm font-medium">Booking &amp; message alerts</div>
          <p className="text-xs text-navy/50 mt-1">
            We only ever send activity alerts — never the private answers you give a provider.
          </p>
        </div>
      </div>

      <Toggle label="In-app notifications" checked={inApp} onChange={setInApp} />
      <Toggle label="Email me" checked={email} onChange={setEmail} />
      <Toggle label="WhatsApp me" checked={whatsapp} onChange={setWhatsapp} />

      <div className="h-px bg-hairline" />

      <Toggle label="New messages" checked={messageEvents} onChange={setMessageEvents} />
      <Toggle label="Booking updates" checked={bookingEvents} onChange={setBookingEvents} />
      <Toggle label="Appointment reminders" checked={reminderEvents} onChange={setReminderEvents} />

      <button
        disabled={saving}
        className="bg-navy text-white rounded-2xl py-3 text-sm font-medium active:scale-95 transition-transform disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>

      {whatsapp && <WhatsAppConsent verified={verified} phone={consent?.phone ?? ""} />}
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
