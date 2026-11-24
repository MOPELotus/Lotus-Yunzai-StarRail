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
    [["未出五星", pool.pity, "抽"], ["五星", pool.fiveNum, "个"],
      [pool.knownIntervals === pool.fiveNum ? "五星平均" : "已知五星平均", pool.fiveAvg, "抽"],
      ["已知UP", pool.upNum, "个"], ["最长已知间隔", extremesKnown ? Math.max(...intervals) : undefined, "抽"]],
    [["已知出金间隔", pool.knownIntervals, "条"], ["未归属抽数", pool.unknownDraws, "抽"],
      ["已知非UP", pool.notUpNum, "个"], ["UP未记录", pool.unknownUpNum, "个"],
      ["最短已知间隔", extremesKnown ? Math.min(...intervals) : undefined, "抽"]],
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
