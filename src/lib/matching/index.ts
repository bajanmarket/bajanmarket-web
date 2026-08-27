/**
 * Buyer Intent + Listing Matching engine (Phase 3: pure library only).
 *
 * Nothing in this module reads or writes the database, calls an AI model, or
 * renders UI. It is not wired into any route, search path or feature flag.
 */
export * from "./types";
export * from "./weights";
export { normalizeText, tokenize, meaningfulTokens, buildIntentKey, sameIntentKey } from "./normalize";
export { calculateBuyerIntentScore, recencyMultiplier } from "./intentScore";
export { calculateListingMatch, type ListingMatchOptions } from "./listingScore";
