import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { builtinResourceDirectory } from "../../lib/builtin-resources.ts";
import { fileURLToPath } from "node:url";
import { renderGachaSpecialCard, type GachaSpecialCardOptions, type GachaSpecialMetric } from "@lotus-yunzai/skia/genshin-gacha-special";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import type { StarRailGachaSpecialModel } from "./gacha-special.ts";

type Pool = StarRailGachaSpecialModel["pools"][number];
const defaultGenshinResources = builtinResourceDirectory("games/genshin");

function metrics(pool: Pool): readonly (readonly GachaSpecialMetric[])[] {
  // The API only supplies real five-star rows and aggregate counts. Extremes need the full visible list.
  const intervals = pool.fiveLog.flatMap(({ num }) => num === undefined ? [] : [num]);
  const extremesKnown = pool.shownNum === pool.fiveNum && intervals.length > 0;
  return [
    [[$t("gacha-special-card.text_8ac5c1b37e"), pool.pity, $t("gacha-special-card.text_7364d39606")], [$t("gacha-special-card.text_789a6953ec"), pool.fiveNum, $t("gacha-special-card.text_3a116815bc")],
      [pool.knownIntervals === pool.fiveNum ? $t("gacha-special-card.text_0ca64e208f") : $t("gacha-special-card.text_9ecfe0f922"), pool.fiveAvg, $t("gacha-special-card.text_7364d39606")],
      [$t("gacha-special-card.text_bc312785ec"), pool.upNum, $t("gacha-special-card.text_3a116815bc")], [$t("gacha-special-card.text_2bdfa501ab"), extremesKnown ? Math.max(...intervals) : undefined, $t("gacha-special-card.text_7364d39606")]],
    [[$t("gacha-special-card.text_269b9bef9c"), pool.knownIntervals, $t("gacha-special-card.text_f004f1d84c")], [$t("gacha-special-card.text_eef15e9a83"), pool.unknownDraws, $t("gacha-special-card.text_7364d39606")],
      [$t("gacha-special-card.text_5384f7f10c"), pool.notUpNum, $t("gacha-special-card.text_3a116815bc")], [$t("gacha-special-card.text_3a1484234f"), pool.unknownUpNum, $t("gacha-special-card.text_3a116815bc")],
      [$t("gacha-special-card.text_faee43fcf4"), extremesKnown ? Math.min(...intervals) : undefined, $t("gacha-special-card.text_7364d39606")]],
  ];
}

export function renderStarRailGachaSpecial(
  model: StarRailGachaSpecialModel,
  { themeDirectory = starRailGachaThemeDirectory(), ...options }: Partial<GachaSpecialCardOptions> = {},
) {
  const genshinResourceDirectory = options.genshinResourceDirectory ??
    (Bun.env.LOTUS_STAR_RAIL_GACHA_GENSHIN_RESOURCES_DIR?.trim() || defaultGenshinResources);
  return renderGachaSpecialCard("sr", {
    uid: model.uid, crossPool: model.poolName === "全部", pageInfo: model.pageInfo,
    pools: model.pools.map((pool) => ({ ...pool, metrics: metrics(pool) })),
  }, { ...options, themeDirectory, genshinResourceDirectory });
}
