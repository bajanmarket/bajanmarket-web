/**
 * Central, tunable configuration for the BajanMarket matching engine.
 *
 * ⚠️ EVERY NUMBER IN THIS FILE IS A PROVISIONAL BASELINE ASSUMPTION.
 * None of it has been calibrated against real BajanMarket traffic. Once the
 * platform has captured enough buyer behaviour (searches, views, saves,
 * contacts → actual sales), these weights must be re-derived from observed
 * conversion behaviour rather than intuition.
 *
 * Rules for this file:
 *  - No numeric weight or threshold may live anywhere else in src/lib/matching.
 *  - Nothing here may import from the database, the Supabase client, or React.
 */

/** Relative importance of each listing-match component. Values need not sum
 *  to 1 — only the *applicable* components are renormalised at score time
 *  (see listingScore.ts), so a missing signal never inflates a score. */
export const LISTING_MATCH_WEIGHTS = {
  /** Free-text relevance between the buyer's normalised query and the listing. */
  text: 0.45,
  /** Same category as the buyer's intent. */
  category: 0.2,
  /** Fit against the buyer's stated price range. */
  price: 0.18,
  /** Fit against the buyer's preferred condition. */
  condition: 0.07,
  /** Same parish as the buyer's preferred parish. */
  parish: 0.06,
  /** Freshness of the listing. Deliberately small: a new irrelevant listing
   *  must never outrank an older highly relevant one. */
  recency: 0.04,
} as const;

export type ListingMatchComponent = keyof typeof LISTING_MATCH_WEIGHTS;

/** Text-relevance shaping. */
export const TEXT_RELEVANCE = {
  /** A token found in the title is worth this much of a "hit". */
  titleTokenWeight: 1,
  /** A token found only in the description is worth less than a title hit. */
  descriptionTokenWeight: 0.4,
  /** Bonus applied when the whole normalised query appears verbatim in the title. */
  exactPhraseInTitleBonus: 0.25,
  /** Bonus applied when the whole normalised query appears verbatim in the description. */
  exactPhraseInDescriptionBonus: 0.1,
  /** Below this coverage of query tokens the listing is flagged as weakly related. */
  weakMatchCoverage: 0.34,
} as const;

/** Price tolerance around the buyer's stated range. Expressed as a fraction of
 *  the boundary price, so it scales with item value. */
export const PRICE_TOLERANCE = {
  /** Within the range → full marks. */
  inRangeScore: 100,
  /** Overshoot up to this fraction above max decays gradually to `edgeScore`. */
  graceRatio: 0.15,
  /** Overshoot beyond this fraction above max scores zero. */
  zeroRatio: 0.6,
  /** Score at the far edge of the grace band. */
  edgeScore: 60,
  /** Cheaper than a stated minimum is mildly suspicious, not disqualifying. */
  belowMinScore: 70,
} as const;

/** Condition fit. Only applied when the buyer expressed a preference. */
export const CONDITION_SCORES = {
  exactMatch: 100,
  differentCondition: 35,
} as const;

/** Parish fit. Parish-level only — BajanMarket stores no coordinates, and no
 *  parish adjacency map exists, so there is no "nearby" tier and no distance. */
export const PARISH_SCORES = {
  sameParish: 100,
  differentParish: 40,
} as const;

/** Listing freshness ramp, in days. */
export const LISTING_RECENCY = {
  /** Listed within this many days → full recency score. */
  freshDays: 3,
  /** Older than this → floor score. */
  staleDays: 60,
  floorScore: 20,
} as const;

/**
 * Buyer-intent signal weights. Points contributed per occurrence, capped.
 * Ordering assumption (provisional): contacting a seller > saving > repeated
 * searching > a single search > a passive view.
 */
export const INTENT_SIGNAL_WEIGHTS = {
  /** Older (non-recent) searches. Mutually exclusive with `recentSearch`:
   *  the scorer subtracts recent searches from the base bucket so a single
   *  recent search is never counted twice. */
  search: { points: 5, cap: 20 },
  /** Searches inside the recent window, counted INSTEAD of `search`. A single
   *  one must stay below a save (12) and far below a seller contact (22). */
  recentSearch: { points: 8, cap: 28 },
  listingView: { points: 3, cap: 18 },
  favourite: { points: 12, cap: 30 },
  sellerContact: { points: 22, cap: 44 },
} as const;

export type IntentSignal = keyof typeof INTENT_SIGNAL_WEIGHTS;

/**
 * Generic recency decay. One baseline curve for every category for now.
 * Real data will likely show vehicles decay slower than phones — when that
 * happens, replace `halfLifeDays` with a per-category lookup here only.
 */
export const INTENT_RECENCY = {
  /** Exponential half-life: intent strength halves every N days of silence. */
  halfLifeDays: 14,
  /** Decay never drives an otherwise strong intent all the way to zero. */
  minMultiplier: 0.15,
  /** Activity newer than this is treated as "now" (no decay). */
  freshHours: 24,
} as const;

/** Thresholds a later phase may use to decide whether to act on an intent.
 *  Nothing in Phase 3 consumes these; they live here so tuning stays central. */
export const MATCHING_THRESHOLDS = {
  /** Below this intent score, do not personalise anything. */
  minIntentScoreToUse: 35,
  /** Below this match score, do not surface a listing as a recommendation. */
  minListingMatchToShow: 55,
} as const;

/**
 * Phase 4 silent-capture configuration. Central home for every capture number
 * so tuning never requires touching route or server-function code.
 */
export const CAPTURE_CONFIG = {
  /** Feature flag gating ALL buyer-intent capture writes. */
  captureFlagKey: "buyer_intent_capture_enabled",
  /** Repeat views of the same listing by the same user inside this window
   *  collapse into the single earlier buyer-view event. */
  listingViewDedupeMinutes: 30,
  /** Client-side guard so a remount/refetch of the same search URL does not
   *  re-fire capture. Real repeat searching still registers after this. */
  searchCaptureDedupeSeconds: 60,
  /** Category-only searches (no text) are NOT captured: a bare category browse
   *  is not evidence of a specific purchase intent. */
  allowCategoryOnlyIntents: false,
  /** Cap on stored raw query variants per intent (audit trail, not scoring). */
  maxRawQueriesPerIntent: 20,
  /** Cap on stored keywords per intent. */
  maxKeywordsPerIntent: 24,
  /** Searches within this window count in the `recentSearch` bucket. */
  recentSearchWindowDays: 7,
} as const;
