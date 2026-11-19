import { renderMiaoGachaVersion, type MiaoGachaVersionOptions } from "@lotus-yunzai/skia/miao-gacha-version";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import type { StarRailGachaVersionModel } from "./gacha-version.ts";

export function renderStarRailGachaVersion(
  model: StarRailGachaVersionModel,
  { themeDirectory = starRailGachaThemeDirectory(), ...options }: Partial<MiaoGachaVersionOptions> = {},
) {
  return renderMiaoGachaVersion("sr", model, { ...options, themeDirectory });
}
