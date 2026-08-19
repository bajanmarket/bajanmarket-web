import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Db } from "@/lib/draftStore.server";
import {
  admin,
  assertAdmin,
  categoryIdFor,
  claimAudit,
  draftStorefrontContent,
  findExistingBusiness,
  issueClaimToken,
  lookupToken,
  toParish,
  uniqueSlug,
} from "@/lib/draftStore.server";

const ACQ_STATUSES = [
  "discovered", "qualified", "draft_store_created", "preview_ready", "outreach_ready",
  "contacted", "preview_viewed", "claim_started", "claimed", "rejected", "duplicate", "archived",
] as const;

const TokenInput = z.object({ token: z.string().min(10).max(200) });

/* =============== Admin: draft store generation =============== */

export const generateDraftStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ prospectId: z.string().uuid(), regenerate: z.boolean().default(false) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();

    const { data: p, error } = await db.from("seller_prospects").select("*").eq("id", data.prospectId).single();
    if (error) throw error;

    // Zero-duplication: never auto-create a second storefront for a live business.
    const dupe = await findExistingBusiness(db, p);
    if (dupe) {
      await db
        .from("seller_prospects")
        .update({ acquisition_status: "duplicate", pipeline_stage: "verification_required" })
        .eq("id", p.id);
      await claimAudit(db, "duplicate_flagged", {
        prospectId: p.id,
        actorUserId: context.userId,
        detail: { business_id: dupe.business.id, matched_on: dupe.on },
      });
      return {
        ok: false as const,
        duplicate: { name: dupe.business.name, slug: dupe.business.slug, matchedOn: dupe.on },
        error: `A live storefront already matches this business on ${dupe.on}. Use the claim-existing-business route instead.`,
      };
    }

    const { data: existing } = await db.from("draft_stores").select("*").eq("prospect_id", p.id).maybeSingle();
    if (existing && !data.regenerate) return { ok: true as const, draftStoreId: existing.id, regenerated: false };

    // 1. Read the lead's own public pages first — real content beats anything drafted.
    const { discoverProspectMedia, ingestMedia } = await import("@/lib/draftMedia.server");
    const discovered = await discoverProspectMedia(p);
    const structured = discovered.posts.length ? await structureDiscoveredPosts(p, discovered.posts) : [];

    // 2. Only ask AI for storefront copy; items come from real posts when we found any.
    const drafted = await draftStorefrontContent(p);
    const slug = existing?.slug ?? (await uniqueSlug(db, p.business_name));

    const storeLogo =
      (discovered.profile_image_url ? await ingestMedia(db, discovered.profile_image_url, p.id) : null) ??
      discovered.profile_image_url ??
      p.profile_image_url;
    const storeCover =
      (discovered.cover_image_url ? await ingestMedia(db, discovered.cover_image_url, p.id) : null) ??
      discovered.cover_image_url ??
      p.cover_image_url;

    const payload = {
      prospect_id: p.id,
      business_name: p.business_name,
      slug,
      category: drafted.category ?? p.marketplace_category,
      tagline: drafted.tagline,
      description: drafted.description ?? p.business_description,
      logo_url: storeLogo,
      cover_url: storeCover,
      contact_email: p.public_email,
      contact_phone: p.public_phone,
      whatsapp: p.public_whatsapp,
      website: p.website_url,
      address: p.address,
      parish: p.parish,
      hours: p.opening_hours,
      social_links: {
        facebook: p.facebook_url,
        instagram: p.instagram_url,
        other: p.other_source_url,
      } as never,
      preview_status: "draft",
      created_by: context.userId,
    };

    let storeId = existing?.id ?? null;
    if (existing) {
      const { error: upErr } = await db.from("draft_stores").update(payload).eq("id", existing.id);
      if (upErr) throw upErr;
      await db.from("draft_listings").delete().eq("draft_store_id", existing.id).is("listing_id", null);
    } else {
      const { data: row, error: insErr } = await db.from("draft_stores").insert(payload).select("id").single();
      if (insErr) throw insErr;
      storeId = row.id;
    }

    let importedFromPosts = 0;

    // 3a. Real discovered posts → one draft listing each, atomically bound to its source post.
    for (const item of structured) {
      const source = discovered.posts[item.index];
      if (!source) continue;

      const storedPath = source.original_media_url
        ? await ingestMedia(db, source.original_media_url, p.id)
        : null;

      const { data: post } = await db
        .from("lead_social_posts")
        .insert({
          prospect_id: p.id,
          source_platform: source.source_platform ?? p.social_platform,
          source_url: source.source_url,
          caption: source.caption,
          image_url: source.original_media_url,
          stored_media_url: storedPath,
          media_status: storedPath ? "stored" : source.original_media_url ? "source_only" : "none",
          posted_at: source.posted_at,
          content_type: item.content_type,
          detected_title: item.title,
          detected_price: item.price,
          detected_currency: source.detected_currency,
          detected_category: item.category,
          description: item.description,
          import_status: "selected_for_preview",
        })
        .select("id")
        .single();

      await db.from("draft_listings").insert({
        draft_store_id: storeId!,
        social_post_id: post?.id ?? null,
        title: item.title,
        description: item.description,
        price: item.price,
        category: item.category,
        image_url: source.original_media_url,
        stored_media_url: storedPath,
        image_source: storedPath ? "stored" : source.original_media_url ? "original" : "placeholder",
        original_caption: source.caption,
        source_url: source.source_url,
        source_posted_at: source.posted_at,
        source_platform: source.source_platform ?? p.social_platform,
        content_type: item.content_type,
        status: "selected_for_preview",
      });
      importedFromPosts += 1;
    }

    // 3b. Nothing public could be read → fall back to drafted copy WITHOUT any image.
    if (importedFromPosts === 0) {
      for (const item of drafted.items) {
        const { data: post } = await db
          .from("lead_social_posts")
          .insert({
            prospect_id: p.id,
            source_platform: item.source_platform ?? p.social_platform,
            source_url: item.source_url,
            caption: item.caption,
            content_type: item.content_type,
            detected_title: item.title,
            detected_price: item.price,
            detected_category: item.category,
            description: item.description,
            cta: item.cta,
            availability: item.availability,
            media_status: "none",
            import_status: "selected_for_preview",
          })
          .select("id")
          .single();

        await db.from("draft_listings").insert({
          draft_store_id: storeId!,
          social_post_id: post?.id ?? null,
          title: item.title,
          description: item.description,
          price: item.price,
          category: item.category,
          image_url: null,
          image_source: "placeholder",
          source_url: item.source_url,
          source_platform: item.source_platform ?? p.social_platform,
          content_type: item.content_type,
          status: "selected_for_preview",
        });
      }
    }

    await db
      .from("seller_prospects")
      .update({ acquisition_status: "preview_ready", last_checked_at: new Date().toISOString() })
      .eq("id", p.id);
    await db.from("draft_stores").update({ preview_status: "preview_ready" }).eq("id", storeId!);

    await claimAudit(db, existing ? "draft_store_regenerated" : "draft_store_generated", {
      draftStoreId: storeId,
      prospectId: p.id,
      actorUserId: context.userId,
      detail: {
        imported_from_posts: importedFromPosts,
        pages_read: discovered.pagesRead,
        pages_failed: discovered.pagesFailed,
        note: drafted.note ?? null,
      },
    });

    return {
      ok: true as const,
      draftStoreId: storeId!,
      regenerated: Boolean(existing),
      items: importedFromPosts || drafted.items.length,
      importedFromPosts,
      pagesRead: discovered.pagesRead,
      note:
        importedFromPosts === 0
          ? discovered.pagesFailed > 0
            ? "No public pages could be read — listings have no images until the merchant adds them."
            : (drafted.note ?? "No public posts found — listings have no images yet.")
          : (drafted.note ?? null),
    };
  });

