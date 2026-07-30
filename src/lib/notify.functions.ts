import { createServerFn } from "@tanstack/react-start";
import { createHash } from "crypto";
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
        dedupe_key: z.string().max(200).optional(),

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

    const group: "booking" | "message" | "reminder" =
      data.event === "message" ? "message" : data.event === "booking_reminder" ? "reminder" : "booking";

    // Nine independent switches. Each channel/group pair is opt-out on its own;
    // WhatsApp is opt-in (defaults false) and email/in-app default on.
    const p = prefs as Record<string, boolean | undefined> | null;
    const inApp = p?.[`in_app_${group}`] ?? true;
    const emailOn = p?.[`email_${group}`] ?? true;
    const waOn = p?.[`wa_${group}`] ?? false;

    if (!inApp && !emailOn && !waOn) return { skipped: "opted-out" };

    let notificationId: string | null = null;
    // Duplicate-event prevention. One-off transitions (confirmed, declined,
    // completed…) can only ever notify once per booking. Events that may
    // legitimately repeat collapse within a 5-minute window so retries and
    // double clicks don't spam the recipient.
    const REPEATABLE = new Set([
      "message",
      "booking_reschedule_requested",
      "booking_changed",
      "booking_reminder",
    ]);
    const subject = data.booking_id ?? data.conversation_id ?? "";
    const bucket = REPEATABLE.has(data.event) ? String(Math.floor(Date.now() / 300_000)) : "";
    const dedupeKey = (data.dedupe_key ?? [data.event, subject, bucket].join(":")).slice(0, 200);


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


    type Delivery = {
      channel: string;
      status: string;
      error?: string | null;
      providerMessageId?: string | null;
      isTest?: boolean;
      errorCode?: string | null;
    };
    const deliveries: Delivery[] = [];

    // Idempotency: one row per (recipient, dedupe key, channel). A replayed
    // event can never produce a second provider send.
    const claim = async (channel: string) => {
      const { error } = await supabaseAdmin.from("notification_deliveries").insert({
        notification_id: notificationId,
        user_id: data.recipient_id,
        channel,
        status: "queued",
        attempts: 1,
        idempotency_key: `${data.recipient_id}:${dedupeKey}:${channel}`.slice(0, 300),
      });
      return !error;
    };
    const settle = async (channel: string, d: Delivery) => {
      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: d.status,
          error: d.error ?? null,
          provider_message_id: d.providerMessageId ?? null,
          provider_error_code: d.errorCode ?? null,
          is_test: d.isTest ?? false,
          status_at: new Date().toISOString(),
          status_rank: d.status === "sent" ? 1 : 0,
          next_retry_at: d.status === "failed" ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
        })

        .eq("idempotency_key", `${data.recipient_id}:${dedupeKey}:${channel}`.slice(0, 300));
      deliveries.push(d);
    };

    if (emailOn && (await claim("email"))) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(data.recipient_id);
      const to = userRes?.user?.email;
      if (to) {
        const text = `${copy.body}\n\n${data.detail ?? ""}\n\nOpen Bajan.market: ${url}`;
        const html = `<p>${escapeHtml(copy.body)}</p>${data.detail ? `<p>${escapeHtml(data.detail)}</p>` : ""}<p><a href="${url}">Open on Bajan.market</a></p>`;
        const r = await sendEmail(to, `${copy.title} — Bajan.market`, text, html);
        await settle("email", {
          channel: "email",
          status: r.ok ? "sent" : "failed",
          error: r.ok ? null : (r as { error?: string }).error,
        });
      } else {
        await settle("email", { channel: "email", status: "skipped", error: "No email on file" });
      }
    }

    if (waOn && (await claim("whatsapp"))) {
      const { data: consent } = await supabaseAdmin
        .from("whatsapp_consent")
        .select("phone, verified_at, consented_at, opted_out_at")
        .eq("user_id", data.recipient_id)
        .maybeSingle();
      const { WA_EVENT_MAP } = await import("@/lib/whatsapp-events");
      const waEvent = WA_EVENT_MAP[data.event];
      // Suppression: unverified numbers and withdrawn consent never receive.
      if (!waEvent) {
        await settle("whatsapp", {
          channel: "whatsapp",
          status: "suppressed",
          error: "Event is not eligible for WhatsApp delivery",
        });
      } else if (consent?.phone && consent.verified_at && consent.consented_at && !consent.opted_out_at) {
        const { sendWhatsAppTemplate } = await import("@/lib/whatsapp.server");
        // Template parameters are built server-side from safe fields only:
        // reference, service name, date, time, Barbados-time label and link.
        let reference = "";
        let serviceName: string | undefined;
        let date: string | undefined;
        let time: string | undefined;
        if (data.booking_id) {
          const { data: b } = await supabaseAdmin
            .from("bookings")
            .select("reference, starts_at, service_listings(title)")
            .eq("id", data.booking_id)
            .maybeSingle();
          reference = b?.reference ?? "";
          serviceName = (b as { service_listings?: { title?: string } } | null)?.service_listings?.title;
          if (b?.starts_at) {
            const d = new Date(b.starts_at);
            date = d.toLocaleDateString("en-GB", { timeZone: "America/Barbados", day: "2-digit", month: "short", year: "numeric" });
            time = d.toLocaleTimeString("en-GB", { timeZone: "America/Barbados", hour: "2-digit", minute: "2-digit" });
          }
        }
        const r = await sendWhatsAppTemplate(consent.phone, waEvent, {
          reference,
          serviceName,
          date,
          time,
          tzLabel: "AST (Barbados time)",
          link: url,
        });
        await settle("whatsapp", {
          channel: "whatsapp",
          status: r.status,
          error: r.status === "failed" ? r.error : r.status === "suppressed" ? r.reason : null,
          providerMessageId: r.status === "sent" ? r.providerMessageId : null,
          isTest: r.status === "sent" ? r.isTest : false,
          errorCode: r.status === "failed" ? (r.errorCode ?? null) : null,
        });
        await supabaseAdmin
          .from("whatsapp_consent")
          .update({ last_delivery_status: r.status, last_delivery_at: new Date().toISOString() })
          .eq("user_id", data.recipient_id);
      } else {
        await settle("whatsapp", {
          channel: "whatsapp",
          status: "suppressed",
          error: "No verified consent on file",
        });
      }
    }


    return { ok: true, deliveries: deliveries.map((d) => ({ channel: d.channel, status: d.status })) };
  });

