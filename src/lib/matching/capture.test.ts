import { describe, expect, it } from "vitest";
import {
  captureListingView,
  captureSearchIntent,
  type CaptureStore,
  type IntentInsert,
  type IntentUpdate,
  type StoredIntent,
} from "./capture";
import { CAPTURE_CONFIG } from "./weights";
import { calculateBuyerIntentScore } from "./intentScore";

const NOW = "2026-08-27T12:00:00.000Z";
const USER = "user-1";
const LISTING = "listing-1";

function minutesLater(base: string, minutes: number) {
  return new Date(new Date(base).getTime() + minutes * 60_000).toISOString();
}

interface Fake extends CaptureStore {
  intents: StoredIntent[];
  views: Array<{ user_id: string; listing_id: string; occurred_at: string }>;
  inserts: number;
  updates: number;
}

function fakeStore(opts: { enabled?: boolean; flagThrows?: boolean; writeThrows?: boolean } = {}): Fake {
  const intents: StoredIntent[] = [];
  const views: Fake["views"] = [];
  const store: Fake = {
    intents,
    views,
    inserts: 0,
    updates: 0,
    async isCaptureEnabled() {
      if (opts.flagThrows) throw new Error("flag read failed");
      return opts.enabled ?? true;
    },
    async findIntent(userId, key) {
      return intents.find((i) => i.intent_key === key && userId === USER) ?? null;
    },
    async insertIntent(row: IntentInsert) {
      if (opts.writeThrows) throw new Error("write failed");
      store.inserts += 1;
      intents.push({ id: `i${intents.length + 1}`, ...row } as unknown as StoredIntent);
    },
    async updateIntent(id: string, patch: IntentUpdate) {
      if (opts.writeThrows) throw new Error("write failed");
      store.updates += 1;
      const found = intents.find((i) => i.id === id);
      if (found) Object.assign(found, patch);
    },
    async findLastListingView(userId, listingId) {
      const matches = views
        .filter((v) => v.user_id === userId && v.listing_id === listingId)
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      return matches[0] ? { occurred_at: matches[0].occurred_at } : null;
    },
    async insertListingView(row) {
      if (opts.writeThrows) throw new Error("write failed");
      views.push(row as Fake["views"][number]);
    },
  };
  return store;
}

describe("search-signal double counting", () => {
  it("does not let one recent search outrank one save", () => {
    const recentSearch = calculateBuyerIntentScore({
      search_count: 1,
      recent_search_count: 1,
      last_activity_at: NOW,
      now: NOW,
    });
    const save = calculateBuyerIntentScore({ favourite_count: 1, last_activity_at: NOW, now: NOW });
    expect(recentSearch.score).toBeLessThan(save.score);
  });

  it("keeps one recent search far below a seller contact", () => {
    const recentSearch = calculateBuyerIntentScore({
      search_count: 1,
      recent_search_count: 1,
      last_activity_at: NOW,
      now: NOW,
    });
    const contact = calculateBuyerIntentScore({
      seller_contact_count: 1,
      last_activity_at: NOW,
      now: NOW,
    });
    expect(recentSearch.score * 2).toBeLessThan(contact.score);
  });

  it("counts a recent search once, not in both buckets", () => {
    const subset = calculateBuyerIntentScore({
      search_count: 3,
      recent_search_count: 3,
      last_activity_at: NOW,
      now: NOW,
    });
    const onlyRecent = calculateBuyerIntentScore({
      search_count: 0,
      recent_search_count: 3,
      last_activity_at: NOW,
      now: NOW,
    });
    expect(subset.score).toBe(onlyRecent.score);
  });

  it("lets repeated recent searching build meaningful intent", () => {
    const one = calculateBuyerIntentScore({ search_count: 1, recent_search_count: 1, last_activity_at: NOW, now: NOW });
    const many = calculateBuyerIntentScore({ search_count: 4, recent_search_count: 4, last_activity_at: NOW, now: NOW });
    const save = calculateBuyerIntentScore({ favourite_count: 1, last_activity_at: NOW, now: NOW });
    expect(many.score).toBeGreaterThan(one.score);
    expect(many.score).toBeGreaterThan(save.score);
  });

  it("preserves the qualitative hierarchy", () => {
    const s = (o: Parameters<typeof calculateBuyerIntentScore>[0]) =>
      calculateBuyerIntentScore({ ...o, last_activity_at: NOW, now: NOW }).score;
    expect(s({ seller_contact_count: 1 })).toBeGreaterThan(s({ favourite_count: 1 }));
    expect(s({ favourite_count: 1 })).toBeGreaterThan(s({ search_count: 1, recent_search_count: 1 }));
    expect(s({ search_count: 3, recent_search_count: 3 })).toBeGreaterThan(s({ listing_view_count: 1 }));
    expect(s({ search_count: 1, recent_search_count: 1 })).toBeGreaterThan(s({ listing_view_count: 1 }));
  });
});