export const listDraftStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: stores } = await db
      .from("draft_stores")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    const ids = (stores ?? []).map((s) => s.id);
    const { data: items } = ids.length
      ? await db.from("draft_listings").select("id, draft_store_id, title, price, status").in("draft_store_id", ids)
      : { data: [] as { id: string; draft_store_id: string; title: string; price: number | null; status: string }[] };
    const { data: tokens } = ids.length
      ? await db
          .from("store_claim_tokens")
          .select("id, draft_store_id, expires_at, revoked_at, view_count, first_viewed_at, claimed_at")
          .in("draft_store_id", ids)
      : { data: [] as never[] };
    const prospectIds = (stores ?? []).map((s) => s.prospect_id);
    const { data: prospects } = prospectIds.length
      ? await db
          .from("seller_prospects")
          .select("id, business_name, lead_score, acquisition_status, pipeline_stage, seller_type, parish, public_email, public_whatsapp, facebook_url, instagram_url")
          .in("id", prospectIds)
      : { data: [] as never[] };

    return {
      stores: stores ?? [],
      items: items ?? [],
      tokens: tokens ?? [],
      prospects: prospects ?? [],
    };
  });

export const issueClaimLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ draftStoreId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const token = await issueClaimToken(db, data.draftStoreId, context.userId);
    await claimAudit(db, "claim_token_issued", { draftStoreId: data.draftStoreId, actorUserId: context.userId });
    return { url: `https://bajanmarket.app/preview-store/${token}`, token };
  });

