import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

/**
 * Owner-only WhatsApp status. Reports which secrets are present as booleans —
 * secret values are never returned to the browser.
 */
export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { REQUIRED_SECRETS, TEMPLATE_ENV, VERIFICATION_TEMPLATE_ENV } = await import("@/lib/whatsapp.server");

    const required = Object.fromEntries(REQUIRED_SECRETS.map((k) => [k, Boolean(process.env[k])]));
    const templates = Object.fromEntries(
      Object.entries(TEMPLATE_ENV).map(([event, env]) => [event, { env, configured: Boolean(process.env[env]) }]),
    );

    const { data: settings } = await supabaseAdmin
      .from("whatsapp_settings")
      .select("production_enabled, test_mode, updated_at")
      .eq("id", 1)
      .maybeSingle();

    const { data: numbers } = await supabaseAdmin
      .from("whatsapp_test_numbers")
      .select("id, phone, label, created_at")
      .order("created_at", { ascending: true });

    const { data: tests } = await supabaseAdmin
      .from("whatsapp_connection_tests")
      .select("ok, kind, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("notification_deliveries")
      .select("status, is_test")
      .eq("channel", "whatsapp")
      .gte("created_at", since)
      .limit(1000);

    const rows = recent ?? [];
    const sent = rows.filter((r) => r.status === "sent").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const suppressed = rows.filter((r) => r.status === "suppressed").length;

    const { count: webhookEvents } = await supabaseAdmin
      .from("whatsapp_webhook_events")
      .select("event_key", { count: "exact", head: true });

    return {
      required,
      credentialsComplete: Object.values(required).every(Boolean),
      templates,
      verificationTemplate: { env: VERIFICATION_TEMPLATE_ENV, configured: Boolean(process.env[VERIFICATION_TEMPLATE_ENV]) },
      templateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? "en",
      settings: {
        production_enabled: settings?.production_enabled ?? false,
        test_mode: settings?.test_mode ?? true,
        updated_at: settings?.updated_at ?? null,
      },
      testNumbers: numbers ?? [],
      lastSuccessfulTest: tests?.find((t) => t.ok) ?? null,
      lastFailedTest: tests?.find((t) => !t.ok) ?? null,
      metaVerified: Boolean(tests?.find((t) => t.ok && t.kind === "connection")),
      webhookVerified: (webhookEvents ?? 0) > 0,
      delivery: { sent, failed, suppressed, total: rows.length, testSends: rows.filter((r) => r.is_test).length },
    };
  });

export const updateWhatsAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ production_enabled: z.boolean().optional(), test_mode: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { missingSecrets } = await import("@/lib/whatsapp.server");

    // Production can only ever be turned on deliberately, and only once the
    // credentials and a verified Meta connection exist.
    if (data.production_enabled) {
      const missing = missingSecrets();
      if (missing.length) throw new Error(`Cannot enable production: missing ${missing.join(", ")}`);
      const { data: ok } = await supabaseAdmin
        .from("whatsapp_connection_tests")
        .select("id")
        .eq("ok", true)
        .eq("kind", "connection")
        .limit(1)
        .maybeSingle();
      if (!ok) throw new Error("Run a successful Meta connection test before enabling production.");
    }

    const { error } = await supabaseAdmin
      .from("whatsapp_settings")
      .update({
        ...(data.production_enabled === undefined ? {} : { production_enabled: data.production_enabled }),
        ...(data.test_mode === undefined ? {} : { test_mode: data.test_mode }),
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addWhatsAppTestNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().min(7).max(24), label: z.string().max(60).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalisePhone } = await import("@/lib/whatsapp.server");
    const phone = normalisePhone(data.phone);
    if (!phone) throw new Error("That number doesn't look valid.");
    const { error } = await supabaseAdmin
      .from("whatsapp_test_numbers")
      .upsert({ phone, label: data.label ?? null, added_by: context.userId }, { onConflict: "phone" });
    if (error) throw new Error(error.message);
    return { ok: true, phone };
  });

export const removeWhatsAppTestNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Removal takes effect immediately: the allowlist is read on every send.
    const { error } = await supabaseAdmin.from("whatsapp_test_numbers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Validates credentials against Meta. Sends nothing to anyone. */
export const runWhatsAppConnectionTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { testMetaConnection } = await import("@/lib/whatsapp.server");
    const r = await testMetaConnection();
    await supabaseAdmin.from("whatsapp_connection_tests").insert({
      ok: r.ok,
      kind: "connection",
      detail: r.detail.slice(0, 300),
      run_by: context.userId,
    });
    return r;
  });

/** Sends one clearly-labelled test template to an allowlisted number only. */
export const sendWhatsAppTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), event: z.string().max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWhatsAppTemplate, TEMPLATE_ENV } = await import("@/lib/whatsapp.server");
    if (!(data.event in TEMPLATE_ENV)) throw new Error("Unknown event");

    const { data: row } = await supabaseAdmin
      .from("whatsapp_test_numbers")
      .select("phone")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("That test number is no longer on the allowlist.");

    const r = await sendWhatsAppTemplate(row.phone, data.event as keyof typeof TEMPLATE_ENV, {
      reference: "TESTREF",
      serviceName: "Test service",
      date: "01 Jan 2026",
      time: "10:00",
      tzLabel: "AST (Barbados time)",
      link: "https://bajanmarket.app/bookings",
    });

    await supabaseAdmin.from("whatsapp_connection_tests").insert({
      ok: r.status === "sent",
      kind: "test_send",
      detail: (r.status === "sent" ? `Sent ${data.event}` : r.status === "failed" ? r.error : r.reason).slice(0, 300),
      run_by: context.userId,
    });
    return { status: r.status, detail: r.status === "sent" ? "Test message sent" : r.status === "failed" ? r.error : r.reason };
  });
