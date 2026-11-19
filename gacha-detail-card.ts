import { renderMiaoGachaDetail, type MiaoGachaDetailOptions } from "@lotus-yunzai/skia/miao-gacha-detail";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import type { StarRailGachaDetailModel } from "./gacha-detail.ts";

export function renderStarRailGachaDetail(
  model: StarRailGachaDetailModel,
  { themeDirectory = starRailGachaThemeDirectory(), ...options }: Partial<MiaoGachaDetailOptions> = {},
) {
  return renderMiaoGachaDetail("sr", model, { ...options, themeDirectory });
}
