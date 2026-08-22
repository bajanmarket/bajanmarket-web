import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AnySupabase = {
  from: (t: string) => any;
};

async function assertAdmin(supabase: AnySupabase, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

async function audit(
  admin: any,
  entry: {
    actor_id: string;
    action: string;
    entity?: string;
    entity_id?: string | null;
    previous_value?: unknown;
    new_value?: unknown;
    reason?: string | null;
    readiness_snapshot?: unknown;
  },
) {
  await admin.from("payment_audit_log").insert({
    actor_id: entry.actor_id,
    action: entry.action,
    entity: entry.entity ?? null,
    entity_id: entry.entity_id ?? null,
    previous_value: (entry.previous_value ?? null) as never,
    new_value: (entry.new_value ?? null) as never,
    reason: entry.reason ?? null,
    readiness_snapshot: (entry.readiness_snapshot ?? null) as never,
  });
}

/** Everything the Payments admin panel needs in one call. */
export const getPaymentsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [flags, gateway, readiness, commissions, testers, accounts, txns, payouts, refunds, disputes, webhooks, auditLog] =
      await Promise.all([
        supabaseAdmin.from("platform_feature_flags").select("*").order("key"),
        supabaseAdmin.from("payment_gateway_configuration").select("*").limit(1).maybeSingle(),
        supabaseAdmin.from("payment_readiness_checks").select("*").order("sort_order"),
        supabaseAdmin.from("commission_rules").select("*").order("created_at", { ascending: false }),
        supabaseAdmin.from("payment_feature_testers").select("*").order("created_at", { ascending: false }),
        supabaseAdmin.from("seller_payment_accounts").select("*").order("updated_at", { ascending: false }).limit(100),
        supabaseAdmin.from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("seller_payouts").select("*").order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("payment_refunds").select("*").order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("payment_disputes").select("*").order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("payment_webhook_events").select("*").order("received_at", { ascending: false }).limit(50),
        supabaseAdmin.from("payment_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
      ]);

    return {
      flags: flags.data ?? [],
      gateway: gateway.data ?? null,
      readiness: readiness.data ?? [],
      commissions: commissions.data ?? [],
      testers: testers.data ?? [],
      accounts: accounts.data ?? [],
      transactions: txns.data ?? [],
      payouts: payouts.data ?? [],
      refunds: refunds.data ?? [],
      disputes: disputes.data ?? [],
      webhooks: webhooks.data ?? [],
      auditLog: auditLog.data ?? [],
    };
  });

/**
 * Toggle a platform flag. Turning marketplace payments ON requires every
 * required readiness check to be passed and the gateway to be live+verified.
 */
export const setPaymentFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        key: z.enum(["marketplace_payments_enabled", "marketplace_payments_announcement_enabled"]),
        enabled: z.boolean(),
        reason: z.string().max(500).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("platform_feature_flags")
      .select("*")
      .eq("key", data.key)
      .maybeSingle();

    const { data: readiness } = await supabaseAdmin.from("payment_readiness_checks").select("*");
    const blockers = (readiness ?? []).filter((r) => r.required && r.status !== "passed" && r.status !== "not_applicable");

    if (data.key === "marketplace_payments_enabled" && data.enabled) {
      const { data: gateway } = await supabaseAdmin
        .from("payment_gateway_configuration")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!gateway || gateway.environment !== "live" || !gateway.credentials_configured || !gateway.webhook_verified) {
        return {
          ok: false as const,
          error: "Gateway must be live, with credentials configured and webhook verified, before enabling payments.",
        };
      }
      if (blockers.length > 0) {
        return {
          ok: false as const,
          error: `${blockers.length} readiness requirement(s) still outstanding: ${blockers.map((b) => b.label).join(", ")}`,
        };
      }
    }


    const { error } = await supabaseAdmin
      .from("platform_feature_flags")
      .update({ enabled: data.enabled, updated_by: context.userId, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) return { ok: false as const, error: error.message };


    await audit(supabaseAdmin, {
      actor_id: context.userId,
      action: data.enabled ? "flag.enabled" : "flag.disabled",
      entity: "platform_feature_flags",
      entity_id: data.key,
      previous_value: { enabled: current?.enabled ?? null },
      new_value: { enabled: data.enabled },
      reason: data.reason ?? null,
      readiness_snapshot: readiness ?? [],
    });

    return { ok: true as const, error: null };

  });

/** Update gateway metadata. Secrets are never accepted or stored here. */
export const updateGatewayConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        provider: z.string().max(60).nullable().optional(),
        environment: z.enum(["unconfigured", "sandbox", "live"]).optional(),
        credentials_configured: z.boolean().optional(),
        webhook_secret_configured: z.boolean().optional(),
        webhook_endpoint_url: z.string().url().max(500).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("payment_gateway_configuration")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!current) throw new Error("Gateway configuration row is missing.");

    const patch = { ...data, updated_by: context.userId } as Record<string, unknown>;
    const { error } = await supabaseAdmin.from("payment_gateway_configuration").update(patch as never).eq("id", current.id);
    if (error) throw new Error(error.message);

    await audit(supabaseAdmin, {
      actor_id: context.userId,
      action: "gateway.updated",
      entity: "payment_gateway_configuration",
      entity_id: current.id,
      previous_value: current,
      new_value: patch,
    });
    return { ok: true };
  });

