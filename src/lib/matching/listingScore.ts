/**
 * Listing Match Score — pure, deterministic, database-free.
 *
 * calculateListingMatch(intent, listing) scores how well one listing fits one
 * buyer intent, and explains itself. Only components the input data actually
 * supports are scored; their weights are renormalised so a missing signal
 * never inflates or deflates the result.
 *
 * It never reads Supabase, never calls an AI model, and never claims anything
 * the input data does not prove (no distances, no seller quality, no
 * structured brand/model knowledge — BajanMarket listings are free text).
 */
import {
  CONDITION_SCORES,
  LISTING_MATCH_WEIGHTS,
  LISTING_RECENCY,
  PARISH_SCORES,
  PRICE_TOLERANCE,
  TEXT_RELEVANCE,
} from "./weights";
import { meaningfulTokens, normalizeText } from "./normalize";
import type {
  BuyerIntentInput,
  ListingInput,
  ListingMatchResult,
  MatchComponentName,
  MatchComponentResult,
} from "./types";

const MS_PER_DAY = 86_400_000;

function clamp100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function na(component: MatchComponentName, detail: string): MatchComponentResult {
  return { score: 0, applicable: false, weight: 0, detail };
}

function on(
  component: MatchComponentName,
  score: number,
  detail: string,
): MatchComponentResult {
  return {
    score: clamp100(score),
    applicable: true,
    weight: LISTING_MATCH_WEIGHTS[component],
    detail,
  };
}

/** Token-overlap relevance. Title hits outweigh description-only hits. */
function scoreText(intent: BuyerIntentInput, listing: ListingInput): MatchComponentResult {
  const queryTokens = meaningfulTokens(intent.query);
  if (queryTokens.length === 0) {
    return na("text", "No query text on the intent");
  }

  const normalizedQuery = normalizeText(intent.query);
  const normalizedTitle = normalizeText(listing.title);
  const normalizedDescription = normalizeText(listing.description);
  const titleTokens = new Set(meaningfulTokens(listing.title));
  const descriptionTokens = new Set(meaningfulTokens(listing.description));

  let hits = 0;
  let titleHits = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      hits += TEXT_RELEVANCE.titleTokenWeight;
      titleHits += 1;
    } else if (descriptionTokens.has(token)) {
      hits += TEXT_RELEVANCE.descriptionTokenWeight;
    }
  }

  let coverage = hits / queryTokens.length;
  if (normalizedQuery && normalizedTitle.includes(normalizedQuery)) {
    coverage += TEXT_RELEVANCE.exactPhraseInTitleBonus;
  } else if (normalizedQuery && normalizedDescription.includes(normalizedQuery)) {
    coverage += TEXT_RELEVANCE.exactPhraseInDescriptionBonus;
  }

  const score = clamp100(coverage * 100);
  const detail = `${titleHits}/${queryTokens.length} query words in the title`;
  return on("text", score, detail);
}

function scoreCategory(
  intent: BuyerIntentInput,
  listing: ListingInput,
): MatchComponentResult {
  if (!intent.categoryId || !listing.categoryId) {
    return na("category", "No category on the intent or the listing");
  }
  return intent.categoryId === listing.categoryId
    ? on("category", 100, "Same category")
    : on("category", 0, "Different category");
}

function scorePrice(intent: BuyerIntentInput, listing: ListingInput): MatchComponentResult {
  const hasRange =
    typeof intent.minPrice === "number" || typeof intent.maxPrice === "number";
  if (!hasRange) return na("price", "Buyer expressed no price preference");
  if (typeof listing.price !== "number" || !Number.isFinite(listing.price)) {
    return na("price", "Listing has no price");
  }

  const { minPrice, maxPrice } = intent;
  if (typeof minPrice === "number" && listing.price < minPrice) {
    return on("price", PRICE_TOLERANCE.belowMinScore, "Below the buyer's stated minimum");
  }
  if (typeof maxPrice === "number" && maxPrice > 0 && listing.price > maxPrice) {
    const over = (listing.price - maxPrice) / maxPrice;
    if (over >= PRICE_TOLERANCE.zeroRatio) {
      return on("price", 0, "Far above the buyer's maximum");
    }
    if (over <= PRICE_TOLERANCE.graceRatio) {
      const t = over / PRICE_TOLERANCE.graceRatio;
      const score = 100 - t * (100 - PRICE_TOLERANCE.edgeScore);
      return on("price", score, "Slightly above the buyer's maximum");
    }
    const t =
      (over - PRICE_TOLERANCE.graceRatio) /
      (PRICE_TOLERANCE.zeroRatio - PRICE_TOLERANCE.graceRatio);
    return on("price", PRICE_TOLERANCE.edgeScore * (1 - t), "Above the buyer's maximum");
  }
  return on("price", PRICE_TOLERANCE.inRangeScore, "Within the buyer's price range");
}

