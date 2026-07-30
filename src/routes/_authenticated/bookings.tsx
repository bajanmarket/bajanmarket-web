import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, bookingWhenLabel, fmtBjt, TZ_NOTE, type BookingStatus } from "@/lib/services";
import { buildIcs, googleCalendarUrl, outlookCalendarUrl } from "@/lib/ics";
import { notifyEvent } from "@/lib/notify.functions";
import { CalendarCheck, CalendarPlus, Download, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "My bookings — Bajan.market" },
      { name: "description", content: "Track your service appointments as a customer and as a provider." },
      { property: "og:title", content: "My bookings — Bajan.market" },
      { property: "og:description", content: "Track and manage your Bajan.market service appointments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingsPage,
});

type BookingRow = {
  id: string;
  reference: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  price: number;
  currency: string;
  location: string | null;
  buyer_note: string | null;
  provider_note: string | null;
  requested_starts_at: string | null;
  buyer_id: string;
  provider_id: string;
  conversation_id: string | null;
  service_listing_id: string;
};

function BookingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [role, setRole] = useState<"buyer" | "provider">("buyer");

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["my-bookings", role, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, reference, starts_at, ends_at, status, price, currency, location, buyer_note, provider_note, requested_starts_at, buyer_id, provider_id, conversation_id, service_listing_id",
        )
        .eq(role === "buyer" ? "buyer_id" : "provider_id", user!.id)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as BookingRow[];
    },
  });

  const serviceIds = Array.from(new Set((bookings ?? []).map((b) => b.service_listing_id)));
  const { data: services } = useQuery({
    queryKey: ["booking-services", serviceIds.sort().join(",")],
    enabled: serviceIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("service_listings").select("id, title").in("id", serviceIds);
      return new Map((data ?? []).map((s) => [s.id, s.title]));
    },
  });

  const setStatus = async (b: BookingRow, status: BookingStatus, event: Parameters<typeof notifyEvent>[0] extends never ? never : string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
    if (error) return toast.error(error.message);
    await notifyEvent({
      data: {
        event: event as never,
        booking_id: b.id,
        recipient_id: user!.id === b.buyer_id ? b.provider_id : b.buyer_id,
        origin: window.location.origin,
        detail: b.reference,
      },
    }).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
    toast.success("Booking updated");
  };

  const notify = async (b: BookingRow, event: string) =>
    notifyEvent({
      data: {
        event: event as never,
        booking_id: b.id,
        recipient_id: user!.id === b.buyer_id ? b.provider_id : b.buyer_id,
        origin: window.location.origin,
        detail: b.reference,
      },
    }).catch(() => undefined);

  const requestReschedule = async (b: BookingRow) => {
    // Everything is entered and shown in Barbados time (AST, UTC−4, no DST).
    const bjt = new Date(new Date(b.starts_at).getTime() - 4 * 3600_000).toISOString().slice(0, 16);
    const input = window.prompt(
      "Propose a new date and time in Barbados time (AST, UTC−4)\nFormat: YYYY-MM-DDTHH:MM",
      bjt,
    );
    if (!input) return;
    const proposed = new Date(`${input.trim().slice(0, 16)}:00-04:00`);
    if (Number.isNaN(proposed.getTime())) return toast.error("That date and time isn't valid.");

    if (proposed.getTime() <= Date.now()) return toast.error("Choose a time in the future.");
    const { error } = await supabase
      .from("bookings")
      .update({ status: "reschedule_requested", requested_starts_at: proposed.toISOString() })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    await notify(b, "booking_reschedule_requested");
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
    toast.success("New time proposed");
  };

  const respondReschedule = async (b: BookingRow, accept: boolean) => {
    if (accept) {
      if (!b.requested_starts_at) return toast.error("No proposed time found.");
      const duration = new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime();
      const start = new Date(b.requested_starts_at);
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + duration).toISOString(),
          requested_starts_at: null,
        })
        .eq("id", b.id);
      if (error) return toast.error(error.message);
      await notify(b, "booking_changed");
    } else {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "declined", requested_starts_at: null })
        .eq("id", b.id);
      if (error) return toast.error(error.message);
      await notify(b, "booking_declined");
    }
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
    toast.success(accept ? "New time confirmed" : "New time declined");
  };

  const downloadIcs = (b: BookingRow, title: string) => {
    const ics = buildIcs({
      title,
      reference: b.reference,
      location: b.location,
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${b.reference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <CalendarCheck className="size-5 text-teal" />
          <h1 className="text-2xl font-medium">Bookings</h1>
        </div>
        <p className="text-xs text-navy/50 mt-1">{TZ_NOTE}</p>
      </div>


      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 ring-1 ring-hairline w-fit">
        {([["buyer", "As customer"], ["provider", "As provider"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setRole(k)}
            className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
              role === k ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-navy/40 text-sm">Loading…</div>
      ) : bookings && bookings.length > 0 ? (
        <div className="flex flex-col gap-3 max-w-2xl">
          {bookings.map((b) => {
            const title = services?.get(b.service_listing_id) ?? "Service";

            return (
              <div key={b.id} className="bg-white rounded-2xl ring-1 ring-hairline p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/services/$id"
                      params={{ id: b.service_listing_id }}
                      className="text-sm font-medium hover:underline"
                    >
                      {title}
                    </Link>
                    <div className="text-xs text-navy/50 mt-1">
                      {bookingWhenLabel(b.starts_at, b.ends_at)} · {b.reference}
                    </div>

                    {b.location && <div className="text-xs text-navy/50 mt-0.5">{b.location}</div>}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase rounded-full px-2 py-1 shrink-0 ${
                      BOOKING_STATUS_TONE[b.status]
                    }`}
                  >
                    {BOOKING_STATUS_LABEL[b.status]}
                  </span>
                </div>

                {b.buyer_note && <p className="text-sm text-navy/70 whitespace-pre-wrap">{b.buyer_note}</p>}

                {b.status === "reschedule_requested" && b.requested_starts_at && (
                  <div className="bg-sand rounded-xl px-3 py-2 text-xs text-navy/70">
                    New time proposed:{" "}
                    <span className="font-medium text-navy">
                      {fmtBjt(b.requested_starts_at)} AST

                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {role === "provider" && b.status === "pending" && (
                    <>
                      <button
                        onClick={() => setStatus(b, "confirmed", "booking_confirmed")}
                        className="text-xs bg-teal/10 text-teal ring-1 ring-teal/20 rounded-lg px-3 py-2 min-h-[40px]"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => setStatus(b, "declined", "booking_declined")}
                        className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2 min-h-[40px]"
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {role === "provider" && (b.status === "pending" || b.status === "confirmed") && (
                    <button
                      onClick={() => requestReschedule(b)}
                      className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2 min-h-[40px]"
                    >
                      Propose new time
                    </button>
                  )}
                  {role === "buyer" && b.status === "reschedule_requested" && (
                    <>
                      <button
                        onClick={() => respondReschedule(b, true)}
                        className="text-xs bg-teal/10 text-teal ring-1 ring-teal/20 rounded-lg px-3 py-2 min-h-[40px]"
                      >
                        Accept new time
                      </button>
                      <button
                        onClick={() => respondReschedule(b, false)}
                        className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2 min-h-[40px]"
                      >
                        Decline new time
                      </button>
                    </>
                  )}
                  {role === "provider" && b.status === "confirmed" && (
                    <button
                      onClick={() => setStatus(b, "completed", "booking_completed")}
                      className="text-xs bg-teal/10 text-teal ring-1 ring-teal/20 rounded-lg px-3 py-2 min-h-[40px]"
                    >
                      Mark completed
                    </button>
                  )}
                  {(b.status === "pending" || b.status === "confirmed") && (
                    <button
                      onClick={() => {
                        if (confirm("Cancel this booking?")) setStatus(b, role === "provider" ? "cancelled_by_provider" : "cancelled_by_buyer", "booking_cancelled");
                      }}
                      className="text-xs bg-coral/10 text-coral ring-1 ring-coral/20 rounded-lg px-3 py-2 min-h-[40px]"
                    >
                      Cancel
                    </button>
                  )}
                  {b.conversation_id && (
                    <Link
                      to="/messages/$id"
                      params={{ id: b.conversation_id }}
                      className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2 inline-flex items-center gap-1.5 min-h-[40px]"
                    >
                      <MessageSquare className="size-3.5" /> Message
                    </Link>
                  )}
                  <button
                    onClick={() => downloadIcs(b, title)}
                    className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2 inline-flex items-center gap-1.5 min-h-[40px]"
                  >
                    <Download className="size-3.5" /> .ics
                  </button>
                  <a
                    href={googleCalendarUrl({
                      title,
                      reference: b.reference,
                      location: b.location,
                      start: new Date(b.starts_at),
                      end: new Date(b.ends_at),
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2 inline-flex items-center gap-1.5 min-h-[40px]"
                  >
                    <CalendarPlus className="size-3.5" /> Google
                  </a>
                  <a
                    href={outlookCalendarUrl({
                      title,
                      reference: b.reference,
                      location: b.location,
                      start: new Date(b.starts_at),
                      end: new Date(b.ends_at),
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-white ring-1 ring-hairline rounded-lg px-3 py-2 inline-flex items-center gap-1.5 min-h-[40px]"
                  >
                    <CalendarPlus className="size-3.5" /> Outlook
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl ring-1 ring-hairline p-10 text-center">
          <CalendarCheck className="size-8 mx-auto text-navy/30" />
          <h2 className="text-lg font-medium mt-3">No bookings yet.</h2>
          <p className="text-sm text-navy/60 mt-2">
            <Link to="/services" className="text-teal underline font-medium">
              Browse services
            </Link>{" "}
            to book your first appointment.
          </p>
        </div>
      )}
    </AppShell>
  );
}
