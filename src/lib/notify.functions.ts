import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FROM = "Bajan.market <bajanmarket@bajanmarket.app>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const EVENTS = [
  "message",
  "booking_submitted",
  "booking_confirmed",
  "booking_declined",
  "booking_reschedule_requested",
  "booking_changed",
  "booking_cancelled",
  "booking_reminder",
  "booking_completed",
  "booking_disputed",
] as const;

type EventKey = (typeof EVENTS)[number];

const COPY: Record<EventKey, { title: string; body: string; whatsapp: string }> = {
  message: {
    title: "New message",
    body: "You have a new message on Bajan.market.",
    whatsapp: "You have a new message on BajanMarket.",
  },
  booking_submitted: {
    title: "New booking request",
    body: "A buyer has requested a booking for one of your services.",
    whatsapp: "Your booking request has been received.",
  },
  booking_confirmed: {
    title: "Booking confirmed",
    body: "Your appointment has been confirmed.",
    whatsapp: "Your appointment has been confirmed.",
  },
  booking_declined: {
    title: "Booking declined",
    body: "Your booking request was declined.",
    whatsapp: "Your booking request was declined.",
  },
  booking_reschedule_requested: {
    title: "Reschedule requested",
    body: "A new appointment time has been proposed.",
    whatsapp: "A provider has requested a new appointment time.",
  },
  booking_changed: {
    title: "Booking updated",
    body: "The details of your booking have changed.",
    whatsapp: "Your booking details have changed.",
  },
  booking_cancelled: {
    title: "Booking cancelled",
    body: "A booking has been cancelled.",
    whatsapp: "A booking has been cancelled.",
  },
  booking_reminder: {
    title: "Appointment reminder",
    body: "You have an appointment coming up.",
    whatsapp: "Your appointment is scheduled soon.",
  },
  booking_completed: {
    title: "Appointment completed",
    body: "Your appointment has been marked completed.",
    whatsapp: "Your appointment has been marked completed.",
  },
  booking_disputed: {
    title: "Dispute opened",
    body: "A dispute has been opened for a booking.",
    whatsapp: "A dispute has been opened for a booking.",
  },
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) return { ok: false, error: "Email not configured" };
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.message ?? `HTTP ${res.status}` };
    return { ok: true, id: json?.id ?? null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Creates an in-app notification for the counterparty of a booking (or
 * conversation) and fans it out to email / WhatsApp based on their
 * preferences. Only activity — never private content — leaves the platform.
 */
export const notifyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        event: z.enum(EVENTS),
        booking_id: z.string().uuid().optional(),
        conversation_id: z.string().uuid().optional(),
        recipient_id: z.string().uuid(),
        origin: z.string().url(),
        detail: z.string().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The caller must be a party to whatever they're notifying about.
    if (data.booking_id) {
      const { data: b } = await context.supabase
        .from("bookings")
        .select("id, buyer_id, provider_id, reference")
        .eq("id", data.booking_id)
        .maybeSingle();
      if (!b) throw new Error("Forbidden");
      if (b.buyer_id !== context.userId && b.provider_id !== context.userId) throw new Error("Forbidden");
      if (data.recipient_id !== b.buyer_id && data.recipient_id !== b.provider_id) throw new Error("Forbidden");
    } else if (data.conversation_id) {
      const { data: c } = await context.supabase
        .from("conversations")
        .select("id, buyer_id, seller_id")
        .eq("id", data.conversation_id)
        .maybeSingle();
      if (!c) throw new Error("Forbidden");
      if (c.buyer_id !== context.userId && c.seller_id !== context.userId) throw new Error("Forbidden");
      if (data.recipient_id !== c.buyer_id && data.recipient_id !== c.seller_id) throw new Error("Forbidden");
    } else {
      throw new Error("A booking or conversation is required");
    }

    if (data.recipient_id === context.userId) return { skipped: "self" };

    const copy = COPY[data.event];
    const link = data.booking_id
      ? `/bookings?ref=${data.booking_id}`
      : `/messages/${data.conversation_id}`;
    const url = `${data.origin}${link}`;

    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("*")
      .eq("user_id", data.recipient_id)
      .maybeSingle();

    const inApp = prefs?.in_app_enabled ?? true;
    const emailOn = prefs?.email_enabled ?? true;
    const waOn = prefs?.whatsapp_enabled ?? false;
    const groupOn =
      data.event === "message"
        ? (prefs?.message_events ?? true)
        : data.event === "booking_reminder"
          ? (prefs?.reminder_events ?? true)
          : (prefs?.booking_events ?? true);

    if (!groupOn) return { skipped: "opted-out" };

    let notificationId: string | null = null;
    // Duplicate-event prevention: the same event for the same subject and
    // recipient can only ever produce one notification (and one fan-out).
    const dedupeKey =
      data.dedupe_key ??
      [data.event, data.booking_id ?? data.conversation_id ?? "", data.detail ?? ""].join(":").slice(0, 200);

    if (inApp) {
      const { data: n, error: insErr } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: data.recipient_id,
          type: data.event,
          title: copy.title,
          body: data.detail ?? copy.body,
          link,
          booking_id: data.booking_id ?? null,
          conversation_id: data.conversation_id ?? null,
          dedupe_key: dedupeKey,
        })
        .select("id")
        .maybeSingle();
      // 23505 = unique violation on (user_id, dedupe_key): already notified.
      if (insErr && (insErr as { code?: string }).code === "23505") {
        return { skipped: "duplicate" as const };
      }
      notificationId = n?.id ?? null;
    }


    const deliveries: { channel: string; status: string; error?: string | null; providerMessageId?: string | null }[] =
      [];

    if (emailOn) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(data.recipient_id);
      const to = userRes?.user?.email;
      if (to) {
        const text = `${copy.body}\n\n${data.detail ?? ""}\n\nOpen Bajan.market: ${url}`;
        const html = `<p>${escapeHtml(copy.body)}</p>${data.detail ? `<p>${escapeHtml(data.detail)}</p>` : ""}<p><a href="${url}">Open on Bajan.market</a></p>`;
        const r = await sendEmail(to, `${copy.title} — Bajan.market`, text, html);
        deliveries.push({ channel: "email", status: r.ok ? "sent" : "failed", error: r.ok ? null : (r as any).error });
      }
    }

    if (waOn) {
      const { data: consent } = await supabaseAdmin
        .from("whatsapp_consent")
        .select("phone, verified_at, consented_at, opted_out_at")
        .eq("user_id", data.recipient_id)
        .maybeSingle();
      if (consent?.phone && consent.consented_at && !consent.opted_out_at) {
        const { sendWhatsApp } = await import("@/lib/whatsapp.server");
        const r = await sendWhatsApp(consent.phone, `${copy.whatsapp}\n${url}`);
        deliveries.push({
          channel: "whatsapp",
          status: r.status,
          error: r.status === "failed" ? r.error : r.status === "skipped" ? r.reason : null,
          providerMessageId: r.status === "sent" ? r.providerMessageId : null,
        });
      } else {
        deliveries.push({ channel: "whatsapp", status: "skipped", error: "No verified consent on file" });
      }
    }

    if (deliveries.length) {
      await supabaseAdmin.from("notification_deliveries").insert(
        deliveries.map((d) => ({
          notification_id: notificationId,
          user_id: data.recipient_id,
          channel: d.channel,
          status: d.status,
          error: d.error ?? null,
          provider_message_id: d.providerMessageId ?? null,
        })),
      );
    }

    return { ok: true, deliveries: deliveries.map((d) => ({ channel: d.channel, status: d.status })) };
  });

