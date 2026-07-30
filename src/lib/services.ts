import type { Database } from "@/integrations/supabase/types";

export type FieldAudience = Database["public"]["Enums"]["service_field_audience"];
export type FieldType = Database["public"]["Enums"]["service_field_type"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];

export type TemplateField = {
  id: string;
  category_id: string;
  audience: FieldAudience;
  field_key: string;
  label: string;
  help_text: string | null;
  field_type: FieldType;
  options: string[];
  required: boolean;
  sensitive: boolean;
  active: boolean;
  sort_order: number;
};

export type AvailabilityRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_minutes: number;
  buffer_minutes: number;
  max_daily_bookings: number;
  min_notice_hours: number;
  advance_days: number;
  timezone: string;
  active: boolean;
  service_listing_id: string | null;
};

export const WEEKDAYS = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
] as const;

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  reschedule_requested: "Reschedule requested",
  cancelled_by_buyer: "Cancelled by buyer",
  cancelled_by_provider: "Cancelled by provider",
  completed: "Completed",
  no_show: "No-show",
  disputed: "Disputed",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, string> = {
  pending: "bg-sand-deep/60 text-navy/70",
  confirmed: "bg-teal/10 text-teal",
  declined: "bg-coral/10 text-coral",
  reschedule_requested: "bg-sand-deep/60 text-navy/70",
  cancelled_by_buyer: "bg-coral/10 text-coral",
  cancelled_by_provider: "bg-coral/10 text-coral",
  completed: "bg-teal/10 text-teal",
  no_show: "bg-coral/10 text-coral",
  disputed: "bg-coral/10 text-coral",
};

/** Barbados has no DST — a fixed -04:00 offset is correct year-round. */
const BARBADOS_OFFSET = "-04:00";

/** Every appointment time on Bajan.market is shown in Barbados time. */
export const BARBADOS_TZ = "America/Barbados";
export const TZ_SHORT = "AST";
export const TZ_NOTE = "All times shown in Barbados time (AST, UTC−4).";

/** Formats an instant in Barbados time, regardless of the viewer's device. */
export function fmtBjt(
  value: Date | string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
) {
  return new Date(value).toLocaleString([], { ...opts, timeZone: BARBADOS_TZ });
}

/** Time only, in Barbados time. */
export function fmtBjtTime(value: Date | string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BARBADOS_TZ,
  });
}

/** "Fri 3 Aug · 2:00 pm – 3:00 pm AST" */
export function bookingWhenLabel(startsAt: Date | string, endsAt?: Date | string | null) {
  const day = fmtBjt(startsAt, { weekday: "short", day: "numeric", month: "short" });
  const start = fmtBjtTime(startsAt);
  const end = endsAt ? ` – ${fmtBjtTime(endsAt)}` : "";
  return `${day} · ${start}${end} ${TZ_SHORT}`;
}


export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Build an absolute instant from a provider-local date + time. */
export function providerInstant(date: string, time: string, timezone: string) {
  const hhmm = time.slice(0, 5);
  if (!timezone || timezone === "America/Barbados") {
    return new Date(`${date}T${hhmm}:00${BARBADOS_OFFSET}`);
  }
  return new Date(`${date}T${hhmm}:00`);
}

function minutesOf(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function timeOf(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

export type Slot = { start: Date; end: Date; label: string };

export function buildSlots(opts: {
  date: string;
  availability: AvailabilityRow[];
  blockedDates: string[];
  busy: { starts_at: string; ends_at: string }[];
  durationMinutes: number;
}): Slot[] {
  const { date, availability, blockedDates, busy, durationMinutes } = opts;
  if (blockedDates.includes(date)) return [];

  const day = new Date(`${date}T12:00:00`).getDay();
  const rows = availability.filter((a) => a.active && a.weekday === day);
  if (rows.length === 0) return [];

  const now = Date.now();
  const busyRanges = busy.map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()] as const);
  const slots: Slot[] = [];

  for (const row of rows) {
    const dayBookings = busyRanges.filter(([s]) => isoDate(new Date(s)) === date).length;
    if (dayBookings >= row.max_daily_bookings) continue;

    const step = Math.max(15, row.slot_minutes) + Math.max(0, row.buffer_minutes);
    const dur = durationMinutes || row.slot_minutes;
    const endLimit = minutesOf(row.end_time);
    const minNotice = now + row.min_notice_hours * 3600_000;
    const maxAdvance = now + row.advance_days * 86_400_000;

    for (let m = minutesOf(row.start_time); m + dur <= endLimit; m += step) {
      if (row.break_start && row.break_end) {
        const bs = minutesOf(row.break_start);
        const be = minutesOf(row.break_end);
        if (m < be && m + dur > bs) continue;
      }
      const start = providerInstant(date, timeOf(m), row.timezone);
      const end = new Date(start.getTime() + dur * 60_000);
      if (start.getTime() < minNotice || start.getTime() > maxAdvance) continue;
      const overlaps = busyRanges.some(([bs, be]) => start.getTime() < be && end.getTime() > bs);
      if (overlaps) continue;
      slots.push({
        start,
        end,
        label: fmtBjtTime(start),
      });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function formatBookingWhen(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  return `${s.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · ${s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function nextDays(count: number, from = new Date()) {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    out.push(isoDate(d));
  }
  return out;
}
