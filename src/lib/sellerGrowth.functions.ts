import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/sellerGrowth.server";
import {
  admin,
  assertAdmin,
  audit,
  buildDraftBody,
  deliverOutreach,

  computeScore,
  evaluateSendGuards,
  findDuplicates,
  generateScanCandidates,

  getSettings,
  verifyProspect,
} from "@/lib/sellerGrowth.server";

const StageEnum = z.enum([
  "discovered", "verification_required", "qualified", "ready_for_outreach", "awaiting_approval",
  "contacted", "replied", "demo_scheduled", "onboarding", "trial_active", "activated_seller",
  "declined", "suppressed",
]);
const ChannelEnum = z.enum(["email", "whatsapp", "facebook", "instagram", "phone", "in_person", "other"]);
const ModeEnum = z.enum(["demo", "simulation", "live"]);

export const upsertProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      record_mode: ModeEnum.optional(),
      business_name: z.string().min(2).max(200),
      contact_name: z.string().max(120).nullable().optional(),
      seller_type: z.string().max(60).nullable().optional(),
      marketplace_category: z.string().max(60).nullable().optional(),
      parish: z.string().max(60).nullable().optional(),
      website_url: z.string().max(400).nullable().optional(),
      facebook_url: z.string().max(400).nullable().optional(),
      instagram_url: z.string().max(400).nullable().optional(),
      other_source_url: z.string().max(400).nullable().optional(),
      public_phone: z.string().max(60).nullable().optional(),
      public_whatsapp: z.string().max(60).nullable().optional(),
      public_email: z.string().max(200).nullable().optional(),
      visible_product_count: z.number().int().min(0).nullable().optional(),
      estimated_potential_listings: z.number().int().min(0).nullable().optional(),
      posting_frequency: z.string().max(60).nullable().optional(),
      facebook_group_activity: z.string().max(120).nullable().optional(),
      audience_estimate: z.number().int().min(0).nullable().optional(),
      delivery_available: z.boolean().nullable().optional(),
      has_existing_website: z.boolean().nullable().optional(),
      bajanmarket_account_status: z.string().max(40).optional(),
      preferred_channel: ChannelEnum.nullable().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      notes: z.string().max(4000).nullable().optional(),
      source_url: z.string().max(400).nullable().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { id, source_url, ...fields } = data;
    if (id) {
      const { error } = await db.from("seller_prospects").update(fields as never).eq("id", id);
      if (error) throw error;
      await audit(db, context.userId, "prospect.updated", "seller_prospects", id, {});
      return { id };
    }
    const dupes = await findDuplicates(db, fields as never);
    const { data: created, error } = await db
      .from("seller_prospects")
      .insert({
        ...(fields as Record<string, unknown>),
        record_mode: data.record_mode ?? "simulation",
        created_by: context.userId,
        verification_status: dupes.length ? "duplicate_suspected" : "unverified",
        pipeline_stage: dupes.length ? "verification_required" : "discovered",
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    await db.from("seller_pipeline_history").insert({
      prospect_id: created.id,
      to_stage: dupes.length ? "verification_required" : "discovered",
      changed_by: context.userId,
      reason: dupes.length ? `Possible duplicate of ${dupes.map((d) => d.business_name).join(", ")}` : "Created manually",
    });
    if (source_url) {
      await db.from("seller_prospect_sources").insert({
        prospect_id: created.id,
        claim: "Prospect record created from this public source",
        source_url,
        source_type: "manual",
        researched_by: context.userId,
      });
    }
    await audit(db, context.userId, "prospect.created", "seller_prospects", created.id, { duplicates: dupes.length });
    return { id: created.id, duplicates: dupes };
  });

export const runVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ prospectId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: p, error } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (error) throw error;
    const result = await verifyProspect(db, p);
    const status = result.duplicates.length
      ? "duplicate_suspected"
      : result.passed
        ? "verified"
        : result.checks.some((c) => c.status === "fail")
          ? "rejected"
          : "needs_review";
    await db.from("seller_prospects").update({ verification_status: status }).eq("id", p.id);
    await audit(db, context.userId, "prospect.verified", "seller_prospects", p.id, { status });
    return { status, ...result };
  });

