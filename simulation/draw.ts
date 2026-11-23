import type { WarpItem, WarpPool } from "./pools.ts";
import { defaultWarpRates, type WarpRates } from "./settings.ts";

export interface WarpPity {
  fiveMisses: number;
  fourOrBetterMisses: number;
  nextFiveFeatured: boolean;
  nextFourFeatured: boolean;
}

export interface WarpPull extends WarpItem {
  readonly order: number;
  readonly featured: boolean;
  readonly pity?: number;
}

export function emptyPity(): WarpPity {
  return { fiveMisses: 0, fourOrBetterMisses: 0, nextFiveFeatured: false, nextFourFeatured: false };
}

/** The ramp is a simulation approximation. The base rates and hard limits follow the Warp details. */
function fiveChance(cone: boolean, number: number, base: number) {
  if (cone) return number >= 80 ? 1 : base + Math.max(0, number - 65) * 0.07;
  return number >= 90 ? 1 : base + Math.max(0, number - 73) * 0.06;
}

function choose(items: readonly WarpItem[], random: () => number) {
  return items[Math.floor(random() * items.length)]!;
}

function chooseByKind(items: readonly WarpItem[], random: () => number) {
  const kind = random() < 0.5 ? "角色" : "光锥";
  const matched = items.filter((item) => item.kind === kind);
  return choose(matched.length ? matched : items, random);
}

export function simulateWarps(pool: WarpPool, state: WarpPity, count: number, random = Math.random,
  rates: WarpRates = defaultWarpRates, week?: { five: number }, weeklyBonus = false): WarpPull[] {
  const cone = pool.kind === "cone" || pool.kind === "collaboration-cone";
  const featuredItems = pool.featuredFivePool ?? (pool.featuredFive ? [pool.featuredFive] : []);
  const featuredRate = cone ? 0.75 : 0.5;
  const featuredFive = rates.featuredFive === null ? featuredRate : rates.featuredFive / 100;
  const baseFive = (cone ? rates.coneFive : rates.characterFive) / 10_000;
  const fourChance = (cone ? rates.coneFour : rates.characterFour) / 10_000;
  return Array.from({ length: count }, (_, index): WarpPull => {
    const order = index + 1;
    const pity = state.fiveMisses + 1;
    const roll = random();
    const five = fiveChance(cone, pity, weeklyBonus && week?.five === 1 ? 2 * baseFive : baseFive);
    if (roll < five) {
      if (week) week.five = Math.min(Number.MAX_SAFE_INTEGER, week.five + 1);
      state.fiveMisses = 0;
      state.fourOrBetterMisses = 0;
      const featured = featuredItems.length > 0 && (state.nextFiveFeatured || random() < featuredFive);
      state.nextFiveFeatured = featuredItems.length > 0 && !featured;
      const item = featured ? (featuredItems.length === 1 ? featuredItems[0]! : choose(featuredItems, random)) : chooseByKind(pool.otherFive, random);
      return { ...item, order, pity, featured: !!featured };
    }
    state.fiveMisses++;
    if (state.fourOrBetterMisses >= 9 || roll < five + fourChance) {
      state.fourOrBetterMisses = 0;
      const available = pool.featuredFour.length > 0;
      const featured = available && (state.nextFourFeatured || random() < featuredRate);
      state.nextFourFeatured = available && !featured;
      return { ...(featured ? choose(pool.featuredFour, random) : chooseByKind(pool.otherFour, random)), order, featured };
    }
    state.fourOrBetterMisses++;
    return { ...choose(pool.three, random), order, featured: false };
  });
}

function independentFiveChance(kind: WarpPool["kind"], missed: number) {
  if (kind === "cone" || kind === "collaboration-cone") {
    if (missed >= 80) return 10_000;
    if (missed >= 62) return 80 + (missed - 61) * 700;
    if (missed >= 50) return 80 + (missed - 50) * 60;
    if (missed >= 10 && missed <= 20) return 80 + (missed - 10) * 30;
    return 80;
  }
  if (missed >= 90) return 10_000;
  if (missed >= 74) return 590 + (missed - 74) * 530;
  return 60 + Math.max(0, missed - 60) * 40;
}

function chooseIndependentItem(items: readonly WarpItem[], kind: WarpItem["kind"], random: () => number) {
  const matched = items.filter(item => item.kind === kind);
  return choose(matched.length ? matched : items, random);
}

export function simulateIndependentWarps(pool: WarpPool, state: WarpPity, random: () => number): WarpPull[] {
  const cone = pool.kind === "cone" || pool.kind === "collaboration-cone";
  const featuredFives = pool.featuredFivePool ?? (pool.featuredFive ? [pool.featuredFive] : []);
  const featuredFourAvailable = (pool.kind === "character" || pool.kind === "cone") && pool.featuredFour.length > 0;
  return Array.from({ length: 10 }, (_, index): WarpPull => {
    const order = index + 1;
    const pity = state.fiveMisses + 1;
    if (random() * 10_000 < independentFiveChance(pool.kind, state.fiveMisses)) {
      const featured = featuredFives.length > 0 && (state.nextFiveFeatured || random() < (cone ? 0.75 : 0.5));
      const item = featured ? choose(featuredFives, random) : chooseByKind(pool.otherFive, random);
      state.fiveMisses = 0;
      state.fourOrBetterMisses = Math.min(Number.MAX_SAFE_INTEGER, state.fourOrBetterMisses + 1);
      state.nextFiveFeatured = pool.kind !== "standard" && !featured;
      return { ...item, order, featured, pity };
    }

    state.fiveMisses++;
    const fourBase = pool.kind === "cone" ? 660 : 510;
    const fourChance = state.fourOrBetterMisses >= 9 ? 10_000 : fourBase + Math.max(0, state.fourOrBetterMisses - 4) ** 2 * 500;
    if (random() * 10_000 < fourChance) {
      const featured = featuredFourAvailable && (state.nextFourFeatured || random() < 0.5);
      const kind = (pool.kind === "character" || pool.kind === "collaboration-character") && random() < 0.5 ? "角色" : "光锥";
      const item = featured ? choose(pool.featuredFour, random) : chooseIndependentItem(pool.otherFour, kind, random);
      state.fourOrBetterMisses = 0;
      state.nextFourFeatured = !featured;
      return { ...item, order, featured };
    }
    state.fourOrBetterMisses++;
    return { ...choose(pool.three, random), order, featured: false };
  });
}
