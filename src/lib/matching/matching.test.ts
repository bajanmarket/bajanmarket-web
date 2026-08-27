import { describe, expect, it } from "vitest";
import { buildIntentKey, meaningfulTokens, normalizeText, sameIntentKey } from "./normalize";
import { calculateBuyerIntentScore, recencyMultiplier } from "./intentScore";
import { calculateListingMatch } from "./listingScore";
import type { BuyerIntentInput, ListingInput } from "./types";

const NOW = "2026-08-27T12:00:00.000Z";
const CAT_PHONES = "11111111-1111-1111-1111-111111111111";
const CAT_VEHICLES = "22222222-2222-2222-2222-222222222222";

function listing(overrides: Partial<ListingInput> & { id: string; title: string }): ListingInput {
  return { description: null, createdAt: NOW, ...overrides };
}

describe("normalisation", () => {
  it("normalises casing, punctuation and whitespace identically", () => {
    expect(normalizeText("iPhone 15 Pro")).toBe("iphone 15 pro");
    expect(normalizeText("  IPHONE   15   PRO!! ")).toBe("iphone 15 pro");
    expect(normalizeText("iphone 15 pro")).toBe("iphone 15 pro");
  });

  it("keeps model qualifiers and digits", () => {
    expect(meaningfulTokens("iPhone 15 Pro Max")).toEqual(["iphone", "15", "pro", "max"]);
    expect(meaningfulTokens("Toyota Axio 2018")).toEqual(["toyota", "axio", "2018"]);
  });

  it("drops only meaningless filler words", () => {
    expect(meaningfulTokens("looking to buy a toyota axio")).toEqual(["toyota", "axio"]);
  });
});

describe("intent keys", () => {
  it("merges casing/spacing variants of the same query", () => {
    expect(
      sameIntentKey(
        { categoryId: CAT_PHONES, query: "iphone 15 pro" },
        { categoryId: CAT_PHONES, query: "  iPhone   15 Pro " },
      ),
    ).toBe(true);
  });

  it("merges word-order variants", () => {
    expect(
      sameIntentKey(
        { categoryId: CAT_PHONES, query: "pro iphone 15" },
        { categoryId: CAT_PHONES, query: "iphone 15 pro" },
      ),
    ).toBe(true);
  });

  it("does NOT merge iphone 15 pro with iphone 15 pro max", () => {
    expect(
      sameIntentKey(
        { categoryId: CAT_PHONES, query: "iphone 15 pro" },
        { categoryId: CAT_PHONES, query: "iphone 15 pro max" },
      ),
    ).toBe(false);
  });

  it("does NOT merge different model years", () => {
    expect(
      sameIntentKey(
        { categoryId: CAT_VEHICLES, query: "Toyota Axio 2018" },
        { categoryId: CAT_VEHICLES, query: "Toyota Axio 2020" },
      ),
    ).toBe(false);
  });

  it("does NOT merge the same query across different categories", () => {
    expect(
      sameIntentKey(
        { categoryId: CAT_PHONES, query: "case" },
        { categoryId: CAT_VEHICLES, query: "case" },
      ),
    ).toBe(false);
  });

  it("is deterministic", () => {
    const a = buildIntentKey({ categoryId: CAT_PHONES, query: "iPhone 15 Pro" });
    const b = buildIntentKey({ categoryId: CAT_PHONES, query: "iPhone 15 Pro" });
    expect(a).toBe(b);
  });
});

describe("listing text relevance", () => {
  const intent: BuyerIntentInput = { query: "iphone 15 pro" };

  it("ranks the matching product far above an unrelated one", () => {
    const match = calculateListingMatch(
      intent,
      listing({ id: "a", title: "Apple iPhone 15 Pro 256GB" }),
      { now: NOW },
    );
    const other = calculateListingMatch(
      intent,
      listing({ id: "b", title: "Samsung Galaxy S24" }),
      { now: NOW },
    );
    expect(match.overall_match_score).toBeGreaterThan(other.overall_match_score + 30);
    expect(match.match_reasons).toContain("Matches your search for “iphone 15 pro”");
    expect(other.match_reasons).not.toContain("Matches your search for “iphone 15 pro”");
  });

  it("values title matches above description-only matches", () => {
    const inTitle = calculateListingMatch(
      intent,
      listing({ id: "a", title: "iPhone 15 Pro" }),
      { now: NOW },
    );
    const inDescription = calculateListingMatch(
      intent,
      listing({ id: "b", title: "Phone for sale", description: "iPhone 15 Pro, boxed" }),
      { now: NOW },
    );
    expect(inTitle.components.text.score).toBeGreaterThan(inDescription.components.text.score);
  });

  it("distinguishes model years in listing text", () => {
    const wanted: BuyerIntentInput = { query: "Toyota Axio 2018" };
    const exact = calculateListingMatch(
      wanted,
      listing({ id: "a", title: "Toyota Axio 2018" }),
      { now: NOW },
    );
    const otherYear = calculateListingMatch(
      wanted,
      listing({ id: "b", title: "Toyota Axio 2020" }),
      { now: NOW },
    );
    expect(exact.components.text.score).toBeGreaterThan(otherYear.components.text.score);
  });

  it("does not claim a structured model match in its reasons", () => {
    const result = calculateListingMatch(
      intent,
      listing({ id: "a", title: "Apple iPhone 15 Pro 256GB" }),
      { now: NOW },
    );
    expect(result.match_reasons.join(" ")).not.toMatch(/exact model|km away|trusted|popular/i);
  });
});

