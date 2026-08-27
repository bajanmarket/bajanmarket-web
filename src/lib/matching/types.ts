/**
 * Matching-domain types.
 *
 * Deliberately decoupled from the Supabase generated types: the scoring engine
 * must stay pure and portable. A later phase maps database rows into these
 * shapes at the query boundary. The condition/parish unions mirror the existing
 * `listing_condition` and `parish` enums by construction (see @/lib/parishes).
 */
import type { Database } from "@/integrations/supabase/types";

export type ListingCondition = Database["public"]["Enums"]["listing_condition"];
export type Parish = Database["public"]["Enums"]["parish"];

/** What a buyer appears to be looking for. Mirrors public.buyer_intents. */
export interface BuyerIntentInput {
  categoryId?: string | null;
  /** Raw or normalised query text; the scorer normalises defensively. */
  query: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  preferredCondition?: ListingCondition | null;
  preferredParish?: Parish | null;
}

/** The candidate being scored. Mirrors the columns public.listings already has. */
export interface ListingInput {
  id: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  price?: number | null;
  condition?: ListingCondition | null;
  parish?: Parish | null;
  /** ISO timestamp or Date. */
  createdAt?: string | Date | null;
  /** Present so a later phase can enforce eligibility; unused for scoring. */
  status?: string | null;
  sellerId?: string | null;
}

export type MatchComponentName =
  | "text"
  | "category"
  | "price"
  | "condition"
  | "parish"
  | "recency";

export interface MatchComponentResult {
  /** 0–100 within this component. */
  score: number;
  /** False when the input data does not support this component, in which case
   *  its weight is excluded from the final renormalisation. */
  applicable: boolean;
  /** Weight actually applied (0 when not applicable). */
  weight: number;
  /** Factual note about how this component was decided. */
  detail: string;
}

export interface ListingMatchResult {
  listingId: string;
  /** 0–100. */
  overall_match_score: number;
  components: Record<MatchComponentName, MatchComponentResult>;
  /** Evidence-based, user-safe explanations. Never speculative. */
  match_reasons: string[];
  /** Signals a later server-side filter may act on. Never fabricated. */
  eligible: boolean;
  rejection_reasons: string[];
}

/** Behavioural counts fed to the buyer-intent scorer. All optional. */
export interface BuyerIntentSignals {
  search_count?: number;
  /** Subset of search_count considered "recent" by the caller's window. */
  recent_search_count?: number;
  listing_view_count?: number;
  favourite_count?: number;
  seller_contact_count?: number;
  /** ISO timestamp or Date of the most recent relevant activity. */
  last_activity_at?: string | Date | null;
  /** Injected clock so tests stay deterministic. Defaults to Date.now(). */
  now?: string | Date | null;
}

export interface IntentComponentResult {
  signal: string;
  count: number;
  points: number;
  capped: boolean;
}

export interface BuyerIntentScoreResult {
  /** 0–100 after recency decay. */
  score: number;
  /** 0–100 before recency decay. */
  raw_score: number;
  recency_multiplier: number;
  components: IntentComponentResult[];
  contributing_signals: string[];
  debug: {
    days_since_activity: number | null;
    half_life_days: number;
  };
}