/** Sends a 6-digit verification code over WhatsApp to confirm the user's number. */
export const startWhatsAppVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ phone: z.string().min(7).max(24) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsApp, whatsappConfigured, normalisePhone } = await import("@/lib/whatsapp.server");

    const phone = normalisePhone(data.phone);
    if (!phone) throw new Error("That phone number doesn't look valid. Include the country code.");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabaseAdmin.from("whatsapp_consent").upsert(
      {
        user_id: context.userId,
        phone: data.phone.trim(),
        verification_code: code,
        verification_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        opted_out_at: null,
      },
      { onConflict: "user_id" },
    );

    if (!whatsappConfigured()) {
      return { status: "pending_channel" as const };
    }
    const r = await sendWhatsApp(phone, `Your BajanMarket verification code is ${code}.`);
    if (r.status === "failed") throw new Error(`Could not send the code: ${r.error}`);
    return { status: "sent" as const };
  });

export const confirmWhatsAppVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().length(6) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("whatsapp_consent")
      .select("verification_code, verification_expires_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.verification_code) throw new Error("Request a new code first.");
    if (row.verification_expires_at && new Date(row.verification_expires_at) < new Date())
      throw new Error("That code expired. Request a new one.");
    if (row.verification_code !== data.code) throw new Error("That code doesn't match.");

    await supabaseAdmin
      .from("whatsapp_consent")
      .update({
        verified_at: new Date().toISOString(),
        consented_at: new Date().toISOString(),
        consent_method: "in_app_checkbox_and_code",
        verification_code: null,
        verification_expires_at: null,
      })
      .eq("user_id", context.userId);
    return { ok: true };
  });
