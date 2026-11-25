import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { builtinResourceDirectory } from "../../lib/builtin-resources.ts";
import { fileURLToPath } from "node:url";
import {
  renderGachaSpecialCard, type GachaSpecialCardOptions, type GachaSpecialMetric,
} from "@lotus-yunzai/skia/genshin-gacha-special";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import type { StarRailRecordDraw } from "./gacha-record-source.ts";
import type { StarRailGachaSpecialOptions } from "./gacha-special.ts";
import type { StarRailUigfPool } from "./gacha-uigf.ts";

const pools = [
  { pool: "GachaType_AvatarUp", code: "11", type: 11, name: $t("gacha-record-special.text_c47b54e84e"), max: 90, featured: true },
  { pool: "GachaType_CollabAvatarUp", code: "21", type: 21, name: $t("gacha-record-special.text_957dff2ffa"), max: 90, featured: true },
  { pool: "GachaType_EquipmentUp", code: "12", type: 12, name: $t("gacha-record-special.text_e733238b28"), max: 80, featured: true },
  { pool: "GachaType_CollabEquipmentUp", code: "22", type: 22, name: $t("gacha-record-special.text_7085c8362b"), max: 80, featured: true },
  { pool: "GachaType_Standard", code: "1", type: 1, name: $t("gacha-record-special.text_300b6634fe"), max: 90, featured: false },
  { pool: "GachaType_Newbie", code: "2", type: 2, name: $t("gacha-record-special.text_dcfce30c45"), max: undefined, featured: false },
] as const satisfies readonly {
  pool: Exclude<StarRailGachaSpecialOptions["pool"], "all">;
  code: StarRailUigfPool; type: number; name: string; max?: number; featured: boolean;
}[];

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});
const defaultGenshinResources = builtinResourceDirectory("games/genshin");

type Pool = typeof pools[number];
type ResolvePool = (draw: StarRailRecordDraw) => { readonly isUp?: boolean } | undefined;
type FiveStar = {
  readonly id: string;
  readonly name: string;
  readonly abbr: string;
  readonly icon?: string;
  readonly num?: number;
  readonly isUp?: boolean;
  readonly date: string;
};

export interface StarRailRecordSpecialModel {
  readonly uid: string;
  readonly poolName: Pool["name"] | "全部";
  readonly pools: readonly {
    readonly type: Pool["type"];
    readonly typeName: Pool["name"];
    readonly allNum: number;
    readonly fiveNum: number;
    readonly max?: number;
    readonly firstTime?: string;
    readonly lastTime?: string;
    readonly fiveLog: readonly FiveStar[];
    readonly shownNum: number;
    readonly hiddenNum: number;
    readonly metrics: readonly (readonly GachaSpecialMetric[])[];
  }[];
  readonly totalDraws: number;
  readonly fiveNum: number;
  readonly pageInfo?: { readonly page: number; readonly total: number; readonly from: number; readonly to: number; readonly count: number };
}

export interface StarRailRecordSpecialOptions {
  readonly uid: string;
  readonly draws: readonly StarRailRecordDraw[];
  readonly pool: StarRailGachaSpecialOptions["pool"];
  readonly maxRows?: number;
  readonly page?: number;
  readonly resolvePool?: ResolvePool;
}

function compareDraws(a: StarRailRecordDraw, b: StarRailRecordDraw): number {
  return a.at - b.at || a.id.length - b.id.length || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);
}

