import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildSlots, isoDate, nextDays, TZ_NOTE, type AvailabilityRow, type Slot } from "@/lib/services";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Date strip + time-slot grid. Busy times come from a security-definer
 * lookup that exposes start/end only — never other people's booking details.
 */
export function BookingCalendar({
  providerId,
  serviceListingId,
  durationMinutes,
  value,
  onSelect,
}: {
  providerId: string;
  serviceListingId: string;
  durationMinutes: number;
  value: Slot | null;
  onSelect: (slot: Slot | null) => void;
}) {
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() + offset * 7);
    return nextDays(7, from);
  }, [offset]);
  const [date, setDate] = useState<string>(isoDate(new Date()));

  const { data: availability } = useQuery({
    queryKey: ["service-availability", providerId, serviceListingId],
    queryFn: async () => {
      const { data } = await supabase.rpc("service_public_availability", {
        _provider_id: providerId,
        _service_listing_id: serviceListingId,
      });
      return (data ?? []) as unknown as AvailabilityRow[];
    },
  });

  const { data: blocked } = useQuery({
    queryKey: ["service-blocked", providerId],
    queryFn: async () => {
      const { data } = await supabase.rpc("service_blocked_dates", {
        _provider_id: providerId,
      });
      return (data ?? []).map((b) => b.blocked_date as string);
    },
  });

  const { data: busy } = useQuery({
    queryKey: ["service-busy", providerId, days[0], days[6]],
    queryFn: async () => {
      const from = new Date(`${days[0]}T00:00:00`);
      const to = new Date(`${days[6]}T23:59:59`);
      const { data } = await supabase.rpc("service_busy_slots", {
        _provider_id: providerId,
        _from: from.toISOString(),
        _to: to.toISOString(),
      });
      return (data ?? []) as { starts_at: string; ends_at: string }[];
    },
  });

  const slots = useMemo(
    () =>
      buildSlots({
        date,
        availability: availability ?? [],
        blockedDates: blocked ?? [],
        busy: busy ?? [],
        durationMinutes,
      }),
    [date, availability, blocked, busy, durationMinutes],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          className="size-11 grid place-items-center rounded-xl ring-1 ring-hairline bg-white disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-sm font-medium">
          {new Date(`${days[0]}T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })}
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="size-11 grid place-items-center rounded-xl ring-1 ring-hairline bg-white"
          aria-label="Next week"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00`);
          const active = d === date;
          const isBlocked = (blocked ?? []).includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDate(d);
                onSelect(null);
              }}
              disabled={isBlocked}
              className={`min-h-[56px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                active ? "bg-navy text-white" : "bg-white ring-1 ring-hairline text-navy/70"
              } disabled:opacity-30`}
            >
              <span className="text-[10px] uppercase">{dt.toLocaleDateString([], { weekday: "short" })}</span>
              <span className="text-sm font-semibold">{dt.getDate()}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-navy/40 -mt-1">{TZ_NOTE}</p>

      {slots.length > 0 ? (

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slots.map((s) => {
            const active = value?.start.getTime() === s.start.getTime();
            return (
              <button
                key={s.start.toISOString()}
                type="button"
                onClick={() => onSelect(s)}
                className={`min-h-[48px] rounded-xl text-sm font-medium transition-colors ${
                  active ? "bg-teal text-white" : "bg-white ring-1 ring-hairline text-navy hover:ring-teal/40"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-hairline p-6 text-center text-sm text-navy/50">
          No appointment times available on this date.
        </div>
      )}
    </div>
  );
}