export const scoreProspect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ prospectId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: p, error } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (error) throw error;
    const r = await computeScore(db, p);
    await db.from("seller_prospect_scores").insert({
      prospect_id: p.id,
      total_score: r.score,
      breakdown: r.breakdown as never,
      missing_evidence: r.missing,
      recommended_priority: r.priority,
      recommended_channel: r.channel as never,
      explanation: r.explanation,
      computed_by: context.userId,
    });
    await db.from("seller_prospects").update({ lead_score: r.score, priority: r.priority }).eq("id", p.id);
    await audit(db, context.userId, "prospect.scored", "seller_prospects", p.id, { score: r.score });
    return r;
  });

export const moveStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ prospectId: z.string().uuid(), stage: StageEnum, reason: z.string().max(500).optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: p, error } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (error) throw error;
    if (data.stage === "activated_seller") {
      const { data: session } = await db
        .from("seller_onboarding_sessions")
        .select("id, seller_user_id")
        .eq("prospect_id", p.id)
        .maybeSingle();
      if (!session?.seller_user_id) {
        return { ok: false as const, error: "Cannot activate: no linked seller account yet" };
      }
      const { count } = await db
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", session.seller_user_id)
        .eq("status", "active");
      if (!count) {
        return { ok: false as const, error: "Cannot activate: the seller has no active listing yet" };
      }
    }

    await db.from("seller_prospects").update({ pipeline_stage: data.stage }).eq("id", p.id);
    await db.from("seller_pipeline_history").insert({
      prospect_id: p.id,
      from_stage: p.pipeline_stage,
      to_stage: data.stage,
      changed_by: context.userId,
      reason: data.reason ?? null,
    });
    await audit(db, context.userId, "prospect.stage_changed", "seller_prospects", p.id, { to: data.stage });
    return { ok: true as const };
  });

export const runOpportunityScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      category: z.string().max(60).optional(),
      sellerType: z.string().max(60).optional(),
      parish: z.string().max(60).optional(),
      minActivity: z.string().max(40).optional(),
      minInventory: z.number().int().min(0).max(10000).optional(),
      sources: z.array(z.string().max(80)).max(10).default([]),
      maxProspects: z.number().int().min(1).max(50).default(10),
      liveResearch: z.boolean().default(false),
      seedUrls: z.array(z.string().max(400)).max(50).default([]),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const mode = (data.liveResearch ? "live" : "simulation") as "live" | "simulation";

    // Step 1 — AI proposes candidate businesses from public knowledge. Nothing is
    // treated as verified: every candidate lands in verification_required.
    const { candidates, note } = await generateScanCandidates({
      category: data.category,
      sellerType: data.sellerType,
      parish: data.parish,
      minActivity: data.minActivity,
      minInventory: data.minInventory,
      seedUrls: data.seedUrls,
      max: data.maxProspects,
    });

    let prospectsCreated = 0;
    let duplicatesSkipped = 0;
    const created: { id: string; business_name: string }[] = [];
    for (const c of candidates) {
      const { source_url, ...fields } = c;
      const dupes = await findDuplicates(db, fields as never);
      if (dupes.length) {
        duplicatesSkipped += 1;
        continue;
      }
      const { data: row, error: insErr } = await db
        .from("seller_prospects")
        .insert({
          ...(fields as Record<string, unknown>),
          record_mode: mode,
          created_by: context.userId,
          verification_status: "needs_review",
          pipeline_stage: "verification_required",
        } as never)
        .select("id, business_name")
        .single();
      if (insErr || !row) continue;
      prospectsCreated += 1;
      created.push(row);
      await db.from("seller_pipeline_history").insert({
        prospect_id: row.id,
        to_stage: "verification_required",
        changed_by: context.userId,
        reason: "Discovered by the Opportunity Scanner — needs human verification",
      });
      if (source_url) {
        await db.from("seller_prospect_sources").insert({
          prospect_id: row.id,
          claim: "Candidate surfaced by the Opportunity Scanner from this public source",
          source_url,
          source_type: "scanner",
          researched_by: context.userId,
        });
      }
    }

    // Step 2 — always leave structured manual research tasks so a human can
    // confirm or expand on what the scanner surfaced.
    const targets = data.seedUrls.length ? data.seedUrls : data.sources.length ? data.sources : ["manual research"];
    const rows = targets.slice(0, data.maxProspects).map((t, i) => ({
      record_mode: mode,
      title: `Research ${data.sellerType ?? "seller"} ${i + 1} — ${t}`,
      instructions: [
        `Category: ${data.category ?? "any"}`,
        `Seller type: ${data.sellerType ?? "any"}`,
        `Parish: ${data.parish ?? "any"}`,
        `Minimum activity: ${data.minActivity ?? "any"}`,
        `Minimum inventory: ${data.minInventory ?? "any"}`,
        "Only use publicly listed business information. Leave unknown fields blank.",
      ].join("\n"),
      category: data.category ?? null,
      seller_type: data.sellerType ?? null,
      parish: data.parish ?? null,
      source_hint: t,
      created_by: context.userId,
    }));
    const { data: tasks } = await db.from("seller_research_tasks").insert(rows as never).select("id");
    await audit(db, context.userId, "scanner.run", "seller_prospects", null, {
      tasks: tasks?.length ?? 0,
      prospects: prospectsCreated,
      duplicates: duplicatesSkipped,
      live: data.liveResearch,
    });
    return {
      tasksCreated: tasks?.length ?? 0,
      prospectsCreated,
      duplicatesSkipped,
      created,
      note: note ?? null,
    };
  });


