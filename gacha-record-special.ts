import { fileURLToPath } from "node:url";
import {
  renderGachaSpecialCard, type GachaSpecialCardOptions, type GachaSpecialMetric,
} from "@lotus-yunzai/skia/genshin-gacha-special";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import type { StarRailRecordDraw } from "./gacha-record-source.ts";
import type { StarRailGachaSpecialOptions } from "./gacha-special.ts";
import type { StarRailUigfPool } from "./gacha-uigf.ts";

const pools = [
  { pool: "GachaType_AvatarUp", code: "11", type: 11, name: "角色", max: 90, featured: true },
  { pool: "GachaType_CollabAvatarUp", code: "21", type: 21, name: "角色联动", max: 90, featured: true },
  { pool: "GachaType_EquipmentUp", code: "12", type: 12, name: "光锥", max: 80, featured: true },
  { pool: "GachaType_CollabEquipmentUp", code: "22", type: 22, name: "光锥联动", max: 80, featured: true },
  { pool: "GachaType_Standard", code: "1", type: 1, name: "常驻", max: 90, featured: false },
  { pool: "GachaType_Newbie", code: "2", type: 2, name: "新手", max: undefined, featured: false },
] as const satisfies readonly {
  pool: Exclude<StarRailGachaSpecialOptions["pool"], "all">;
  code: StarRailUigfPool; type: number; name: string; max?: number; featured: boolean;
}[];

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});
const defaultGenshinResources = fileURLToPath(new URL("../../data/starrail/genshin-theme", import.meta.url));

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
    [["未出五星", sinceFive, "抽"], ["已知五星", fiveNum, "个"],
      ["已知五星平均", knownIntervals ? Number((intervalDraws / knownIntervals).toFixed(1)) : undefined, "抽"],
      ["已知UP", pool.featured ? up : undefined, "个"], ["最长已知间隔", longest || undefined, "抽"]],
    [["已知出金间隔", knownIntervals, "条"], ["星级未记录", unknownRanks, "抽"],
      ["已知非UP", pool.featured ? offUp : undefined, "个"], ["UP未记录", pool.featured ? fiveNum - up - offUp : undefined, "个"],
      ["最短已知间隔", knownIntervals ? shortest : undefined, "抽"]],
  ];
  return {
    type: pool.type, typeName: pool.name, allNum: draws.length, fiveNum,
    max: pool.max, firstTime: fiveLog[0]?.date, lastTime: fiveLog.at(-1)?.date, fiveLog: fiveLog.reverse(), metrics,
  };
}

export function buildStarRailRecordSpecial({
  uid, draws, pool, maxRows = 48, page, resolvePool,
}: StarRailRecordSpecialOptions): StarRailRecordSpecialModel | undefined {
  if (!/^[1-9]\d*$/u.test(uid)) throw new TypeError("星铁抽卡显示 UID 无效。");
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || (page !== undefined && (!Number.isSafeInteger(page) || page < 1))) {
    throw new RangeError("星铁抽卡显示分页参数无效。");
  }
  const selected = pool === "all" ? pools : pools.filter((entry) => entry.pool === pool);
  if (!selected.length) throw new TypeError("星铁抽卡显示卡池无效。");
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
    uid, poolName: pool === "all" ? "全部" : selected[0]!.name,
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
