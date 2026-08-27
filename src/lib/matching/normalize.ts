/**
 * Deterministic text normalisation and intent-key helpers.
 *
 * Pure string functions only — no AI, no database, no randomness, no clocks.
 * Identical input always produces identical output.
 *
 * Design bias: UNDER-merge rather than over-merge. Two separate intents for
 * the same product is a minor inefficiency; collapsing "iPhone 15 Pro" and
 * "iPhone 15 Pro Max" into one intent produces wrong recommendations.
 */

/**
 * Words safe to drop: they carry no product meaning in a marketplace query.
 * Deliberately tiny. Never add model qualifiers (pro, max, plus, mini, air,
 * ultra, lite, se), sizes, colours, years, or units here.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "with",
  "my",
  "your",
  "is",
  "are",
  "want",
  "wanted",
  "looking",
  "buy",
  "buying",
  "sale",
  "selling",
]);

/**
 * Lowercase, Unicode-normalise, strip accents, drop punctuation that does not
 * separate meaning, and collapse whitespace.
 *
 * "  iPhone 15   Pro!! " → "iphone 15 pro"
 */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    // strip combining accent marks
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // keep letters, digits, spaces and intra-word separators
    .replace(/[^\p{L}\p{N}\s+/'’-]/gu, " ")
    // apostrophes never separate meaning
    .replace(/['’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split normalised text into meaningful tokens.
 * Digits are always kept — "2018" vs "2020" and "256gb" vs "512gb" are the
 * difference between two genuinely different products.
 */
export function tokenize(input: string | null | undefined): string[] {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized
    .split(/[\s/+-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Tokens with stopwords removed, deduplicated, order preserved. */
export function meaningfulTokens(input: string | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenize(input)) {
    // A single character is only meaningful if it is a digit (e.g. "s 9").
    if (token.length < 2 && !/\d/.test(token)) continue;
    if (STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * Stable representation of an intent, suitable for the existing
 * `UNIQUE (user_id, intent_key)` constraint on buyer_intents.
 *
 * Tokens are sorted so word order does not fork an intent ("pro iphone 15"
 * and "iphone 15 pro" are the same shopping goal), but no token is ever
 * dropped, so "…pro" and "…pro max" stay distinct.
 *
 * Phase 3 only produces the key; nothing writes it to the database yet.
 */
export function buildIntentKey(params: {
  categoryId?: string | null;
  query: string;
}): string {
  const tokens = meaningfulTokens(params.query);
  const core = tokens.length > 0 ? [...tokens].sort().join("-") : normalizeText(params.query);
  const category = params.categoryId ? params.categoryId.trim().toLowerCase() : "nocat";
  return `${category}:${core}`;
}

/** True when two queries would collapse into the same intent record. */
export function sameIntentKey(
  a: { categoryId?: string | null; query: string },
  b: { categoryId?: string | null; query: string },
): boolean {
  return buildIntentKey(a) === buildIntentKey(b);
}