export const generateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      prospectId: z.string().uuid(),
      playbookId: z.string().uuid(),
      step: z.enum(["initial", "followup_1", "followup_final"]).default("initial"),
      channel: ChannelEnum.optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: p, error } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (error) throw error;
    if (p.opted_out || p.pipeline_stage === "suppressed") throw new Error("Prospect is suppressed or opted out");
    const { data: pb, error: pbErr } = await db.from("seller_outreach_playbooks").select("*").eq("id", data.playbookId).single();
    if (pbErr) throw pbErr;
    const { body, warnings } = buildDraftBody(pb, p, data.step);
    const { data: draft, error: dErr } = await db
      .from("seller_outreach_drafts")
      .insert({
        record_mode: p.record_mode,
        prospect_id: p.id,
        playbook_id: pb.id,
        sequence_step: data.step,
        channel: (data.channel ?? pb.recommended_channel) as never,
        subject: data.step === "initial" ? `BajanMarket — seller profile for ${p.business_name}` : `Following up — BajanMarket`,
        body,
        risk_warnings: warnings,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (dErr) throw dErr;
    await audit(db, context.userId, "draft.created", "seller_outreach_drafts", draft.id, {});
    return draft;
  });

export const submitForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ draftId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: draft, error } = await db.from("seller_outreach_drafts").select("*").eq("id", data.draftId).single();
    if (error) throw error;
    const { data: p } = await db.from("seller_prospects").select("*").eq("id", draft.prospect_id).single();
    if (!p) throw new Error("Prospect not found");
    const verification = await verifyProspect(db, p);
    const score = await computeScore(db, p);
    const { data: req, error: rErr } = await db
      .from("seller_approval_requests")
      .insert({
        record_mode: p.record_mode,
        prospect_id: p.id,
        draft_id: draft.id,
        request_type: draft.sequence_step === "initial" ? "first_contact" : "followup",
        summary: {
          business_name: p.business_name,
          channel: draft.channel,
          subject: draft.subject,
          body: draft.body,
          lead_score: score.score,
        } as never,
        verification_result: verification as never,
        duplicate_result: { matches: verification.duplicates } as never,
        risk_warnings: draft.risk_warnings,
        recommended_action: verification.passed ? "Approve and send" : "Resolve verification issues first",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (rErr) throw rErr;
    await db.from("seller_outreach_drafts").update({ status: "awaiting_approval" }).eq("id", draft.id);
    await db.from("seller_prospects").update({ pipeline_stage: "awaiting_approval" }).eq("id", p.id);
    await db.from("seller_pipeline_history").insert({
      prospect_id: p.id,
      from_stage: p.pipeline_stage,
      to_stage: "awaiting_approval",
      changed_by: context.userId,
      reason: "Outreach submitted for approval",
      approval_request_id: req.id,
    });
    await audit(db, context.userId, "approval.requested", "seller_approval_requests", req.id, {});
    return { id: req.id };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      requestId: z.string().uuid(),
      decision: z.enum(["approved", "edited_approved", "rejected", "archived"]),
      editedBody: z.string().max(5000).optional(),
      note: z.string().max(500).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: req, error } = await db.from("seller_approval_requests").select("*").eq("id", data.requestId).single();
    if (error) throw error;
    if (data.editedBody && req.draft_id) {
      await db.from("seller_outreach_drafts").update({ body: data.editedBody }).eq("id", req.draft_id);
    }
    await db
      .from("seller_approval_requests")
      .update({
        status: data.decision,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.requestId);
    if (req.draft_id) {
      await db
        .from("seller_outreach_drafts")
        .update({ status: data.decision.includes("approved") ? "approved" : data.decision })
        .eq("id", req.draft_id);
    }
    if (data.decision === "rejected" || data.decision === "archived") {
      await db.from("seller_prospects").update({ pipeline_stage: "qualified" }).eq("id", req.prospect_id);
    }
    await audit(db, context.userId, `approval.${data.decision}`, "seller_approval_requests", req.id, {});
    return { ok: true };
  });

