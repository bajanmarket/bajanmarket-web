import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { uploadImage } from "@/lib/uploadImage";
import { PARISHES } from "@/lib/parishes";
import { toast } from "sonner";
import { Store, CheckCircle2, Clock3, XCircle, Upload, ExternalLink } from "lucide-react";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

type HoursMap = Record<string, { open: string; close: string; closed: boolean }>;

const DEFAULT_HOURS: HoursMap = Object.fromEntries(
  DAYS.map((d) => [d.key, { open: "09:00", close: "17:00", closed: d.key === "sun" }]),
) as HoursMap;

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({ meta: [{ title: "Business storefront — Bajan.market" }, { name: "robots", content: "noindex" }] }),
  component: BusinessManager,
});

function BusinessManager() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: biz, isLoading } = useQuery({
    queryKey: ["my-business", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("businesses").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    name: "", slug: "", tagline: "", description: "",
    contact_email: "", contact_phone: "", whatsapp: "", website: "",
    address: "", parish: "",
    logo_url: "" as string | null,
    banner_url: "" as string | null,
    hours: DEFAULT_HOURS,
  });
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (biz) {
      setForm({
        name: biz.name ?? "",
        slug: biz.slug ?? "",
        tagline: biz.tagline ?? "",
        description: biz.description ?? "",
        contact_email: biz.contact_email ?? "",
        contact_phone: biz.contact_phone ?? "",
        whatsapp: biz.whatsapp ?? "",
        website: biz.website ?? "",
        address: biz.address ?? "",
        parish: biz.parish ?? "",
        logo_url: biz.logo_url,
        banner_url: biz.banner_url,
        hours: { ...DEFAULT_HOURS, ...((biz.hours as Partial<HoursMap> | null) ?? {}) } as HoursMap,
      });
      setSlugTouched(true);
    }
  }, [biz]);

  const onNameChange = (v: string) => {
    setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }));
  };

  const onUpload = async (kind: "logo_url" | "banner_url", file: File | null) => {
    if (!file || !user) return;
    try {
      const url = await uploadImage("listings", user.id, file);
      setForm((f) => ({ ...f, [kind]: url }));
      toast.success(`${kind === "logo_url" ? "Logo" : "Banner"} uploaded`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim() || form.name.trim().length < 2) return toast.error("Business name is required");
    const slug = slugify(form.slug || form.name);
    if (slug.length < 3) return toast.error("Slug must be at least 3 characters");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug,
      tagline: form.tagline || null,
      description: form.description || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      whatsapp: form.whatsapp || null,
      website: form.website || null,
      address: form.address || null,
      parish: form.parish || null,
      logo_url: form.logo_url,
      banner_url: form.banner_url,
      hours: form.hours,
    };
    let err: { message: string } | null = null;
    if (biz) {
      const { error } = await supabase.from("businesses").update(payload).eq("id", biz.id);
      err = error;
    } else {
      const { error } = await supabase.from("businesses").insert({ ...payload, owner_id: user.id, status: "pending" });
      err = error;
    }
    setSaving(false);
    if (err) return toast.error(err.message);
    toast.success(biz ? "Storefront updated" : "Submitted for review");
    qc.invalidateQueries({ queryKey: ["my-business", user.id] });
  };

  if (isLoading) return <AppShell><div className="text-navy/40 text-sm">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Store className="size-6 text-teal" />
          <h1 className="text-2xl font-medium">Business storefront</h1>
        </div>

        {biz && <StatusBanner status={biz.status} slug={biz.slug} reason={biz.rejection_reason} />}

        {!biz && (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-5 text-sm text-navy/70">
            Turn your seller account into a business page with a logo, banner, hours, contact details, and reviews. Submissions are reviewed by our team before going live.
          </div>
        )}

        <section className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50">Branding</h2>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-navy/50 mb-1.5">Banner</div>
            <label className="block w-full aspect-[3/1] bg-sand-deep rounded-2xl overflow-hidden cursor-pointer relative grid place-items-center">
              {form.banner_url ? (
                <img src={form.banner_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-navy/40 text-sm inline-flex items-center gap-2"><Upload className="size-4" /> Upload banner (3:1)</span>
              )}
              <input type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => onUpload("banner_url", e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-navy/50 mb-1.5">Logo</div>
            <label className="block size-24 bg-sand-deep rounded-2xl overflow-hidden cursor-pointer grid place-items-center">
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Upload className="size-5 text-navy/40" />
              )}
              <input type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => onUpload("logo_url", e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50">Details</h2>
          <F label="Business name">
            <input value={form.name} onChange={(e) => onNameChange(e.target.value)} maxLength={80} className={inp} />
          </F>
          <F label={`URL — bajan.market/business/${form.slug || "your-slug"}`}>
            <input
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }}
              maxLength={60}
              className={inp}
            />
          </F>
          <F label="Tagline">
            <input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} maxLength={120} className={inp} />
          </F>
          <F label="About">
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} maxLength={1500} className={inp} />
          </F>
        </section>

        <section className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50">Contact</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <F label="Email"><input type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} className={inp} /></F>
            <F label="Phone"><input type="tel" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} className={inp} /></F>
            <F label="WhatsApp (e.g. 12465551234)"><input type="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} className={inp} /></F>
            <F label="Website"><input type="url" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className={inp} placeholder="https://…" /></F>
            <F label="Address"><input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inp} /></F>
            <F label="Parish">
              <select value={form.parish} onChange={(e) => setForm((f) => ({ ...f, parish: e.target.value }))} className={inp}>
                <option value="">—</option>
                {PARISHES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </F>
          </div>
        </section>

        <section className="bg-white rounded-3xl ring-1 ring-hairline p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-navy/50">Business hours</h2>
          {DAYS.map((d) => {
            const h = form.hours[d.key];
            return (
              <div key={d.key} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-navy/70">{d.label}</span>
                <label className="inline-flex items-center gap-2 text-xs text-navy/60">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.key]: { ...f.hours[d.key], closed: !e.target.checked } } }))}
                  />
                  Open
                </label>
                <input
                  type="time"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.key]: { ...f.hours[d.key], open: e.target.value } } }))}
                  className="bg-sand rounded-lg px-2 py-1 text-xs disabled:opacity-40"
                />
                <span className="text-navy/40">–</span>
                <input
                  type="time"
                  value={h.close}
                  disabled={h.closed}
                  onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.key]: { ...f.hours[d.key], close: e.target.value } } }))}
                  className="bg-sand rounded-lg px-2 py-1 text-xs disabled:opacity-40"
                />
              </div>
            );
          })}
        </section>

        <div className="flex items-center justify-between gap-3">
          {biz?.status === "approved" && (
            <Link to="/business/$slug" params={{ slug: biz.slug }} className="text-sm text-teal hover:underline inline-flex items-center gap-1">
              <ExternalLink className="size-3.5" /> View public page
            </Link>
          )}
          <button onClick={save} disabled={saving} className="bg-navy text-white rounded-2xl px-6 py-3 text-sm font-medium disabled:opacity-50 ml-auto">
            {saving ? "Saving…" : biz ? "Save changes" : "Submit for review"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function StatusBanner({ status, slug, reason }: { status: string; slug: string; reason: string | null }) {
  if (status === "approved") {
    return (
      <div className="bg-teal/10 ring-1 ring-teal/20 rounded-2xl p-4 flex items-start gap-3">
        <CheckCircle2 className="size-5 text-teal shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-navy">Approved — your storefront is live</div>
          <Link to="/business/$slug" params={{ slug }} className="text-teal hover:underline text-xs">bajan.market/business/{slug}</Link>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="bg-sand ring-1 ring-hairline rounded-2xl p-4 flex items-start gap-3">
        <Clock3 className="size-5 text-navy/50 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-navy">Pending review</div>
          <p className="text-navy/60 text-xs mt-0.5">We'll approve your storefront shortly. You can keep editing while you wait.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-coral/10 ring-1 ring-coral/20 rounded-2xl p-4 flex items-start gap-3">
      <XCircle className="size-5 text-coral shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-medium text-navy">Not approved</div>
        {reason && <p className="text-navy/70 text-xs mt-0.5">{reason}</p>}
        <p className="text-navy/60 text-xs mt-1">Make changes and save to resubmit.</p>
      </div>
    </div>
  );
}

const inp = "w-full bg-sand rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">{label}</span>
      {children}
    </label>
  );
}
