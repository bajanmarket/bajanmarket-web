/**
 * Buyer Intent Score — pure, deterministic, database-free.
 *
 * Takes behavioural counts already available in BajanMarket (search_events,
 * buyer_activity_events, favourites, conversations) and returns a 0–100
 * estimate of how strongly this person appears to be trying to buy.
 *
 * Nothing here reads Supabase, calls an AI model, or touches the clock unless
 * the caller omits `now`.
 */
import { INTENT_RECENCY, INTENT_SIGNAL_WEIGHTS, type IntentSignal } from "./weights";
import type {
  BuyerIntentScoreResult,
  BuyerIntentSignals,
  IntentComponentResult,
} from "./types";

const MS_PER_DAY = 86_400_000;

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function clamp100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function safeCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/**
 * Exponential decay on time since the last relevant activity.
 * Activity inside `freshHours` decays not at all; after that strength halves
 * every `halfLifeDays`, floored at `minMultiplier` so a very strong historic
 * intent never vanishes entirely.
 *
 * One generic curve for every category by design — per-category half-lives
 * (vehicles slower, phones faster) belong in weights.ts once real data exists.
 */
export function recencyMultiplier(
  lastActivityAt: string | Date | null | undefined,
  now: string | Date | null | undefined = undefined,
): number {
  const last = toTime(lastActivityAt);
  if (last === null) return 1;
  const reference = toTime(now) ?? Date.now();
  const elapsedMs = reference - last;
  if (elapsedMs <= INTENT_RECENCY.freshHours * 3_600_000) return 1;
  const days = elapsedMs / MS_PER_DAY;
  const decayed = Math.pow(0.5, days / INTENT_RECENCY.halfLifeDays);
  return Math.max(INTENT_RECENCY.minMultiplier, Math.min(1, decayed));
}

const SIGNAL_FIELDS: Array<{ signal: IntentSignal; field: keyof BuyerIntentSignals }> = [
  { signal: "search", field: "search_count" },
  { signal: "recentSearch", field: "recent_search_count" },
  { signal: "listingView", field: "listing_view_count" },
  { signal: "favourite", field: "favourite_count" },
  { signal: "sellerContact", field: "seller_contact_count" },
];

export function calculateBuyerIntentScore(
  signals: BuyerIntentSignals = {},
): BuyerIntentScoreResult {
  const components: IntentComponentResult[] = [];
  let raw = 0;

  // `recent_search_count` is a SUBSET of `search_count`. Recent searches are
  // scored only in the higher-value `recentSearch` bucket; the base bucket
  // gets the remainder. Without this, one recent search would score twice and
  // could outrank a save, inverting the intended signal hierarchy.
  const totalSearches = safeCount(signals.search_count);
  const recentSearches = Math.min(safeCount(signals.recent_search_count), Math.max(totalSearches, safeCount(signals.recent_search_count)));
  const olderSearches = Math.max(0, totalSearches - recentSearches);
  const counts: Record<IntentSignal, number> = {
    search: olderSearches,
    recentSearch: recentSearches,
    listingView: safeCount(signals.listing_view_count),
    favourite: safeCount(signals.favourite_count),
    sellerContact: safeCount(signals.seller_contact_count),
  };

  for (const { signal } of SIGNAL_FIELDS) {
    const count = counts[signal];
    const config = INTENT_SIGNAL_WEIGHTS[signal];
    const uncapped = count * config.points;
    const points = Math.min(uncapped, config.cap);
    raw += points;
    components.push({
      signal,
      count,
      points,
      capped: uncapped > config.cap,
    });
  }

  const rawScore = clamp100(raw);
  const multiplier = recencyMultiplier(signals.last_activity_at, signals.now);
  const lastTime = toTime(signals.last_activity_at);
  const nowTime = toTime(signals.now) ?? Date.now();

  return {
    score: Math.round(clamp100(rawScore * multiplier)),
    raw_score: Math.round(rawScore),
    recency_multiplier: Number(multiplier.toFixed(4)),
    components,
    contributing_signals: components.filter((c) => c.points > 0).map((c) => c.signal),
    debug: {
      days_since_activity:
        lastTime === null ? null : Number(((nowTime - lastTime) / MS_PER_DAY).toFixed(3)),
      half_life_days: INTENT_RECENCY.halfLifeDays,
    },
  };
}
