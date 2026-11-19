import { renderGachaDetail, type GachaDetailOptions } from "@lotus-yunzai/skia/gacha-detail";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import type { StarRailGachaDetailModel } from "./gacha-detail.ts";

export function renderStarRailGachaDetail(
  model: StarRailGachaDetailModel,
  { themeDirectory = starRailGachaThemeDirectory(), ...options }: Partial<GachaDetailOptions> = {},
) {
  return renderGachaDetail("sr", model, { ...options, themeDirectory });
}
