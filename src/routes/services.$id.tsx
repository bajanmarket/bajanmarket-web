import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BookingCalendar } from "@/components/BookingCalendar";
import { ServiceTemplateForm, type AnswerMap } from "@/components/ServiceTemplateForm";
import { useAuth } from "@/lib/useAuth";
import { parishLabel } from "@/lib/parishes";
import { bookingWhenLabel, TZ_NOTE, type TemplateField, type Slot } from "@/lib/services";
import { notifyEvent } from "@/lib/notify.functions";
import { MapPin, Clock, Star, ShieldCheck, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/services/$id")({
  head: () => ({
    meta: [
      { title: "Service details — BajanMarket" },
      { name: "description", content: "View this Barbadian service provider's details and book an appointment." },
      { property: "og:title", content: "Service details — BajanMarket" },
      { property: "og:description", content: "Book this service with a trusted local provider in Barbados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServiceDetail,
});

function ServiceDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [slot, setSlot] = useState<Slot | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: service, isLoading } = useQuery({
    queryKey: ["service", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: category } = useQuery({
    queryKey: ["service-category", service?.category_id],
    enabled: !!service?.category_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_categories")
        .select("*")
        .eq("id", service!.category_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: fields } = useQuery({
    queryKey: ["service-buyer-fields", service?.category_id],
    enabled: !!service?.category_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_template_fields")
        .select("*")
        .eq("category_id", service!.category_id)
        .eq("audience", "buyer")
        .eq("active", true)
        .order("sort_order");
      return (data ?? []) as TemplateField[];
    },
  });

  const { data: provider } = useQuery({
    queryKey: ["service-provider", service?.provider_id],
    enabled: !!service?.provider_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, parish")
        .eq("id", service!.provider_id)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <AppShell><div className="text-navy/40 text-sm">Loading…</div></AppShell>;
  if (!service)
    return (
      <AppShell>
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <h1 className="text-xl font-medium">Service not found</h1>
          <Link to="/services" className="text-teal text-sm underline mt-2 inline-block">
            Browse all services
          </Link>
        </div>
      </AppShell>
    );

  const isOwnService = user?.id === service.provider_id;
  const instant = service.instant_booking && category?.instant_booking_allowed !== false;

  const submit = async () => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!slot) {
      toast.error("Pick an appointment time first.");
      return;
    }
    const missing = (fields ?? []).filter((f) => {
      if (!f.required) return false;
      const v = answers[f.field_key];
      return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    });
    if (missing.length) {
      toast.error(`Please fill in: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          service_listing_id: service.id,
          category_id: service.category_id,
          provider_id: service.provider_id,
          buyer_id: user.id,
          starts_at: slot.start.toISOString(),
          ends_at: slot.end.toISOString(),
          price: service.price,
          currency: service.currency,
          status: instant ? "confirmed" : "pending",
          location: location.trim() || service.location_note || null,
          buyer_contact_phone: phone.trim() || null,
          buyer_note: note.trim() || null,
        })
        .select("id, reference, status")
        .single();
      if (error) throw error;

      const answerRows = (fields ?? [])
        .filter((f) => answers[f.field_key] !== undefined && answers[f.field_key] !== "")
        .map((f) => ({
          booking_id: booking.id,
          field_key: f.field_key,
          label: f.label,
          value: answers[f.field_key] as never,
          sensitive: f.sensitive,
        }));
      if (answerRows.length) {
        const { error: aErr } = await supabase.from("booking_answers").insert(answerRows);
        if (aErr) throw aErr;
      }

      // Thread the booking into the existing messaging system.
      const { data: convo } = await supabase
        .from("conversations")
        .insert({ buyer_id: user.id, seller_id: service.provider_id, listing_id: null })
        .select("id")
        .single();
      if (convo) {
        await supabase.from("bookings").update({ conversation_id: convo.id }).eq("id", booking.id);
        await supabase.from("messages").insert({
          conversation_id: convo.id,
          sender_id: user.id,
          body: `Booking ${booking.reference} — ${service.title} on ${bookingWhenLabel(
            slot.start,
            slot.end,
          )}${note.trim() ? `\n\n${note.trim()}` : ""}`,

        });
      }

      await notifyEvent({
        data: {
          event: instant ? "booking_confirmed" : "booking_submitted",
          booking_id: booking.id,
          recipient_id: service.provider_id,
          origin: window.location.origin,
          detail: `${service.title} — ${booking.reference}`,
        },
      }).catch(() => undefined);

      qc.invalidateQueries({ queryKey: ["service-busy"] });
      toast.success(instant ? "Booking confirmed!" : "Booking request sent.");
      navigate({ to: "/bookings" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-5 max-w-3xl">
        <div className="rounded-3xl overflow-hidden bg-sand-deep aspect-[16/9]">
          {service.cover_image_url && (
            <img src={service.cover_image_url} alt={service.title} width={1280} height={720} loading="eager" fetchPriority="high" decoding="async" className="w-full h-full object-cover" />
          )}
        </div>

        <div>
          <h1 className="text-2xl font-medium text-navy">{service.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy/60 mt-2">
            {service.parish && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {parishLabel(service.parish)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {service.duration_minutes} min
            </span>
            {service.rating_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3.5" /> {Number(service.rating_avg).toFixed(1)} ({service.rating_count})
              </span>
            )}
            {service.mobile_service && <span className="text-teal font-medium">Comes to you</span>}
          </div>
          <div className="text-xl font-semibold mt-3">
            {service.currency} ${Number(service.price).toFixed(2)}
            <span className="text-xs font-normal text-navy/50 ml-1">{service.price_unit.replace(/_/g, " ")}</span>
          </div>
        </div>

        <p className="text-sm text-navy/80 whitespace-pre-wrap">{service.description}</p>

        {provider && (
          <Link
            to="/seller/$id"
            params={{ id: provider.id }}
            className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex items-center gap-3"
          >
            <div className="size-11 rounded-full bg-sand-deep overflow-hidden shrink-0">
              {provider.avatar_url && <img src={provider.avatar_url} alt="" width={48} height={48} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{provider.display_name}</div>
              <div className="text-xs text-navy/50">View provider profile</div>
            </div>
          </Link>
        )}

        {(service.cancellation_policy || category?.cancellation_policy) && (
          <div className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex gap-3">
            <ShieldCheck className="size-4 text-teal mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium">Cancellation policy</div>
              <p className="text-xs text-navy/60 mt-1">
                {service.cancellation_policy ?? category?.cancellation_policy}
              </p>
            </div>
          </div>
        )}

        {isOwnService ? (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-6 text-center text-sm text-navy/60">
            This is your own service.{" "}
            <Link to="/provider-services" className="text-teal underline font-medium">
              Manage it here
            </Link>
            .
          </div>
        ) : (
          <div className="bg-white rounded-3xl ring-1 ring-hairline p-5 flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-4 text-teal" />
                <h2 className="text-base font-medium">Book an appointment</h2>
              </div>
              <p className="text-xs text-navy/50 mt-1">{TZ_NOTE}</p>
            </div>


            <BookingCalendar
              providerId={service.provider_id}
              serviceListingId={service.id}
              durationMinutes={service.duration_minutes}
              value={slot}
              onSelect={setSlot}
            />

            {(fields ?? []).length > 0 && (
              <ServiceTemplateForm
                fields={fields ?? []}
                values={answers}
                onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))}
              />
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Contact number</span>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 246 …"
                className="w-full bg-sand rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-teal min-h-[48px]"
              />
            </label>

            {service.mobile_service && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Your address</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Where should the provider meet you?"
                  className="w-full bg-sand rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-teal min-h-[48px]"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-navy/50">Note (optional)</span>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-sand rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-teal"
              />
            </label>

            <div className="bg-sand rounded-2xl p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-navy/60">When</span>
                <span className="font-medium text-right">
                  {slot ? bookingWhenLabel(slot.start, slot.end) : "—"}
                </span>

              </div>
              <div className="flex justify-between mt-1">
                <span className="text-navy/60">Total</span>
                <span className="font-semibold">
                  {service.currency} ${Number(service.price).toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-navy/50 mt-2">
                Payment is arranged directly with the provider. BajanMarket does not process payments.
              </p>
            </div>

            <button
              onClick={submit}
              disabled={submitting || !slot}
              className="bg-navy text-white rounded-2xl py-4 text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50 min-h-[52px]"
            >
              {submitting ? "Sending…" : instant ? "Confirm booking" : "Request booking"}
            </button>
          </div>
        )}

      </div>
    </AppShell>
  );
}
