/**
 * Calendar helpers. Only non-sensitive booking details are ever included —
 * no medical, childcare, access or contact information.
 */

export type CalendarEvent = {
  title: string;
  reference: string;
  start: Date;
  end: Date;
  location?: string | null;
  providerName?: string | null;
  buyerName?: string | null;
  url?: string;
  note?: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function utcStamp(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function buildDescription(ev: CalendarEvent) {
  const lines = [
    `Booking reference: ${ev.reference}`,
    ev.providerName ? `Provider: ${ev.providerName}` : null,
    ev.buyerName ? `Booked by: ${ev.buyerName}` : null,
    ev.note ? ev.note : null,
    ev.url ? `Manage this booking: ${ev.url}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildIcs(ev: CalendarEvent) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BajanMarket//Services Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.reference}@bajanmarket.app`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(ev.start)}`,
    `DTEND:${utcStamp(ev.end)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(buildDescription(ev))}`,
    ev.location ? `LOCATION:${esc(ev.location)}` : null,
    ev.url ? `URL:${esc(ev.url)}` : null,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function downloadIcs(ev: CalendarEvent) {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bajanmarket-${ev.reference}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function gcalStamp(d: Date) {
  return utcStamp(d);
}

export function googleCalendarUrl(ev: CalendarEvent) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${gcalStamp(ev.start)}/${gcalStamp(ev.end)}`,
    details: buildDescription(ev),
  });
  if (ev.location) p.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarUrl(ev: CalendarEvent) {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: ev.start.toISOString(),
    enddt: ev.end.toISOString(),
    body: buildDescription(ev),
  });
  if (ev.location) p.set("location", ev.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}