function summarize(pool: Pool, draws: StarRailRecordDraw[], resolvePool?: ResolvePool) {
  const fiveLog: FiveStar[] = [];
  let sinceFive: number | undefined;
  let unknownRanks = 0, knownIntervals = 0, intervalDraws = 0, up = 0, offUp = 0;
  let shortest = Infinity, longest = 0;
  for (const draw of draws.sort(compareDraws)) {
    if (draw.rank === undefined) {
      unknownRanks++;
      sinceFive = undefined;
      continue;
    }
    if (sinceFive !== undefined) sinceFive++;
    if (draw.rank !== 5) continue;

    // The archive does not prove how many draws came before its first five-star.
    if (sinceFive !== undefined) {
      knownIntervals++;
      intervalDraws += sinceFive;
      shortest = Math.min(shortest, sinceFive);
      longest = Math.max(longest, sinceFive);
    }
    const isUp = pool.featured ? resolvePool?.(draw)?.isUp : undefined;
    if (isUp === true) up++;
    if (isUp === false) offUp++;
    fiveLog.push({
      id: draw.id, name: draw.item.name, abbr: draw.item.abbr,
      ...(draw.item.img ? { icon: draw.item.img } : {}),
      ...(sinceFive === undefined ? {} : { num: sinceFive }),
      ...(typeof isUp === "boolean" ? { isUp } : {}), date: dateFormat.format(draw.at),
    });
    sinceFive = 0;
  }
  const fiveNum = fiveLog.length;
  const metrics: readonly (readonly GachaSpecialMetric[])[] = [
    [[$t("gacha-record-special.text_8ac5c1b37e"), sinceFive, $t("gacha-record-special.text_7364d39606")], [$t("gacha-record-special.text_63ddd6aa0e"), fiveNum, $t("gacha-record-special.text_3a116815bc")],
      [$t("gacha-record-special.text_9ecfe0f922"), knownIntervals ? Number((intervalDraws / knownIntervals).toFixed(1)) : undefined, $t("gacha-record-special.text_7364d39606")],
      [$t("gacha-record-special.text_bc312785ec"), pool.featured ? up : undefined, $t("gacha-record-special.text_3a116815bc")], [$t("gacha-record-special.text_2bdfa501ab"), longest || undefined, $t("gacha-record-special.text_7364d39606")]],
    [[$t("gacha-record-special.text_269b9bef9c"), knownIntervals, $t("gacha-record-special.text_f004f1d84c")], [$t("gacha-record-special.text_bb1a174add"), unknownRanks, $t("gacha-record-special.text_7364d39606")],
      [$t("gacha-record-special.text_5384f7f10c"), pool.featured ? offUp : undefined, $t("gacha-record-special.text_3a116815bc")], [$t("gacha-record-special.text_3a1484234f"), pool.featured ? fiveNum - up - offUp : undefined, $t("gacha-record-special.text_3a116815bc")],
      [$t("gacha-record-special.text_faee43fcf4"), knownIntervals ? shortest : undefined, $t("gacha-record-special.text_7364d39606")]],
  ];
  return {
    type: pool.type, typeName: pool.name, allNum: draws.length, fiveNum,
    max: pool.max, firstTime: fiveLog[0]?.date, lastTime: fiveLog.at(-1)?.date, fiveLog: fiveLog.reverse(), metrics,
  };
}

export function buildStarRailRecordSpecial({
  uid, draws, pool, maxRows = 48, page, resolvePool,
}: StarRailRecordSpecialOptions): StarRailRecordSpecialModel | undefined {
  if (!/^[1-9]\d*$/u.test(uid)) throw new TypeError($t("gacha-record-special.text_7a9a5a67d7"));
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || (page !== undefined && (!Number.isSafeInteger(page) || page < 1))) {
    throw new RangeError($t("gacha-record-special.text_e356344050"));
  }
  const selected = pool === "all" ? pools : pools.filter((entry) => entry.pool === pool);
  if (!selected.length) throw new TypeError($t("gacha-record-special.text_9febac977d"));
  const byPool = new Map<StarRailUigfPool, StarRailRecordDraw[]>();
  for (const draw of draws) {
    const existing = byPool.get(draw.pool);
    if (existing) existing.push(draw);
    else byPool.set(draw.pool, [draw]);
  }
  const summaries = selected.flatMap((entry) => {
    const entries = byPool.get(entry.code);
    return entries ? [summarize(entry, entries, resolvePool)] : [];
  });
  if (!summaries.length) return;

  const count = Math.max(...summaries.map(({ fiveNum }) => fiveNum));
  const total = Math.max(1, Math.ceil(count / maxRows));
  if (page !== undefined && page > total) return;
  const start = ((page ?? 1) - 1) * maxRows;
  const end = Math.min(start + maxRows, count);
  return {
    uid, poolName: pool === "all" ? $t("gacha-record-special.text_5c55a67935") : selected[0]!.name,
    totalDraws: summaries.reduce((sum, entry) => sum + entry.allNum, 0),
    fiveNum: summaries.reduce((sum, entry) => sum + entry.fiveNum, 0),
    pools: summaries.map((entry) => {
      const fiveLog = entry.fiveLog.slice(start, end);
      return { ...entry, fiveLog, shownNum: fiveLog.length, hiddenNum: entry.fiveNum - fiveLog.length };
    }),
    ...(page === undefined ? {} : { pageInfo: { page, total, from: count ? start + 1 : 0, to: end, count } }),
  };
}

export function renderStarRailRecordSpecial(
  model: StarRailRecordSpecialModel,
  { themeDirectory = starRailGachaThemeDirectory(), ...options }: Partial<GachaSpecialCardOptions> = {},
) {
  const genshinResourceDirectory = options.genshinResourceDirectory ??
    (Bun.env.LOTUS_STAR_RAIL_GACHA_GENSHIN_RESOURCES_DIR?.trim() || defaultGenshinResources);
  return renderGachaSpecialCard("sr", {
    uid: model.uid, crossPool: model.poolName === "全部", pageInfo: model.pageInfo, pools: model.pools,
  }, { ...options, themeDirectory, genshinResourceDirectory });
}
