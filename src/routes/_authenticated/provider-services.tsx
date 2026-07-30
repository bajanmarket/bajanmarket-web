import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ServiceTemplateForm, type AnswerMap } from "@/components/ServiceTemplateForm";
import { useAuth } from "@/lib/useAuth";
import { PARISHES } from "@/lib/parishes";
import { WEEKDAYS, type TemplateField } from "@/lib/services";
import { Briefcase, CalendarDays, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/provider-services")({
  head: () => ({
    meta: [
      { title: "My services — Bajan.market" },
      { name: "description", content: "Publish services, set your working hours and manage bookings." },
      { property: "og:title", content: "My services — Bajan.market" },
      { property: "og:description", content: "Publish services and manage your availability on Bajan.market." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProviderServices,
});

const inputCls =
  "w-full bg-sand rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-teal min-h-[48px]";

function ProviderServices() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"services" | "availability">("services");

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="size-5 text-teal" />
        <h1 className="text-2xl font-medium">My services</h1>
      </div>

      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit">
        {([["services", "Services"], ["availability", "Availability"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
              tab === k ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "services" ? <ServicesTab userId={user?.id} qc={qc} /> : <AvailabilityTab userId={user?.id} qc={qc} />}
    </AppShell>
  );
}

type QC = ReturnType<typeof useQueryClient>;

function ServicesTab({ userId, qc }: { userId?: string; qc: QC }) {
  const [open, setOpen] = useState(false);

  const { data: services } = useQuery({
    queryKey: ["my-services", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_listings")
        .select("*")
        .eq("provider_id", userId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-navy text-white rounded-2xl py-3.5 text-sm font-medium inline-flex items-center justify-center gap-2 min-h-[48px]"
      >
        <Plus className="size-4" /> {open ? "Close form" : "Add a service"}
      </button>

      {open && <NewServiceForm userId={userId} qc={qc} onDone={() => setOpen(false)} />}

      {(services ?? []).map((s) => (
        <div key={s.id} className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex items-center gap-3">
          <div className="size-14 rounded-xl bg-sand-deep overflow-hidden shrink-0">
            {s.cover_image_url && <img src={s.cover_image_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <Link to="/services/$id" params={{ id: s.id }} className="text-sm font-medium hover:underline block truncate">
              {s.title}
            </Link>
            <div className="text-xs text-navy/50">
              {s.currency} ${Number(s.price).toFixed(2)} · {s.duration_minutes} min · {s.status}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={async () => {
                const next = s.status === "active" ? "paused" : "active";
                const { error } = await supabase.from("service_listings").update({ status: next }).eq("id", s.id);
                if (error) return toast.error(error.message);
                qc.invalidateQueries({ queryKey: ["my-services"] });
              }}
              className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2"
            >
              {s.status === "active" ? "Pause" : "Activate"}
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Delete "${s.title}"? Existing bookings stay in your history.`)) return;
                const { error } = await supabase.from("service_listings").update({ status: "removed" }).eq("id", s.id);
                if (error) return toast.error(error.message);
                qc.invalidateQueries({ queryKey: ["my-services"] });
              }}
              className="text-xs bg-coral/10 text-coral ring-1 ring-coral/20 rounded-lg px-3 py-2"
              aria-label="Delete service"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      ))}

      {services && services.length === 0 && !open && (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <h2 className="text-lg font-medium">No services yet.</h2>
          <p className="text-sm text-navy/60 mt-2">Add your first service to start taking bookings.</p>
        </div>
      )}
    </div>
  );
}

function NewServiceForm({ userId, qc, onDone }: { userId?: string; qc: QC; onDone: () => void }) {
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState("per_session");
  const [duration, setDuration] = useState(60);
  const [parish, setParish] = useState("");
  const [mobile, setMobile] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [saving, setSaving] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["service-categories-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_categories")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const category = (categories ?? []).find((c) => c.id === categoryId);

  const { data: fields } = useQuery({
    queryKey: ["provider-fields", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_template_fields")
        .select("*")
        .eq("category_id", categoryId)
        .eq("audience", "provider")
        .eq("active", true)
        .order("sort_order");
      return (data ?? []) as TemplateField[];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !categoryId) return;
    setSaving(true);
    try {
      const { data: created, error } = await supabase
        .from("service_listings")
        .insert({
          provider_id: userId,
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          price: Number(price) || 0,
          price_unit: priceUnit,
          duration_minutes: duration,
          parish: (parish || null) as never,
          mobile_service: mobile,
          instant_booking: category ? !category.requires_provider_approval : false,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = (fields ?? [])
        .filter((f) => answers[f.field_key] !== undefined && answers[f.field_key] !== "")
        .map((f) => ({
          service_listing_id: created.id,
          field_key: f.field_key,
          value: answers[f.field_key] as never,
        }));
      if (rows.length) {
        const { error: aErr } = await supabase.from("service_listing_answers").insert(rows);
        if (aErr) throw aErr;
      }

      toast.success("Service published");
      qc.invalidateQueries({ queryKey: ["my-services"] });
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl ring-1 ring-hairline p-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Category</span>
        <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
          <option value="">Select a category…</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Title</span>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputCls} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Description</span>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          className={inputCls}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Price (BBD)</span>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Pricing</span>
          <select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className={inputCls}>
            <option value="per_session">Per session</option>
            <option value="per_hour">Per hour</option>
            <option value="per_visit">Per visit</option>
            <option value="from">From</option>
            <option value="quote">Quote on request</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Duration</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls}>
            {(category?.duration_options?.length ? category.duration_options : [30, 45, 60, 90, 120, 180]).map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Parish</span>
          <select value={parish} onChange={(e) => setParish(e.target.value)} className={inputCls}>
            <option value="">Not set</option>
            {PARISHES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-3 bg-sand rounded-xl px-4 py-3 min-h-[48px] cursor-pointer">
        <input type="checkbox" checked={mobile} onChange={(e) => setMobile(e.target.checked)} className="size-5 accent-teal" />
        <span className="text-sm">I travel to the customer</span>
      </label>

      {(fields ?? []).length > 0 && (
        <ServiceTemplateForm
          fields={fields ?? []}
          values={answers}
          onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))}
        />
      )}

      <button
        disabled={saving}
        className="bg-navy text-white rounded-2xl py-3.5 text-sm font-medium disabled:opacity-60 min-h-[48px]"
      >
        {saving ? "Publishing…" : "Publish service"}
      </button>
    </form>
  );
}

function AvailabilityTab({ userId, qc }: { userId?: string; qc: QC }) {
  const [weekday, setWeekday] = useState(1);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [blockDate, setBlockDate] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["my-availability", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_availability")
        .select("*")
        .eq("provider_id", userId!)
        .order("weekday");
      return data ?? [];
    },
  });

  const { data: blocked } = useQuery({
    queryKey: ["my-blocked", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("provider_blocked_dates")
        .select("*")
        .eq("provider_id", userId!)
        .order("blocked_date");
      return data ?? [];
    },
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!userId) return;
          const { error } = await supabase.from("provider_availability").insert({
            provider_id: userId,
            weekday,
            start_time: start,
            end_time: end,
            slot_minutes: slotMinutes,
          });
          if (error) return toast.error(error.message);
          toast.success("Working hours added");
          qc.invalidateQueries({ queryKey: ["my-availability"] });
        }}
        className="bg-white rounded-3xl ring-1 ring-hairline p-5 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-teal" />
          <h2 className="text-base font-medium">Working hours</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Day</span>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={inputCls}>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Slot length</span>
            <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className={inputCls}>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Start</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">End</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </label>
        </div>
        <button className="bg-navy text-white rounded-2xl py-3.5 text-sm font-medium min-h-[48px]">Add hours</button>
      </form>

      {(rows ?? []).map((r) => (
        <div key={r.id} className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{WEEKDAYS[r.weekday]?.label}</span>{" "}
            <span className="text-navy/60">
              {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)} · {r.slot_minutes} min slots
            </span>
          </div>
          <button
            onClick={async () => {
              const { error } = await supabase.from("provider_availability").delete().eq("id", r.id);
              if (error) return toast.error(error.message);
              qc.invalidateQueries({ queryKey: ["my-availability"] });
            }}
            className="text-xs bg-coral/10 text-coral ring-1 ring-coral/20 rounded-lg px-3 py-2"
            aria-label="Remove working hours"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!userId || !blockDate) return;
          const { error } = await supabase
            .from("provider_blocked_dates")
            .insert({ provider_id: userId, blocked_date: blockDate });
          if (error) return toast.error(error.message);
          setBlockDate("");
          qc.invalidateQueries({ queryKey: ["my-blocked"] });
        }}
        className="bg-white rounded-3xl ring-1 ring-hairline p-5 flex flex-col gap-3"
      >
        <h2 className="text-base font-medium">Days off</h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            className={inputCls}
          />
          <button className="bg-navy text-white rounded-2xl px-5 text-sm font-medium min-h-[48px]">Block</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(blocked ?? []).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={async () => {
                const { error } = await supabase.from("provider_blocked_dates").delete().eq("id", b.id);
                if (error) return toast.error(error.message);
                qc.invalidateQueries({ queryKey: ["my-blocked"] });
              }}
              className="text-xs bg-sand rounded-full px-3 py-2"
            >
              {b.blocked_date} ×
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