export const sendApprovedOutreach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ requestId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: req, error } = await db.from("seller_approval_requests").select("*").eq("id", data.requestId).single();
    if (error) throw error;
    if (!req.status.includes("approved")) throw new Error("This outreach has not been approved");
    if (!req.draft_id) throw new Error("Approval request has no draft");
    const { data: draft } = await db.from("seller_outreach_drafts").select("*").eq("id", req.draft_id).single();
    const { data: p } = await db.from("seller_prospects").select("*").eq("id", req.prospect_id).single();
    if (!draft || !p) throw new Error("Draft or prospect missing");

    const settings = await getSettings(db);
    const contactFor = (ch: string) =>
      ch === "email" ? p.public_email : ch === "whatsapp" ? p.public_whatsapp : ch === "facebook" ? p.facebook_url : ch === "instagram" ? p.instagram_url : null;
    // Fall back to any deliverable contact the prospect actually has, so an
    // approved draft on a channel with no handle still reaches them.
    let sendChannel = draft.channel as string;
    let recipient = contactFor(sendChannel);

    if (!recipient) {
      for (const ch of ["email", "whatsapp"]) {
        const c = contactFor(ch);
        if (c) {
          sendChannel = ch;
          recipient = c;
          break;
        }
      }
    }

    const guard = await evaluateSendGuards(db, p, sendChannel as never);
    if (!guard.allowed) return { sent: false, simulated: guard.simulated, reasons: guard.reasons };

    if (!guard.simulated) {

      if (!recipient)
        return { sent: false, simulated: false, reasons: ["This prospect has no email or WhatsApp contact on record"] };
      // Autonomous mode: the admin approval on this request IS the gate.
      if (settings.allowlist_required) {
        const allow = settings.test_recipients.map((t) => t.toLowerCase());
        if (!allow.includes(String(recipient).toLowerCase()))
          return { sent: false, simulated: false, reasons: ["Recipient is not on the test-recipient allowlist"] };
      }
    }



    const idem = `${draft.id}:${draft.sequence_step}:${guard.simulated ? "sim" : "live"}`;
    const { data: existing } = await db
      .from("seller_outreach_messages")
      .select("id")
      .eq("idempotency_key", idem)
      .maybeSingle();
    if (existing) return { sent: false, simulated: guard.simulated, reasons: ["Duplicate message prevented"] };

    const { data: msg, error: mErr } = await db
      .from("seller_outreach_messages")
      .insert({
        record_mode: guard.simulated ? "simulation" : "live",
        prospect_id: p.id,
        draft_id: draft.id,
        approval_request_id: req.id,
        channel: sendChannel as never,
        sequence_step: draft.sequence_step,
        recipient: recipient ?? null,
        subject: draft.subject,
        body: draft.body,
        status: guard.simulated ? "simulated" : "queued",
        simulated: guard.simulated,
        idempotency_key: idem,
        sent_at: guard.simulated ? new Date().toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (mErr) throw mErr;

    let delivery: { ok: boolean; providerId?: string; error?: string } | null = null;
    if (!guard.simulated) {
      const d = await deliverOutreach({
        channel: sendChannel as never,
        recipient: String(recipient),
        subject: draft.subject,
        body: draft.body,
      });
      delivery = d;
      await db
        .from("seller_outreach_messages")
        .update({
          status: d.ok ? "sent" : "failed",
          provider_message_id: d.providerId ?? null,
          error: d.error ?? null,
          sent_at: d.ok ? new Date().toISOString() : null,
        })
        .eq("id", msg.id);
    }


    await db.from("seller_outreach_events").insert({
      message_id: msg.id,
      prospect_id: p.id,
      event_type: guard.simulated ? "simulated_send" : delivery?.ok ? "sent" : "failed",
      channel: sendChannel as never,
      detail: { guard_notes: guard.reasons, error: delivery?.error ?? null } as never,
    });
    if (delivery && !delivery.ok) {
      await audit(db, context.userId, "outreach.failed", "seller_outreach_messages", msg.id, { error: delivery.error });
      return { sent: false, simulated: false, reasons: [delivery.error ?? "Delivery failed"], messageId: msg.id };
    }

    await db.from("seller_prospects").update({ pipeline_stage: "contacted", last_contact_at: new Date().toISOString() }).eq("id", p.id);
    await db.from("seller_pipeline_history").insert({
      prospect_id: p.id,
      from_stage: p.pipeline_stage,
      to_stage: "contacted",
      changed_by: context.userId,
      reason: guard.simulated ? "Simulated outreach recorded" : "Live outreach sent",
      outreach_message_id: msg.id,
      approval_request_id: req.id,
    });

    const { data: pb } = draft.playbook_id
      ? await db.from("seller_outreach_playbooks").select("followup_interval_days").eq("id", draft.playbook_id).single()
      : { data: null };
    await db.from("seller_followup_tasks").insert({
      record_mode: guard.simulated ? "simulation" : "live",
      prospect_id: p.id,
      playbook_id: draft.playbook_id,
      sequence_step: draft.sequence_step === "initial" ? "followup_1" : "followup_final",
      channel: sendChannel as never,
      due_at: new Date(Date.now() + (pb?.followup_interval_days ?? 4) * 86400000).toISOString(),
      created_by: context.userId,
    });
    await audit(db, context.userId, "outreach.recorded", "seller_outreach_messages", msg.id, { simulated: guard.simulated });
    return { sent: true, simulated: guard.simulated, reasons: guard.reasons, messageId: msg.id };
  });