describe("price scoring", () => {
  const base: BuyerIntentInput = { query: "toyota axio", maxPrice: 30_000 };

  it("prefers a listing inside the range over one far outside it", () => {
    const inRange = calculateListingMatch(
      base,
      listing({ id: "a", title: "Toyota Axio", price: 29_500 }),
      { now: NOW },
    );
    const wayOver = calculateListingMatch(
      base,
      listing({ id: "b", title: "Toyota Axio", price: 60_000 }),
      { now: NOW },
    );
    expect(inRange.overall_match_score).toBeGreaterThan(wayOver.overall_match_score);
    expect(inRange.match_reasons).toContain("Within your preferred price range");
    expect(wayOver.components.price.score).toBe(0);
  });

  it("only mildly penalises a listing slightly over budget", () => {
    const slightly = calculateListingMatch(
      base,
      listing({ id: "a", title: "Toyota Axio", price: 31_000 }),
      { now: NOW },
    );
    expect(slightly.components.price.score).toBeGreaterThan(80);
    expect(slightly.components.price.score).toBeLessThan(100);
  });

  it("excludes price entirely when the buyer stated no preference", () => {
    const result = calculateListingMatch(
      { query: "toyota axio" },
      listing({ id: "a", title: "Toyota Axio", price: 250_000 }),
      { now: NOW },
    );
    expect(result.components.price.applicable).toBe(false);
    expect(result.components.price.weight).toBe(0);
    expect(result.match_reasons).not.toContain("Within your preferred price range");
  });

  it("gives no fake price advantage to a buyer without a price preference", () => {
    const withoutPreference = calculateListingMatch(
      { query: "toyota axio" },
      listing({ id: "a", title: "Toyota Axio", price: 29_000 }),
      { now: NOW },
    );
    const withPreference = calculateListingMatch(
      { query: "toyota axio", maxPrice: 30_000 },
      listing({ id: "a", title: "Toyota Axio", price: 29_000 }),
      { now: NOW },
    );
    // Both are perfect on the components that apply, so renormalisation must
    // leave them equal rather than rewarding the missing signal.
    expect(withoutPreference.overall_match_score).toBe(withPreference.overall_match_score);
  });
});

describe("category, condition and parish", () => {
  const intent: BuyerIntentInput = {
    query: "iphone 15 pro",
    categoryId: CAT_PHONES,
    preferredCondition: "like_new",
    preferredParish: "saint_michael",
  };

  it("flags a category mismatch instead of silently ranking it", () => {
    const result = calculateListingMatch(
      intent,
      listing({ id: "a", title: "iPhone 15 Pro", categoryId: CAT_VEHICLES }),
      { now: NOW },
    );
    expect(result.components.category.score).toBe(0);
    expect(result.eligible).toBe(false);
    expect(result.rejection_reasons).toContain("category_mismatch");
  });

  it("rewards the preferred condition and parish with factual reasons", () => {
    const result = calculateListingMatch(
      intent,
      listing({
        id: "a",
        title: "iPhone 15 Pro",
        categoryId: CAT_PHONES,
        condition: "like_new",
        parish: "saint_michael",
      }),
      { now: NOW },
    );
    expect(result.match_reasons).toContain("Matches your preferred condition");
    expect(result.match_reasons).toContain("Listed in your preferred parish");
    expect(result.match_reasons.join(" ")).not.toMatch(/km|minutes away|nearby/i);
  });

  it("excludes parish and condition when the buyer stated no preference", () => {
    const result = calculateListingMatch(
      { query: "iphone 15 pro" },
      listing({ id: "a", title: "iPhone 15 Pro", condition: "good", parish: "saint_philip" }),
      { now: NOW },
    );
    expect(result.components.parish.applicable).toBe(false);
    expect(result.components.condition.applicable).toBe(false);
  });
});