/** Read-only connection test against the configured adapter. Never moves money. */
export const testGatewayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getGatewayAdapter } = await import("@/lib/payments/gateway.server");

    const adapter = getGatewayAdapter();
    const result = await adapter.testConnection();

    const { data: current } = await supabaseAdmin
      .from("payment_gateway_configuration")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (current) {
      await supabaseAdmin
        .from("payment_gateway_configuration")
        .update({
          last_connection_test_at: new Date().toISOString(),
          last_connection_test_ok: result.ok,
          capabilities: (result.capabilities ?? {}) as never,
        })
        .eq("id", current.id);
    }

    await audit(supabaseAdmin, {
      actor_id: context.userId,
      action: "gateway.connection_tested",
      entity: "payment_gateway_configuration",
      entity_id: current?.id ?? null,
      new_value: { ok: result.ok, message: result.message },
    });

    return result;
  });

export const setReadinessCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        key: z.string().min(1).max(80),
        status: z.enum(["pending", "in_progress", "passed", "failed", "not_applicable"]),
        evidence_reference: z.string().max(500).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("payment_readiness_checks")
      .select("*")
      .eq("key", data.key)
      .maybeSingle();
    if (!current) throw new Error("Unknown readiness requirement.");

    const { error } = await supabaseAdmin
      .from("payment_readiness_checks")
      .update({
        status: data.status,
        evidence_reference: data.evidence_reference ?? current.evidence_reference,
        checked_by: context.userId,
        checked_at: new Date().toISOString(),
      })
      .eq("key", data.key);
    if (error) throw new Error(error.message);

    await audit(supabaseAdmin, {
      actor_id: context.userId,
      action: "readiness.updated",
      entity: "payment_readiness_checks",
      entity_id: data.key,
      previous_value: { status: current.status, evidence_reference: current.evidence_reference },
      new_value: { status: data.status, evidence_reference: data.evidence_reference ?? current.evidence_reference },
    });
    return { ok: true };
  });

export const saveCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        scope: z.enum(["default", "seller", "category"]),
        seller_id: z.string().uuid().nullable().optional(),
        category_id: z.string().uuid().nullable().optional(),
        percentage_bps: z.number().int().min(0).max(10000),
        fixed_fee_cents: z.number().int().min(0).max(10_000_000),
        active: z.boolean().optional(),
        effective_from: z.string().optional(),
        effective_to: z.string().nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      name: data.name,
      scope: data.scope,
      seller_id: data.scope === "seller" ? (data.seller_id ?? null) : null,
      category_id: data.scope === "category" ? (data.category_id ?? null) : null,
      percentage_bps: data.percentage_bps,
      fixed_fee_cents: data.fixed_fee_cents,
      active: data.active ?? true,
      effective_from: data.effective_from ?? new Date().toISOString(),
      effective_to: data.effective_to ?? null,
      created_by: context.userId,
      approved_by: context.userId,
    };

    if (data.id) {
      const { data: prev } = await supabaseAdmin.from("commission_rules").select("*").eq("id", data.id).maybeSingle();
      const { error } = await supabaseAdmin.from("commission_rules").update(row as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(supabaseAdmin, {
        actor_id: context.userId,
        action: "commission.updated",
        entity: "commission_rules",
        entity_id: data.id,
        previous_value: prev,
        new_value: row,
      });
      return { ok: true, id: data.id };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("commission_rules")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, {
      actor_id: context.userId,
      action: "commission.created",
      entity: "commission_rules",
      entity_id: inserted.id,
      new_value: row,
    });
    return { ok: true, id: inserted.id };
  });

export const setSellerPaymentAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        seller_id: z.string().uuid(),
        onboarding_status: z
          .enum(["not_started", "pending", "requirements_due", "restricted", "active", "rejected", "disabled"])
          .optional(),
        restriction_reason: z.string().max(500).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prev } = await supabaseAdmin
      .from("seller_payment_accounts")
      .select("*")
      .eq("seller_id", data.seller_id)
      .maybeSingle();

    const patch = {
      seller_id: data.seller_id,
      onboarding_status: data.onboarding_status ?? prev?.onboarding_status ?? "not_started",
      restriction_reason: data.restriction_reason ?? prev?.restriction_reason ?? null,
    };
    const { error } = await supabaseAdmin.from("seller_payment_accounts").upsert(patch as never, { onConflict: "seller_id" });
    if (error) throw new Error(error.message);

    await audit(supabaseAdmin, {
      actor_id: context.userId,
      action: "seller_account.updated",
      entity: "seller_payment_accounts",
      entity_id: data.seller_id,
      previous_value: prev,
      new_value: patch,
    });
    return { ok: true };
  });

export const setPaymentTester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ email: z.string().email(), add: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const target = data.email.trim().toLowerCase();
    let userId: string | null = null;
    for (let page = 1; page <= 25 && !userId; page += 1) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const match = list.users.find((u) => u.email?.toLowerCase() === target);
      if (match) userId = match.id;
      if (list.users.length < 200) break;
    }
    if (!userId) throw new Error(`No account found for ${data.email}.`);

    if (data.add) {
      const { error } = await supabaseAdmin
        .from("payment_feature_testers")
        .upsert({ user_id: userId, added_by: context.userId } as never, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("payment_feature_testers").delete().eq("user_id", userId);
      if (error) throw new Error(error.message);
    }

    await audit(supabaseAdmin, {
      actor_id: context.userId,
      action: data.add ? "tester.added" : "tester.removed",
      entity: "payment_feature_testers",
      entity_id: userId,
      new_value: { email: target },
    });
    return { ok: true };
  });
