import { renderGachaVersion, type GachaVersionOptions } from "@lotus-yunzai/skia/gacha-version";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import type { StarRailGachaVersionModel } from "./gacha-version.ts";

export function renderStarRailGachaVersion(
  model: StarRailGachaVersionModel,
  { themeDirectory = starRailGachaThemeDirectory(), ...options }: Partial<GachaVersionOptions> = {},
) {
  return renderGachaVersion("sr", model, { ...options, themeDirectory });
}