export const recordReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ prospectId: z.string().uuid(), note: z.string().max(1000).optional() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: p } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (!p) throw new Error("Prospect not found");
    await db
      .from("seller_followup_tasks")
      .update({ status: "cancelled", cancelled_reason: "Reply received" })
      .eq("prospect_id", p.id)
      .eq("status", "open");
    await db.from("seller_prospects").update({ pipeline_stage: "replied" }).eq("id", p.id);
    await db.from("seller_pipeline_history").insert({
      prospect_id: p.id,
      from_stage: p.pipeline_stage,
      to_stage: "replied",
      changed_by: context.userId,
      reason: data.note ?? "Reply received",
    });
    await db.from("seller_outreach_events").insert({
      prospect_id: p.id,
      event_type: "reply_received",
      detail: { note: data.note ?? null } as never,
    });
    await audit(db, context.userId, "outreach.reply", "seller_prospects", p.id, {});
    return { ok: true };
  });

export const addSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      prospectId: z.string().uuid().optional(),
      matchType: z.enum(["business_name", "phone", "email", "domain", "facebook", "instagram"]),
      matchValue: z.string().min(2).max(300),
      reason: z.string().min(2).max(300),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { error } = await db.from("seller_suppressions").insert({
      prospect_id: data.prospectId ?? null,
      match_type: data.matchType,
      match_value: data.matchValue,
      reason: data.reason,
      created_by: context.userId,
    });
    if (error) throw error;
    if (data.prospectId) {
      await db
        .from("seller_prospects")
        .update({ pipeline_stage: "suppressed", opted_out: true, suppression_reason: data.reason })
        .eq("id", data.prospectId);
      await db.from("seller_followup_tasks").update({ status: "cancelled", cancelled_reason: "Suppressed" })
        .eq("prospect_id", data.prospectId).eq("status", "open");
      await db.from("seller_pipeline_history").insert({
        prospect_id: data.prospectId,
        to_stage: "suppressed",
        changed_by: context.userId,
        reason: data.reason,
      });
    }
    await audit(db, context.userId, "suppression.added", "seller_suppressions", null, { type: data.matchType });
    return { ok: true };
  });

