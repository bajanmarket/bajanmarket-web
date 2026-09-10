import { describe, expect, it } from "vitest";
import {
  calculateNorthStarScore,
  decayIntent,
  scoreBuyerSignals,
} from "./northStar";

describe("Bajanmarket Algorithm V1 North Star", () => {
  it("treats a completed transaction as the strongest positive signal", () => {
    expect(scoreBuyerSignals({ completed_transaction: 1 })).toBe(100);
    expect(scoreBuyerSignals({ seller_message: 1 })).toBe(40);
    expect(scoreBuyerSignals({ favourite: 1 })).toBe(25);
    expect(scoreBuyerSignals({ listing_view: 1 })).toBe(5);
  });

  it("lets a report overwhelm weak positive engagement", () => {
    expect(scoreBuyerSignals({ listing_view: 5, report: 1 })).toBe(0);
  });

  it("decays stale intent while preserving recent intent", () => {
    expect(decayIntent(80, 1)).toBe(80);
    expect(decayIntent(80, 14)).toBeCloseTo(40, 1);
    expect(decayIntent(80, 90)).toBeGreaterThanOrEqual(12);
  });

  it("does not let parish proximity overpower relevance", () => {
    const highlyRelevantElsewhere = calculateNorthStarScore({
      transactionProbability: 85,
      buyerIntent: 90,
      listingRelevance: 95,
      sellerTrust: 85,
      localConvenience: 35,
      listingQuality: 90,
      riskPenalty: 0,
    });

    const localButWeak = calculateNorthStarScore({
      transactionProbability: 55,
      buyerIntent: 70,
      listingRelevance: 45,
      sellerTrust: 80,
      localConvenience: 100,
      listingQuality: 75,
      riskPenalty: 0,
    });

    expect(highlyRelevantElsewhere.score).toBeGreaterThan(localButWeak.score);
  });

  it("penalizes risky listings strongly", () => {
    const safe = calculateNorthStarScore({
      transactionProbability: 80,
      buyerIntent: 80,
      listingRelevance: 80,
      sellerTrust: 80,
      localConvenience: 80,
      listingQuality: 80,
      riskPenalty: 0,
    });
    const risky = calculateNorthStarScore({
      transactionProbability: 80,
      buyerIntent: 80,
      listingRelevance: 80,
      sellerTrust: 80,
      localConvenience: 80,
      listingQuality: 80,
      riskPenalty: 80,
    });

    expect(risky.score).toBeLessThan(safe.score);
  });
});
