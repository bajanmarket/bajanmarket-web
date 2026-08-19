import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/draftStore.server";
import { admin, assertAdmin } from "@/lib/draftStore.server";

const LeadInput = z.object({ prospectId: z.string().uuid() });

/** Admin: run (or re-run) Firecrawl acquisition for one lead. */
export const scanLeadContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => LeadInput.extend({ force: z.boolean().default(true) }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: p, error } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (error) throw error;
    const { scanLeadWebSources } = await import("@/lib/contentSources.server");
    return await scanLeadWebSources(db, p, data.force);
  });

/** Admin: everything discovered for one lead, with signed image previews. */
export const getLeadContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => LeadInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const [{ data: sources }, { data: content }] = await Promise.all([
      db.from("lead_sources").select("*").eq("lead_id", data.prospectId).order("created_at"),
      db
        .from("discovered_content")
        .select("*")
        .eq("lead_id", data.prospectId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const { signMedia } = await import("@/lib/draftMedia.server");
    const signed = await signMedia(
      db,
      (content ?? []).map((c) => c.stored_image_url),
    );
    const { summariseLead } = await import("@/lib/contentSources.server");
    return {
      summary: await summariseLead(db, data.prospectId),
      sources: sources ?? [],
      content: (content ?? []).map((c) => ({
        ...c,
        preview_url: c.stored_image_url ? (signed.get(c.stored_image_url) ?? null) : c.original_image_url,
      })),
    };
  });

/** Admin: include/exclude a discovered item from the storefront preview. */
export const setContentIncluded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ contentId: z.string().uuid(), included: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { error } = await db
      .from("discovered_content")
      .update({
        included: data.included,
        merchant_approval_status: data.included ? "pending" : "rejected",
      })
      .eq("id", data.contentId);
    if (error) throw error;
    return { ok: true as const };
  });

/** Admin: add a source URL by hand when discovery missed it. */
export const addLeadSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    LeadInput.extend({ url: z.string().url().max(500) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { platformFor, typeFor } = await import("@/lib/contentSources.server");
    const { error } = await db.from("lead_sources").upsert(
      {
        lead_id: data.prospectId,
        source_url: data.url,
        source_type: typeFor(data.url),
        source_platform: platformFor(data.url),
      },
      { onConflict: "lead_id,source_url", ignoreDuplicates: true },
    );
    if (error) throw error;
    return { ok: true as const };
  });