export const updateGrowthSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      simulation_mode: z.boolean().optional(),
      global_outreach_paused: z.boolean().optional(),
      live_sending_enabled: z.boolean().optional(),
      email_paused: z.boolean().optional(),
      whatsapp_paused: z.boolean().optional(),
      social_paused: z.boolean().optional(),
      daily_contact_limit: z.number().int().min(0).max(500).optional(),
      weekly_contact_limit: z.number().int().min(0).max(2000).optional(),
      business_hours_start: z.number().int().min(0).max(23).optional(),
      business_hours_end: z.number().int().min(1).max(24).optional(),
      max_contact_attempts: z.number().int().min(1).max(10).optional(),
      outreach_days: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])).max(7).optional(),
      test_recipients: z.array(z.string().max(200)).max(20).optional(),
      allowlist_required: z.boolean().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const current = await getSettings(db);
    const next = { ...data } as Record<string, unknown>;
    // In allowlist mode, live sending needs a validated test-recipient list.
    // In autonomous mode, admin approval of each draft is the gate instead.
    const allowlistRequired = data.allowlist_required ?? current.allowlist_required;
    const recipients = (data.test_recipients ?? current.test_recipients) as string[];
    if (data.live_sending_enabled && allowlistRequired && recipients.length === 0)
      throw new Error("Add at least one validated test recipient, or turn off the allowlist requirement");
    next['updated_by'] = context.userId;
    const { error } = await db.from("seller_growth_settings").update(next as never).eq("id", 1);
    if (error) throw error;
    await audit(db, context.userId, "settings.updated", "seller_growth_settings", null, data as never);
    return { ok: true };
  });


export const upsertScoringRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      id: z.string().uuid(),
      weight: z.number().int().min(0).max(100).optional(),
      max_points: z.number().int().min(0).max(100).optional(),
      active: z.boolean().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { id, ...patch } = data;
    const { error } = await db.from("seller_scoring_rules").update(patch as never).eq("id", id);
    if (error) throw error;
    await audit(db, context.userId, "scoring_rule.updated", "seller_scoring_rules", id, patch as never);
    return { ok: true };
  });

export const upsertPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      id: z.string().uuid(),
      value_proposition: z.string().max(1000).optional(),
      initial_template: z.string().max(4000).optional(),
      followup_1_template: z.string().max(4000).optional(),
      followup_final_template: z.string().max(4000).optional(),
      recommended_channel: ChannelEnum.optional(),
      followup_interval_days: z.number().int().min(1).max(60).optional(),
      max_attempts: z.number().int().min(1).max(10).optional(),
      onboarding_offer: z.string().max(1000).optional(),
      active: z.boolean().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { id, ...patch } = data;
    const { error } = await db.from("seller_outreach_playbooks").update({ ...patch, requires_approval: true } as never).eq("id", id);
    if (error) throw error;
    await audit(db, context.userId, "playbook.updated", "seller_outreach_playbooks", id, {});
    return { ok: true };
  });

export const createOnboardingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ prospectId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: p } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (!p) throw new Error("Prospect not found");
    const { data: existing } = await db
      .from("seller_onboarding_sessions")
      .select("id, invite_token")
      .eq("prospect_id", p.id)
      .maybeSingle();
    if (existing) return existing;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: session, error } = await db
      .from("seller_onboarding_sessions")
      .insert({
        record_mode: p.record_mode,
        prospect_id: p.id,
        invite_token: token,
        prefilled: {
          business_name: p.business_name,
          parish: p.parish,
          public_phone: p.public_phone,
          public_email: p.public_email,
          website_url: p.website_url,
        } as never,
        created_by: context.userId,
      })
      .select("id, invite_token")
      .single();
    if (error) throw error;
    await db.from("seller_prospects").update({ pipeline_stage: "onboarding" }).eq("id", p.id);
    await db.from("seller_pipeline_history").insert({
      prospect_id: p.id,
      from_stage: p.pipeline_stage,
      to_stage: "onboarding",
      changed_by: context.userId,
      reason: "Seller marked as interested — onboarding invitation created",
    });
    await audit(db, context.userId, "onboarding.invited", "seller_onboarding_sessions", session.id, {});
    return session;
  });

export const approveOnboardingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ itemId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: item } = await db.from("seller_onboarding_items").select("*").eq("id", data.itemId).single();
    if (!item) throw new Error("Item not found");
    const { data: session } = await db
      .from("seller_onboarding_sessions")
      .select("*")
      .eq("id", item.session_id)
      .single();
    if (!session?.content_permission_granted)
      throw new Error("The seller has not granted permission to use this content yet");
    const missing: string[] = [];
    if (!item.price) missing.push("price");
    if (!item.description) missing.push("description");
    if (!item.image_urls.length) missing.push("images");
    if (missing.length) throw new Error(`Cannot approve — missing ${missing.join(", ")}`);
    await db
      .from("seller_onboarding_items")
      .update({ status: "approved", approved_by: context.userId, approved_at: new Date().toISOString() })
      .eq("id", item.id);
    await audit(db, context.userId, "onboarding.item_approved", "seller_onboarding_items", item.id, {});
    return { ok: true };
  });