function scoreCondition(
  intent: BuyerIntentInput,
  listing: ListingInput,
): MatchComponentResult {
  if (!intent.preferredCondition) {
    return na("condition", "Buyer expressed no condition preference");
  }
  if (!listing.condition) return na("condition", "Listing has no condition");
  return intent.preferredCondition === listing.condition
    ? on("condition", CONDITION_SCORES.exactMatch, "Preferred condition")
    : on("condition", CONDITION_SCORES.differentCondition, "Different condition");
}

function scoreParish(intent: BuyerIntentInput, listing: ListingInput): MatchComponentResult {
  if (!intent.preferredParish) {
    return na("parish", "Buyer expressed no parish preference");
  }
  if (!listing.parish) return na("parish", "Listing has no parish");
  // Parish equality only. BajanMarket stores no coordinates and has no parish
  // adjacency map, so no "nearby" tier and no distance may ever be claimed.
  return intent.preferredParish === listing.parish
    ? on("parish", PARISH_SCORES.sameParish, "Same parish")
    : on("parish", PARISH_SCORES.differentParish, "Different parish");
}

function scoreRecency(listing: ListingInput, now: number): MatchComponentResult {
  const created = toTime(listing.createdAt);
  if (created === null) return na("recency", "Listing has no creation date");
  const days = Math.max(0, (now - created) / MS_PER_DAY);
  if (days <= LISTING_RECENCY.freshDays) return on("recency", 100, "Listed recently");
  if (days >= LISTING_RECENCY.staleDays) {
    return on("recency", LISTING_RECENCY.floorScore, "Older listing");
  }
  const t =
    (days - LISTING_RECENCY.freshDays) /
    (LISTING_RECENCY.staleDays - LISTING_RECENCY.freshDays);
  return on("recency", 100 - t * (100 - LISTING_RECENCY.floorScore), "Listing age");
}

export interface ListingMatchOptions {
  /** Injected clock so tests stay deterministic. */
  now?: string | Date | null;
}

export function calculateListingMatch(
  intent: BuyerIntentInput,
  listing: ListingInput,
  options: ListingMatchOptions = {},
): ListingMatchResult {
  const now = toTime(options.now) ?? Date.now();

  const components: Record<MatchComponentName, MatchComponentResult> = {
    text: scoreText(intent, listing),
    category: scoreCategory(intent, listing),
    price: scorePrice(intent, listing),
    condition: scoreCondition(intent, listing),
    parish: scoreParish(intent, listing),
    recency: scoreRecency(listing, now),
  };

  // Renormalise over applicable components only.
  let weighted = 0;
  let totalWeight = 0;
  for (const component of Object.values(components)) {
    if (!component.applicable) continue;
    weighted += component.score * component.weight;
    totalWeight += component.weight;
  }
  const overall = totalWeight > 0 ? clamp100(weighted / totalWeight) : 0;

  // Reasons are only emitted when the input data proves them.
  const reasons: string[] = [];
  const normalizedQuery = normalizeText(intent.query);
  if (
    components.text.applicable &&
    components.text.score >= TEXT_RELEVANCE.weakMatchCoverage * 100 &&
    normalizedQuery
  ) {
    reasons.push(`Matches your search for “${normalizedQuery}”`);
  }
  if (components.price.applicable && components.price.score >= PRICE_TOLERANCE.inRangeScore) {
    reasons.push("Within your preferred price range");
  }
  if (components.condition.applicable && components.condition.score === CONDITION_SCORES.exactMatch) {
    reasons.push("Matches your preferred condition");
  }
  if (components.parish.applicable && components.parish.score === PARISH_SCORES.sameParish) {
    reasons.push("Listed in your preferred parish");
  }
  if (components.recency.applicable && components.recency.score >= 100) {
    reasons.push("Recently listed");
  }

  // Eligibility flags only. Real exclusion (inactive listing, own listing,
  // banned seller) stays in the server-side candidate query in a later phase.
  const rejectionReasons: string[] = [];
  if (totalWeight === 0) rejectionReasons.push("insufficient_data");
  if (components.category.applicable && components.category.score === 0) {
    rejectionReasons.push("category_mismatch");
  }

  return {
    listingId: listing.id,
    overall_match_score: Math.round(overall),
    components,
    match_reasons: reasons,
    eligible: rejectionReasons.length === 0,
    rejection_reasons: rejectionReasons,
  };
}
