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
