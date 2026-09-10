/**
 * Bajanmarket Algorithm V1 — North Star ranking model.
 *
 * Goal: rank listings by probability of a successful buyer/seller transaction,
 * not by raw engagement. This module is pure and side-effect free so it can be
 * tested safely before recommendations are enabled in production.
 */

export type BuyerSignal =
  | "impression"
  | "listing_view"
  | "long_view"
  | "repeat_search"
  | "favourite"
  | "contact_click"
  | "seller_message"
  | "completed_transaction"
  | "hide"
  | "report";

export const BUYER_SIGNAL_WEIGHTS: Record<BuyerSignal, number> = {
  impression: 1,
  listing_view: 5,
  long_view: 12,
  repeat_search: 18,
  favourite: 25,
  contact_click: 35,
  seller_message: 40,
  completed_transaction: 100,
  hide: -30,
  report: -100,
};

export interface NorthStarInput {
  /** 0-100: how strongly the buyer appears to want this product/category now. */
  buyerIntent: number;
  /** 0-100: text/category/price/condition fit. */
  listingRelevance: number;
  /** 0-100: seller verification, response quality and transaction history. */
  sellerTrust: number;
  /** 0-100: parish/location convenience. Kept deliberately secondary. */
  localConvenience: number;
  /** 0-100: modelled likelihood that this listing can convert successfully. */
  transactionProbability: number;
  /** 0-100: duplicate/spam/scam/misleading-price/non-response risk. */
  riskPenalty?: number;
  /** 0-100: listing quality/completeness signal. */
  listingQuality?: number;
}

export interface NorthStarResult {
  score: number;
  components: {
    transactionProbability: number;
    buyerIntent: number;
    listingRelevance: number;
    sellerTrust: number;
    localConvenience: number;
    listingQuality: number;
    riskPenalty: number;
  };
}

const COMPONENT_WEIGHTS = {
  transactionProbability: 0.30,
  buyerIntent: 0.25,
  listingRelevance: 0.22,
  sellerTrust: 0.12,
  localConvenience: 0.06,
  listingQuality: 0.05,
} as const;

const RISK_WEIGHT = 0.35;

function clamp100(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Exponential intent decay. The default half-life is 14 days; recent activity
 * remains strong while stale historical interest fades instead of permanently
 * defining the buyer.
 */
export function decayIntent(
  score: number,
  daysSinceLastActivity: number,
  halfLifeDays = 14,
  floorMultiplier = 0.15,
): number {
  const base = clamp100(score);
  if (!Number.isFinite(daysSinceLastActivity) || daysSinceLastActivity <= 1) return base;
  const halfLife = Math.max(1, halfLifeDays);
  const multiplier = Math.max(
    Math.max(0, Math.min(1, floorMultiplier)),
    Math.pow(0.5, daysSinceLastActivity / halfLife),
  );
  return Number((base * multiplier).toFixed(2));
}

/**
 * Converts observed buyer actions into a bounded intent contribution.
 * Negative signals can reduce the score; reports dominate weaker positives.
 */
export function scoreBuyerSignals(
  counts: Partial<Record<BuyerSignal, number>>,
): number {
  let total = 0;
  for (const [signal, weight] of Object.entries(BUYER_SIGNAL_WEIGHTS) as Array<
    [BuyerSignal, number]
  >) {
    const raw = counts[signal] ?? 0;
    const count = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    total += count * weight;
  }
  return clamp100(total);
}

/**
 * North Star: transaction probability × intent × relevance × trust × local
 * convenience, with listing quality support and explicit risk penalties.
 *
 * Implemented as a weighted normalized score rather than literal multiplication
 * so one imperfect component cannot collapse an otherwise excellent match to
 * near-zero. Location is intentionally weaker than relevance for Barbados.
 */
export function calculateNorthStarScore(input: NorthStarInput): NorthStarResult {
  const transactionProbability = clamp100(input.transactionProbability);
  const buyerIntent = clamp100(input.buyerIntent);
  const listingRelevance = clamp100(input.listingRelevance);
  const sellerTrust = clamp100(input.sellerTrust);
  const localConvenience = clamp100(input.localConvenience);
  const listingQuality = clamp100(input.listingQuality ?? 50);
  const riskPenalty = clamp100(input.riskPenalty ?? 0);

  const positive =
    transactionProbability * COMPONENT_WEIGHTS.transactionProbability +
    buyerIntent * COMPONENT_WEIGHTS.buyerIntent +
    listingRelevance * COMPONENT_WEIGHTS.listingRelevance +
    sellerTrust * COMPONENT_WEIGHTS.sellerTrust +
    localConvenience * COMPONENT_WEIGHTS.localConvenience +
    listingQuality * COMPONENT_WEIGHTS.listingQuality;

  const score = clamp100(positive - riskPenalty * RISK_WEIGHT);

  return {
    score: Math.round(score),
    components: {
      transactionProbability,
      buyerIntent,
      listingRelevance,
      sellerTrust,
      localConvenience,
      listingQuality,
      riskPenalty,
    },
  };
}
