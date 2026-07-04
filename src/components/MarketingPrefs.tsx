import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";

/**
 * Communication preferences card for /profile.
 * All defaults are false. Consent timestamp set on first opt-in.
 */
export function MarketingPrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["marketing_prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [marketingEmail, setMarketingEmail] = useState("");

  useEffect(() => {
    if (!data) return;
    setEmail(data.email_opt_in);
    setSms(data.sms_opt_in);
    setWhatsapp(data.whatsapp_opt_in);
    setWhatsappNumber(data.whatsapp_number ?? "");
    setMarketingEmail(data.marketing_email ?? "");
  }, [data]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const anyOptIn = email || sms || whatsapp;
    const payload = {
      user_id: user.id,
      email_opt_in: email,
      sms_opt_in: sms,
      whatsapp_opt_in: whatsapp,
      whatsapp_number: whatsappNumber.trim() || null,
      marketing_email: marketingEmail.trim() || null,
      consented_at: anyOptIn ? (data?.consented_at ?? new Date().toISOString()) : null,
    };
    const { error } = await supabase.from("marketing_preferences").upsert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Preferences saved");
    qc.invalidateQueries({ queryKey: ["marketing_prefs", user.id] });
  };

  return (
    <form onSubmit={save} className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Megaphone className="size-5 text-teal mt-0.5" />
        <div>
          <div className="text-sm font-medium">Communication preferences</div>
          <p className="text-xs text-navy/50 mt-1">
            Hear from Bajan.market about tips, new features and offers. Turn any channel off anytime.
          </p>
        </div>
      </div>

      <Toggle label="Email me tips and promos" checked={email} onChange={setEmail} />
      <Toggle label="SMS alerts (occasional)" checked={sms} onChange={setSms} />
      <Toggle label="WhatsApp updates" checked={whatsapp} onChange={setWhatsapp} />

      {whatsapp && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">WhatsApp number</span>
          <input
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+1 246 …"
            className="w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">
          Marketing email (optional)
        </span>
        <input
          type="email"
          value={marketingEmail}
          onChange={(e) => setMarketingEmail(e.target.value)}
          placeholder="Leave blank to use your account email"
          className="w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal"
        />
      </label>

      <button
        disabled={saving}
        className="bg-navy text-white rounded-2xl py-3 text-sm font-medium active:scale-95 transition-transform disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save preferences"}
      </button>
    </form>
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