export const revokeClaimLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ draftStoreId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    await db
      .from("store_claim_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("draft_store_id", data.draftStoreId)
      .is("revoked_at", null);
    await claimAudit(db, "claim_token_revoked", { draftStoreId: data.draftStoreId, actorUserId: context.userId });
    return { ok: true as const };
  });

export const setAcquisitionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ prospectId: z.string().uuid(), status: z.enum(ACQ_STATUSES) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    await db.from("seller_prospects").update({ acquisition_status: data.status }).eq("id", data.prospectId);
    await claimAudit(db, `lead_status_${data.status}`, { prospectId: data.prospectId, actorUserId: context.userId });
    return { ok: true as const };
  });

export const listStoreAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ draftStoreId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as unknown as Db, context.userId);
    const db = await admin();
    const { data: rows } = await db
      .from("store_claim_audit")
      .select("event, created_at, detail")
      .eq("draft_store_id", data.draftStoreId)
      .order("created_at", { ascending: false })
      .limit(100);
    return rows ?? [];
  });

/* =============== Public: secure storefront preview =============== */

export const getStorePreview = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => TokenInput.parse(raw))
  .handler(async ({ data }) => {
    const db = await admin();
    const found = await lookupToken(db, data.token);
    if (!found.ok) return { ok: false as const, error: found.reason };
    const { store, token } = found;

    const { data: items } = await db
      .from("draft_listings")
      .select("id, title, description, price, currency, category, image_url, content_type, source_url, source_platform, status")
      .eq("draft_store_id", store.id)
      .neq("status", "rejected")
      .order("created_at");

    const now = new Date().toISOString();
    await db
      .from("store_claim_tokens")
      .update({
        view_count: token.view_count + 1,
        first_viewed_at: token.first_viewed_at ?? now,
        last_viewed_at: now,
      })
      .eq("id", token.id);
    if (!token.first_viewed_at) {
      await db.from("seller_prospects").update({ acquisition_status: "preview_viewed" }).eq("id", store.prospect_id);
      await claimAudit(db, "preview_opened", { draftStoreId: store.id, prospectId: store.prospect_id });
    }

    return {
      ok: true as const,
      store: {
        business_name: store.business_name,
        slug: store.slug,
        tagline: store.tagline,
        description: store.description,
        category: store.category,
        logo_url: store.logo_url,
        cover_url: store.cover_url,
        parish: store.parish,
        address: store.address,
        contact_email: store.contact_email,
        contact_phone: store.contact_phone,
        whatsapp: store.whatsapp,
        website: store.website,
        hours: store.hours,
        social_links: store.social_links,
        claim_status: store.claim_status,
      },
      items: items ?? [],
    };
  });

/* =============== Claim flow (authenticated) =============== */

export const startClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TokenInput.parse(raw))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const found = await lookupToken(db, data.token);
    if (!found.ok) return { ok: false as const, error: found.reason };
    const { store, token } = found;
    if (store.claimed_by_user_id && store.claimed_by_user_id !== context.userId)
      return { ok: false as const, error: "This storefront has already been claimed by another account." };

    if (!store.claimed_by_user_id) {
      await db
        .from("draft_stores")
        .update({ claimed_by_user_id: context.userId, claim_status: "claim_started" })
        .eq("id", store.id);
      await db.from("store_claim_tokens").update({ claimed_by_user_id: context.userId }).eq("id", token.id);
      await db.from("seller_prospects").update({ acquisition_status: "claim_started" }).eq("id", store.prospect_id);
      await claimAudit(db, "claim_started", {
        draftStoreId: store.id,
        prospectId: store.prospect_id,
        actorUserId: context.userId,
      });
    }
    return { ok: true as const };
  });

