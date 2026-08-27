/**
 * Phase 4 — silent buyer-intent capture logic.
 *
 * Pure orchestration over an injected `CaptureStore`, so the same code paths
 * are exercised by tests with an in-memory store and by the server functions
 * with Supabase. Nothing here imports the Supabase client, React or AI.
 *
 * Every entry point FAILS CLOSED and never throws: capture must never be able
 * to break search or a listing page.
 */
import { CAPTURE_CONFIG } from "./weights";
import { buildIntentKey, meaningfulTokens, normalizeText } from "./normalize";
import type { ListingCondition, Parish } from "./types";

export interface StoredIntent {
  id: string;
  intent_key: string;
  normalized_query: string;
  keywords: string[];
  raw_queries: string[];
  category_id: string | null;
  min_price: number | null;
  max_price: number | null;
  preferred_condition: ListingCondition | null;
  preferred_parish: Parish | null;
  signal_count: number;
  first_seen: string;
  last_seen: string;
  active: boolean;
}

export interface IntentInsert {
  user_id: string;
  intent_key: string;
  normalized_query: string;
  keywords: string[];
  raw_queries: string[];
  category_id: string | null;
  min_price: number | null;
  max_price: number | null;
  preferred_condition: ListingCondition | null;
  preferred_parish: Parish | null;
  signal_count: number;
  first_seen: string;
  last_seen: string;
  active: true;
}

export type IntentUpdate = Partial<
  Pick<
    StoredIntent,
    | "normalized_query"
    | "keywords"
    | "raw_queries"
    | "category_id"
    | "min_price"
    | "max_price"
    | "preferred_condition"
    | "preferred_parish"
    | "signal_count"
    | "last_seen"
    | "active"
  >
>;

export interface CaptureStore {
  /** Must resolve the capture feature flag. Rejecting = fail closed. */
  isCaptureEnabled(): Promise<boolean>;
  findIntent(userId: string, intentKey: string): Promise<StoredIntent | null>;
  insertIntent(row: IntentInsert): Promise<void>;
  updateIntent(id: string, patch: IntentUpdate): Promise<void>;
  /** Most recent listing_viewed event for this user+listing, if any. */
  findLastListingView(
    userId: string,
    listingId: string,
  ): Promise<{ occurred_at: string } | null>;
  insertListingView(row: {
    user_id: string;
    listing_id: string;
    category_id: string | null;
    occurred_at: string;
  }): Promise<void>;
}

export interface SearchIntentInput {
  userId: string | null;
  query: string;
  categoryId?: string | null;
  parish?: Parish | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  condition?: ListingCondition | null;
}

export type CaptureOutcome =
  | { captured: false; reason: "disabled" | "anonymous" | "empty" | "error" | "deduped" }
  | { captured: true; action: "created" | "merged" };

function nowIso(now?: string | Date): string {
  if (!now) return new Date().toISOString();
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Deterministic merge patch for an existing intent.
 *
 * Rule: a later search that OMITS a filter must never erase a preference the
 * buyer previously expressed. Only newly supplied values overwrite.
 */
export function buildIntentMergePatch(
  existing: StoredIntent,
  input: SearchIntentInput,
  at: string,
): IntentUpdate {
  const normalized = normalizeText(input.query);
  const keywords = meaningfulTokens(input.query);

  const rawQueries = existing.raw_queries.includes(input.query.trim())
    ? existing.raw_queries
    : [...existing.raw_queries, input.query.trim()].slice(-CAPTURE_CONFIG.maxRawQueriesPerIntent);

  const mergedKeywords = Array.from(new Set([...existing.keywords, ...keywords])).slice(
    0,
    CAPTURE_CONFIG.maxKeywordsPerIntent,
  );

  const patch: IntentUpdate = {
    last_seen: at,
    signal_count: (existing.signal_count ?? 0) + 1,
    active: true,
    raw_queries: rawQueries,
    keywords: mergedKeywords,
  };

  if (normalized && normalized !== existing.normalized_query) {
    patch.normalized_query = normalized;
  }
  if (input.categoryId && input.categoryId !== existing.category_id) {
    patch.category_id = input.categoryId;
  }
  const min = num(input.minPrice);
  if (min !== null && min !== existing.min_price) patch.min_price = min;
  const max = num(input.maxPrice);
  if (max !== null && max !== existing.max_price) patch.max_price = max;
  if (input.condition && input.condition !== existing.preferred_condition) {
    patch.preferred_condition = input.condition;
  }
  if (input.parish && input.parish !== existing.preferred_parish) {
    patch.preferred_parish = input.parish;
  }
  return patch;
}

/** Silent, fail-closed capture of a buyer's search as an intent. */
export async function captureSearchIntent(
  store: CaptureStore,
  input: SearchIntentInput,
  opts: { now?: string | Date } = {},
): Promise<CaptureOutcome> {
  try {
    if (!input.userId) return { captured: false, reason: "anonymous" };
    const normalized = normalizeText(input.query);
    if (!normalized) return { captured: false, reason: "empty" };

    let enabled = false;
    try {
      enabled = (await store.isCaptureEnabled()) === true;
    } catch {
      return { captured: false, reason: "error" };
    }
    if (!enabled) return { captured: false, reason: "disabled" };

    const at = nowIso(opts.now);
    const intentKey = buildIntentKey({
      categoryId: input.categoryId ?? null,
      query: input.query,
    });

    const existing = await store.findIntent(input.userId, intentKey);
    if (existing) {
      await store.updateIntent(existing.id, buildIntentMergePatch(existing, input, at));
      return { captured: true, action: "merged" };
    }

    await store.insertIntent({
      user_id: input.userId,
      intent_key: intentKey,
      normalized_query: normalized,
      keywords: meaningfulTokens(input.query),
      raw_queries: [input.query.trim()],
      category_id: input.categoryId ?? null,
      min_price: num(input.minPrice),
      max_price: num(input.maxPrice),
      preferred_condition: input.condition ?? null,
      preferred_parish: input.parish ?? null,
      signal_count: 1,
      first_seen: at,
      last_seen: at,
      active: true,
    });
    return { captured: true, action: "created" };
  } catch {
    return { captured: false, reason: "error" };
  }
}

/** Silent, fail-closed capture of an authenticated listing view. */
export async function captureListingView(
  store: CaptureStore,
  input: { userId: string | null; listingId: string; categoryId?: string | null },
  opts: { now?: string | Date } = {},
): Promise<CaptureOutcome> {
  try {
    if (!input.userId || !input.listingId) return { captured: false, reason: "anonymous" };

    let enabled = false;
    try {
      enabled = (await store.isCaptureEnabled()) === true;
    } catch {
      return { captured: false, reason: "error" };
    }
    if (!enabled) return { captured: false, reason: "disabled" };

    const at = nowIso(opts.now);
    const last = await store.findLastListingView(input.userId, input.listingId);
    if (last) {
      const elapsedMs = new Date(at).getTime() - new Date(last.occurred_at).getTime();
      if (
        Number.isFinite(elapsedMs) &&
        elapsedMs >= 0 &&
        elapsedMs < CAPTURE_CONFIG.listingViewDedupeMinutes * 60_000
      ) {
        return { captured: false, reason: "deduped" };
      }
    }

    await store.insertListingView({
      user_id: input.userId,
      listing_id: input.listingId,
      category_id: input.categoryId ?? null,
      occurred_at: at,
    });
    return { captured: true, action: "created" };
  } catch {
    return { captured: false, reason: "error" };
  }
}
