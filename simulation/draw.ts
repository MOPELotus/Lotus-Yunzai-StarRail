import type { WarpItem, WarpPool } from "./pools.ts";

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
function fiveChance(cone: boolean, number: number) {
  if (cone) return number >= 80 ? 1 : 0.008 + Math.max(0, number - 65) * 0.07;
  return number >= 90 ? 1 : 0.006 + Math.max(0, number - 73) * 0.06;
}

function choose(items: readonly WarpItem[], random: () => number) {
  return items[Math.floor(random() * items.length)]!;
}

function chooseByKind(items: readonly WarpItem[], random: () => number) {
  const kind = random() < 0.5 ? "角色" : "光锥";
  const matched = items.filter((item) => item.kind === kind);
  return choose(matched.length ? matched : items, random);
}

export function simulateWarps(pool: WarpPool, state: WarpPity, count: number, random = Math.random): WarpPull[] {
  const cone = pool.kind === "cone";
  const featuredRate = cone ? 0.75 : 0.5;
  return Array.from({ length: count }, (_, index): WarpPull => {
    const order = index + 1;
    const pity = state.fiveMisses + 1;
    const roll = random();
    const five = fiveChance(cone, pity);
    if (roll < five) {
      state.fiveMisses = 0;
      state.fourOrBetterMisses = 0;
      const featured = pool.featuredFive && (state.nextFiveFeatured || random() < featuredRate);
      state.nextFiveFeatured = !!pool.featuredFive && !featured;
      const item = featured ? pool.featuredFive! : chooseByKind(pool.otherFive, random);
      return { ...item, order, pity, featured: !!featured };
    }
    state.fiveMisses++;
    const fourChance = cone ? 0.066 : 0.051;
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