const CONSENT_TEXT_VERSION = "wa-consent-v1";

function hashCode(userId: string, code: string) {
  // Codes are never stored or logged in plain text.
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

/** Sends a 6-digit verification code over WhatsApp to confirm the user's number. */
export const startWhatsAppVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ phone: z.string().min(7).max(24) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsApp, whatsappConfigured, normalisePhone } = await import("@/lib/whatsapp.server");

    const phone = normalisePhone(data.phone);
    if (!phone) throw new Error("That phone number doesn't look valid. Include the country code.");

    const { data: existing } = await supabaseAdmin
      .from("whatsapp_consent")
      .select("last_code_sent_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    // Resend cooldown: 60 seconds.
    if (existing?.last_code_sent_at && Date.now() - new Date(existing.last_code_sent_at).getTime() < 60_000) {
      throw new Error("Please wait a minute before requesting another code.");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabaseAdmin.from("whatsapp_consent").upsert(
      {
        user_id: context.userId,
        phone: `+${phone}`,
        verification_code_hash: hashCode(context.userId, code),
        verification_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        verify_attempts: 0,
        last_code_sent_at: new Date().toISOString(),
        verified_at: null,
        consented_at: null,
        opted_out_at: null,
      },
      { onConflict: "user_id" },
    );

    if (!whatsappConfigured()) {
      return { status: "pending_channel" as const };
    }
    const r = await sendWhatsApp(phone, `Your BajanMarket verification code is ${code}.`);
    if (r.status === "failed") throw new Error("Could not send the code. Please try again shortly.");
    return { status: "sent" as const };
  });

export const confirmWhatsAppVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().length(6) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("whatsapp_consent")
      .select("verification_code_hash, verification_expires_at, verify_attempts")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row?.verification_code_hash) throw new Error("Request a new code first.");
    if ((row.verify_attempts ?? 0) >= 5) throw new Error("Too many attempts. Request a new code.");
    if (row.verification_expires_at && new Date(row.verification_expires_at) < new Date())
      throw new Error("That code expired. Request a new one.");

    if (row.verification_code_hash !== hashCode(context.userId, data.code)) {
      await supabaseAdmin
        .from("whatsapp_consent")
        .update({ verify_attempts: (row.verify_attempts ?? 0) + 1 })
        .eq("user_id", context.userId);
      throw new Error("That code doesn't match.");
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("whatsapp_consent")
      .update({
        verified_at: now,
        // Consent is only ever recorded after a successful verification.
        consented_at: now,
        consent_method: "in_app_checkbox_and_code",
        consent_source: "notification_preferences",
        consent_text_version: CONSENT_TEXT_VERSION,
        verification_code_hash: null,
        verification_expires_at: null,
        verify_attempts: 0,
      })
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Withdraws WhatsApp consent. Future deliveries are suppressed immediately. */
export const withdrawWhatsAppConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("whatsapp_consent")
      .update({
        opted_out_at: new Date().toISOString(),
        consented_at: null,
        verification_code_hash: null,
        verification_expires_at: null,
      })
      .eq("user_id", context.userId);
    await supabaseAdmin
      .from("notification_preferences")
      .update({ wa_booking: false, wa_message: false, wa_reminder: false, whatsapp_enabled: false })
      .eq("user_id", context.userId);
    return { ok: true };
  });