export const getClaimWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => TokenInput.parse(raw))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const found = await lookupToken(db, data.token);
    if (!found.ok) return { ok: false as const, error: found.reason };
    const { store } = found;
    if (store.claimed_by_user_id && store.claimed_by_user_id !== context.userId)
      return { ok: false as const, error: "This storefront has already been claimed by another account." };

    const { data: items } = await db
      .from("draft_listings")
      .select("*")
      .eq("draft_store_id", store.id)
      .order("created_at");

    return {
      ok: true as const,
      store: {
        id: store.id,
        business_name: store.business_name,
        slug: store.slug,
        tagline: store.tagline,
        description: store.description,
        category: store.category,
        logo_url: store.logo_url,
        cover_url: store.cover_url,
        parish: store.parish,
        address: store.address,
        contact_email: store.contact_email,
        contact_phone: store.contact_phone,
        whatsapp: store.whatsapp,
        website: store.website,
        claim_status: store.claim_status,
        verification_status: store.verification_status,
        verification_method: store.verification_method,
        business_id: store.business_id,
      },
      items: items ?? [],
    };
  });

export const submitOwnershipVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    TokenInput.extend({
      method: z.enum(["business_email", "business_phone", "existing_account", "manual_review"]),
      note: z.string().max(500).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const found = await lookupToken(db, data.token);
    if (!found.ok) return { ok: false as const, error: found.reason };
    const { store } = found;
    if (store.claimed_by_user_id !== context.userId)
      return { ok: false as const, error: "Start the claim before verifying ownership." };

    const email = (context.claims as { email?: string } | undefined)?.email?.toLowerCase() ?? "";
    let status = "review_required";

    if (data.method === "business_email" && store.contact_email && email && store.contact_email.toLowerCase() === email) {
      status = "verified";
    } else if (data.method === "existing_account") {
      const { data: biz } = await db.from("businesses").select("id").eq("owner_id", context.userId).maybeSingle();
      if (biz) status = "verified";
    }

    await db
      .from("draft_stores")
      .update({
        verification_status: status,
        verification_method: data.method,
        verification_note: data.note ?? null,
      })
      .eq("id", store.id);

    await claimAudit(db, status === "verified" ? "ownership_verified" : "ownership_review_required", {
      draftStoreId: store.id,
      prospectId: store.prospect_id,
      actorUserId: context.userId,
      detail: { method: data.method },
    });

    return { ok: true as const, status };
  });

export const updateClaimItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    TokenInput.extend({
      itemId: z.string().uuid(),
      title: z.string().min(2).max(120).optional(),
      description: z.string().max(4000).nullable().optional(),
      price: z.number().min(0).max(10000000).nullable().optional(),
      category: z.string().max(60).nullable().optional(),
      decision: z.enum(["merchant_approved", "rejected", "selected_for_preview"]).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const found = await lookupToken(db, data.token);
    if (!found.ok) return { ok: false as const, error: found.reason };
    const { store } = found;
    if (store.claimed_by_user_id !== context.userId)
      return { ok: false as const, error: "You cannot edit this storefront." };

    const { token: _t, itemId, decision, ...fields } = data;
    const patch: Record<string, unknown> = { ...fields };
    if (decision) patch['status'] = decision;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await db.from("draft_listings").update(patch as never).eq("id", itemId).eq("draft_store_id", store.id);
    if (error) throw error;
    if (decision) {
      await claimAudit(db, decision === "rejected" ? "content_rejected" : "content_approved", {
        draftStoreId: store.id,
        prospectId: store.prospect_id,
        actorUserId: context.userId,
        detail: { item: itemId },
      });
    }
    return { ok: true as const };
  });

/**
 * "Approve social feed": converts the prepared draft into the merchant's real
 * storefront. Only items the merchant approved are published, and nothing is
 * published without an explicit price.
 */