describe("capture gating", () => {
  it("writes no intent when the flag is off", async () => {
    const store = fakeStore({ enabled: false });
    const out = await captureSearchIntent(store, { userId: USER, query: "iphone 15 pro" }, { now: NOW });
    expect(out).toEqual({ captured: false, reason: "disabled" });
    expect(store.intents).toHaveLength(0);
  });

  it("records no listing view when the flag is off", async () => {
    const store = fakeStore({ enabled: false });
    const out = await captureListingView(store, { userId: USER, listingId: LISTING }, { now: NOW });
    expect(out).toEqual({ captured: false, reason: "disabled" });
    expect(store.views).toHaveLength(0);
  });

  it("fails closed when the feature-flag read fails", async () => {
    const store = fakeStore({ flagThrows: true });
    expect(await captureSearchIntent(store, { userId: USER, query: "x phone" }, { now: NOW })).toEqual({
      captured: false,
      reason: "error",
    });
    expect(await captureListingView(store, { userId: USER, listingId: LISTING }, { now: NOW })).toEqual({
      captured: false,
      reason: "error",
    });
    expect(store.intents).toHaveLength(0);
    expect(store.views).toHaveLength(0);
  });

  it("ignores anonymous searches and anonymous listing views", async () => {
    const store = fakeStore();
    expect(await captureSearchIntent(store, { userId: null, query: "iphone" }, { now: NOW })).toEqual({
      captured: false,
      reason: "anonymous",
    });
    expect(await captureListingView(store, { userId: null, listingId: LISTING }, { now: NOW })).toEqual({
      captured: false,
      reason: "anonymous",
    });
    expect(store.intents).toHaveLength(0);
    expect(store.views).toHaveLength(0);
  });

  it("never throws when the write layer fails", async () => {
    const store = fakeStore({ writeThrows: true });
    await expect(
      captureSearchIntent(store, { userId: USER, query: "iphone 15 pro" }, { now: NOW }),
    ).resolves.toEqual({ captured: false, reason: "error" });
    await expect(
      captureListingView(store, { userId: USER, listingId: LISTING }, { now: NOW }),
    ).resolves.toEqual({ captured: false, reason: "error" });
  });
});

describe("intent merging", () => {
  it("merges equivalent repeated queries into one intent", async () => {
    const store = fakeStore();
    await captureSearchIntent(store, { userId: USER, query: "iphone 15 pro" }, { now: NOW });
    await captureSearchIntent(store, { userId: USER, query: "  iPhone   15 PRO " }, { now: minutesLater(NOW, 5) });
    expect(store.intents).toHaveLength(1);
    expect(store.intents[0]!.signal_count).toBe(2);
    expect(store.intents[0]!.last_seen).toBe(minutesLater(NOW, 5));
    expect(store.intents[0]!.first_seen).toBe(NOW);
  });

  it("keeps Pro and Pro Max separate", async () => {
    const store = fakeStore();
    await captureSearchIntent(store, { userId: USER, query: "iphone 15 pro" }, { now: NOW });
    await captureSearchIntent(store, { userId: USER, query: "iphone 15 pro max" }, { now: NOW });
    expect(store.intents).toHaveLength(2);
  });

  it("keeps different model years separate", async () => {
    const store = fakeStore();
    await captureSearchIntent(store, { userId: USER, query: "Toyota Axio 2018" }, { now: NOW });
    await captureSearchIntent(store, { userId: USER, query: "Toyota Axio 2020" }, { now: NOW });
    expect(store.intents).toHaveLength(2);
  });

  it("does not erase existing preferences when a later search omits filters", async () => {
    const store = fakeStore();
    await captureSearchIntent(
      store,
      { userId: USER, query: "toyota axio", maxPrice: 30_000, parish: "saint_michael" },
      { now: NOW },
    );
    await captureSearchIntent(store, { userId: USER, query: "toyota axio" }, { now: minutesLater(NOW, 60) });
    expect(store.intents).toHaveLength(1);
    expect(store.intents[0]!.max_price).toBe(30_000);
    expect(store.intents[0]!.preferred_parish).toBe("saint_michael");
  });

  it("applies newly supplied filters", async () => {
    const store = fakeStore();
    await captureSearchIntent(store, { userId: USER, query: "toyota axio" }, { now: NOW });
    await captureSearchIntent(
      store,
      { userId: USER, query: "toyota axio", maxPrice: 25_000 },
      { now: minutesLater(NOW, 30) },
    );
    expect(store.intents[0]!.max_price).toBe(25_000);
  });
});

describe("listing-view dedupe", () => {
  it("deduplicates a rapid refresh by the same user on the same listing", async () => {
    const store = fakeStore();
    await captureListingView(store, { userId: USER, listingId: LISTING }, { now: NOW });
    const second = await captureListingView(
      store,
      { userId: USER, listingId: LISTING },
      { now: minutesLater(NOW, 1) },
    );
    expect(second).toEqual({ captured: false, reason: "deduped" });
    expect(store.views).toHaveLength(1);
  });

  it("records a new event after the dedupe window", async () => {
    const store = fakeStore();
    await captureListingView(store, { userId: USER, listingId: LISTING }, { now: NOW });
    const later = await captureListingView(
      store,
      { userId: USER, listingId: LISTING },
      { now: minutesLater(NOW, CAPTURE_CONFIG.listingViewDedupeMinutes + 1) },
    );
    expect(later).toEqual({ captured: true, action: "created" });
    expect(store.views).toHaveLength(2);
  });

  it("only ever writes listing_viewed events — never favourites or contacts", async () => {
    const store = fakeStore();
    await captureListingView(store, { userId: USER, listingId: LISTING }, { now: NOW });
    await captureSearchIntent(store, { userId: USER, query: "iphone" }, { now: NOW });
    expect(store.views.every((v) => "listing_id" in v)).toBe(true);
    expect(JSON.stringify(store.views)).not.toMatch(/saved|contact|favourite/i);
  });
});