describe("listing recency never dominates relevance", () => {
  it("keeps an old relevant listing above a brand new irrelevant one", () => {
    const intent: BuyerIntentInput = { query: "iphone 15 pro" };
    const oldRelevant = calculateListingMatch(
      intent,
      listing({
        id: "a",
        title: "Apple iPhone 15 Pro 256GB",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      { now: NOW },
    );
    const newIrrelevant = calculateListingMatch(
      intent,
      listing({ id: "b", title: "Wooden dining table", createdAt: NOW }),
      { now: NOW },
    );
    expect(oldRelevant.overall_match_score).toBeGreaterThan(newIrrelevant.overall_match_score);
  });
});

describe("buyer intent score", () => {
  it("treats a seller contact as stronger than a single listing view", () => {
    const view = calculateBuyerIntentScore({ listing_view_count: 1, last_activity_at: NOW, now: NOW });
    const contact = calculateBuyerIntentScore({ seller_contact_count: 1, last_activity_at: NOW, now: NOW });
    expect(contact.score).toBeGreaterThan(view.score);
  });

  it("treats a save as stronger than a view, and repeated searches as stronger than one", () => {
    const view = calculateBuyerIntentScore({ listing_view_count: 1, last_activity_at: NOW, now: NOW });
    const save = calculateBuyerIntentScore({ favourite_count: 1, last_activity_at: NOW, now: NOW });
    const oneSearch = calculateBuyerIntentScore({ search_count: 1, last_activity_at: NOW, now: NOW });
    const manySearches = calculateBuyerIntentScore({ search_count: 4, last_activity_at: NOW, now: NOW });
    expect(save.score).toBeGreaterThan(view.score);
    expect(manySearches.score).toBeGreaterThan(oneSearch.score);
  });

  it("decays stale behaviour below identical recent behaviour", () => {
    const signals = { search_count: 3, favourite_count: 1 };
    const fresh = calculateBuyerIntentScore({ ...signals, last_activity_at: NOW, now: NOW });
    const stale = calculateBuyerIntentScore({
      ...signals,
      last_activity_at: "2026-07-01T12:00:00.000Z",
      now: NOW,
    });
    expect(fresh.score).toBeGreaterThan(stale.score);
    expect(fresh.raw_score).toBe(stale.raw_score);
  });

  it("has a predictable half-life", () => {
    expect(recencyMultiplier("2026-08-13T12:00:00.000Z", NOW)).toBeCloseTo(0.5, 3);
    expect(recencyMultiplier(NOW, NOW)).toBe(1);
  });

  it("returns a valid bounded score with no signals at all", () => {
    const empty = calculateBuyerIntentScore();
    expect(empty.score).toBe(0);
    expect(empty.contributing_signals).toEqual([]);
    expect(empty.debug.days_since_activity).toBeNull();
  });

  it("stays bounded 0–100 under absurd input", () => {
    const huge = calculateBuyerIntentScore({
      search_count: 5_000,
      recent_search_count: 5_000,
      listing_view_count: 5_000,
      favourite_count: 5_000,
      seller_contact_count: 5_000,
      last_activity_at: NOW,
      now: NOW,
    });
    expect(huge.score).toBeLessThanOrEqual(100);
    expect(huge.score).toBeGreaterThanOrEqual(0);
  });
});

describe("bounds, missing data and determinism", () => {
  it("keeps every listing match within 0–100", () => {
    const cases: ListingInput[] = [
      listing({ id: "a", title: "" }),
      listing({ id: "b", title: "iPhone 15 Pro", price: -5 }),
      listing({ id: "c", title: "iPhone 15 Pro", createdAt: "not-a-date" }),
    ];
    for (const candidate of cases) {
      const result = calculateListingMatch(
        { query: "iphone 15 pro", maxPrice: 3_000 },
        candidate,
        { now: NOW },
      );
      expect(result.overall_match_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_match_score).toBeLessThanOrEqual(100);
    }
  });

  it("handles an empty query without crashing or inventing reasons", () => {
    const result = calculateListingMatch({ query: "" }, listing({ id: "a", title: "Anything" }), {
      now: NOW,
    });
    expect(result.components.text.applicable).toBe(false);
    expect(result.match_reasons).not.toContain("Matches your search for “”");
    expect(result.overall_match_score).toBeGreaterThanOrEqual(0);
  });

  it("produces identical output for identical input", () => {
    const intent: BuyerIntentInput = {
      query: "iphone 15 pro",
      categoryId: CAT_PHONES,
      maxPrice: 3_000,
      preferredParish: "saint_michael",
    };
    const candidate = listing({
      id: "a",
      title: "Apple iPhone 15 Pro",
      categoryId: CAT_PHONES,
      price: 2_800,
      parish: "saint_michael",
    });
    const first = calculateListingMatch(intent, candidate, { now: NOW });
    const second = calculateListingMatch(intent, candidate, { now: NOW });
    expect(first).toEqual(second);
  });
});