export const approveSocialFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    TokenInput.extend({ approvedIds: z.array(z.string().uuid()).max(200).default([]) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const found = await lookupToken(db, data.token);
    if (!found.ok) return { ok: false as const, error: found.reason };
    const { store, token } = found;
    if (store.claimed_by_user_id !== context.userId)
      return { ok: false as const, error: "Start the claim before publishing." };

    // Guard against a second storefront for the same owner.
    const { data: mine } = await db.from("businesses").select("*").eq("owner_id", context.userId).maybeSingle();

    const bizPayload = {
      name: store.business_name,
      slug: mine?.slug ?? (await uniqueSlug(db, store.slug)),
      tagline: store.tagline,
      description: store.description,
      contact_email: store.contact_email,
      contact_phone: store.contact_phone,
      whatsapp: store.whatsapp,
      website: store.website,
      address: store.address,
      parish: store.parish,
      logo_url: store.logo_url,
      banner_url: store.cover_url,
      hours: store.hours,
    };

    let businessId = mine?.id ?? null;
    let slug = mine?.slug ?? bizPayload.slug;
    if (mine) {
      const patch = Object.fromEntries(
        Object.entries(bizPayload).filter(([k, v]) => v !== null && v !== undefined && k !== "slug"),
      );
      await db.from("businesses").update(patch as never).eq("id", mine.id);
    } else {
      const { data: created, error: bizErr } = await db
        .from("businesses")
        .insert({ ...bizPayload, owner_id: context.userId, status: "pending" })
        .select("id, slug")
        .single();
      if (bizErr) throw bizErr;
      businessId = created.id;
      slug = created.slug;
    }

    // Approved items become real listings; unpriced ones stay approved but unpublished.
    const { data: items } = await db.from("draft_listings").select("*").eq("draft_store_id", store.id);
    const approved = (items ?? []).filter((i) => data.approvedIds.includes(i.id));
    const rejected = (items ?? []).filter((i) => !data.approvedIds.includes(i.id));
    const parish = toParish(store.parish) ?? "saint_michael";

    let published = 0;
    const needsPrice: string[] = [];
    for (const item of approved) {
      if (item.listing_id) continue;
      if (item.price === null || item.price === undefined) {
        needsPrice.push(item.title);
        await db.from("draft_listings").update({ status: "merchant_approved" }).eq("id", item.id);
        continue;
      }
      const categoryId = await categoryIdFor(db, item.category ?? store.category);
      const { data: listing, error: lErr } = await db
        .from("listings")
        .insert({
          seller_id: context.userId,
          category_id: categoryId!,
          title: item.title.slice(0, 120),
          description: (item.description ?? item.title).slice(0, 4000),
          price: item.price,
          currency: item.currency ?? "BBD",
          parish,
          condition: "new",
          cover_image_url: item.image_url,
          status: "active",
        })
        .select("id")
        .single();
      if (lErr) continue;
      published += 1;
      await db.from("draft_listings").update({ status: "published", listing_id: listing.id }).eq("id", item.id);
      if (item.social_post_id)
        await db.from("lead_social_posts").update({ import_status: "published" }).eq("id", item.social_post_id);
    }

    for (const item of rejected) {
      if (item.status === "published") continue;
      await db.from("draft_listings").update({ status: "rejected" }).eq("id", item.id);
      if (item.social_post_id)
        await db.from("lead_social_posts").update({ import_status: "rejected" }).eq("id", item.social_post_id);
    }

    const now = new Date().toISOString();
    await db
      .from("draft_stores")
      .update({ claim_status: "claimed", business_id: businessId, claimed_at: now, published_at: now, slug })
      .eq("id", store.id);
    await db.from("store_claim_tokens").update({ claimed_at: now, claimed_by_user_id: context.userId }).eq("id", token.id);
    await db
      .from("seller_prospects")
      .update({ acquisition_status: "claimed", pipeline_stage: "onboarding" })
      .eq("id", store.prospect_id);
    await claimAudit(db, "storefront_claimed", {
      draftStoreId: store.id,
      prospectId: store.prospect_id,
      actorUserId: context.userId,
      detail: { business_id: businessId, published, skipped_no_price: needsPrice.length },
    });

    return { ok: true as const, slug, published, needsPrice, businessId };
  });
