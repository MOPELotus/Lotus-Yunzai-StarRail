import {
  matchStarRailRecordPeriod, starRailRecordPeriods, starRailRecordUp, type StarRailRecordDraw,
} from "./gacha-record-source.ts";
import type { StarRailGachaSchedulePeriod, StarRailGachaVersionModel, StarRailGachaVersionOptions } from "./gacha-version.ts";

type Selection = NonNullable<StarRailGachaVersionOptions["type"]>;
type Version = StarRailGachaVersionModel["gacha"];
type Group = Version["versionData"][number];
type GroupName = Pick<Group, "version" | "half" | "from" | "to" | "name" | "unassigned">;
type Item = Version["itemMap"][string];
type ItemCount = Group["items"][number];

const selections: Record<Selection, { readonly pools: readonly StarRailRecordDraw["pool"][]; readonly name: string; readonly aggregate?: string }> = {
  up: { pools: ["11", "12"], name: "抽卡" },
  char: { pools: ["11"], name: "角色" },
  weapon: { pools: ["12"], name: "光锥" },
  normal: { pools: ["1"], name: "常驻", aggregate: "常驻池" },
  all: { pools: ["11", "12", "1"], name: "全部", aggregate: "全部统计" },
};
const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
});

export interface StarRailRecordVersionOptions {
  readonly uid: string;
  readonly draws: readonly StarRailRecordDraw[];
  readonly face: StarRailGachaVersionModel["face"];
  readonly type?: Selection;
  readonly schedule: readonly StarRailGachaSchedulePeriod[];
  readonly maxRows?: number;
  readonly page?: number;
}

function bucket() {
  const stats: Group["stats"] = {
    w5Num: 0, w5UpNum: 0, c5Num: 0, c5UpNum: 0, c4Num: 0, w4Num: 0, w3Num: 0,
    upNum: 0, star5Num: 0, star4Num: 0, totalNum: 0,
  };
  return { stats, items: new Map<string, ItemCount>() };
}
type Bucket = ReturnType<typeof bucket>;

function recordDraw({ stats, items }: Bucket, id: string, rank: StarRailRecordDraw["rank"], kind: StarRailRecordDraw["item"]["kind"], up: boolean) {
  stats.totalNum++;
  if (rank === undefined) return;
  const previous = items.get(id);
  items.set(id, { id, star: rank, num: (previous?.num ?? 0) + 1, isUp: previous?.isUp || up ? 1 : 0 });
  if (rank === 5) {
    stats.star5Num++;
    if (kind === "char") {
      stats.c5Num++;
      if (up) stats.c5UpNum++;
    } else if (kind === "weapon") {
      stats.w5Num++;
      if (up) stats.w5UpNum++;
    }
    if (up) stats.upNum++;
  } else if (rank === 4) {
    stats.star4Num++;
    if (kind === "char") stats.c4Num++;
    if (kind === "weapon") stats.w4Num++;
  } else if (kind === "weapon") {
    stats.w3Num++;
  }
}

function compact({ items, stats }: Bucket, name: GroupName, itemMap: Readonly<Record<string, Item>>): Group {
  const rows = [...items.values()].sort((a, b) =>
    b.star - a.star || b.num - a.num || b.isUp - a.isUp || b.id.length - a.id.length || b.id.localeCompare(a.id, "en"));
  return {
    ...name, stats, items: rows,
    upIds: Object.fromEntries(rows.filter(({ isUp }) => isUp).map(({ id }) => [id, itemMap[id]!.name])),
  };
}

export function buildStarRailRecordVersion({
  uid, draws, face, type = "up", schedule, maxRows = 10, page,
}: StarRailRecordVersionOptions): StarRailGachaVersionModel | undefined {
  if (!/^[1-9]\d*$/u.test(uid) || !Object.hasOwn(selections, type)) throw new TypeError("星铁抽卡统计 UID 或卡池无效。");
  if (!Number.isSafeInteger(maxRows) || maxRows < 0 || (page !== undefined && (!Number.isSafeInteger(page) || page < 1))) {
    throw new RangeError("星铁抽卡统计分页参数无效。");
  }

  const selected = selections[type];
  const periods = starRailRecordPeriods(schedule).map((period) => ({ ...period, draws: bucket() }));
  const all = bucket();
  const unknown = bucket();
  const itemMap: Record<string, Item> = Object.create(null);
  const abbreviations = new Map<string, string>();
  let unclassified = 0;
  let completeUp = true;
  for (const draw of draws) {
    const { pool, rank, item } = draw;
    if (!selected.pools.includes(pool)) continue;
    const { kind, name, abbr, img } = item;
    if (kind === "char") abbreviations.set(name, abbr);
    let id = item.id;
    if (rank === undefined) unclassified++;
    else {
      const prior = itemMap[id];
      if (prior && (prior.star !== rank || prior.type !== kind)) id = `${id}:${rank}:${kind ?? "unknown"}`;
      itemMap[id] ??= { name, abbr, img, type: kind, star: rank, count: 0 };
    }
    const period = matchStarRailRecordPeriod(periods, draw);
    const up = starRailRecordUp(draw, period);
    if (pool !== "1" && (rank === undefined || (rank === 5 && up === undefined))) completeUp = false;
    recordDraw(all, id, rank, kind, up === true);
    if (!selected.aggregate) recordDraw(period?.draws ?? unknown, id, rank, kind, up === true);
  }
  if (!all.stats.totalNum) return;

  let rows: Group[];
  if (selected.aggregate) {
    rows = [compact(all, { version: selected.aggregate, half: "", from: "", to: "", name: "" }, itemMap)];
  } else {
    rows = periods.filter(({ draws }) => draws.stats.totalNum > 0).sort((a, b) => b.start - a.start)
      .map(({ version, half, start, end, name, char5, draws }) => compact(draws, {
        version, half, from: dateFormat.format(start).slice(2), to: dateFormat.format(end).slice(2),
        name: name ?? char5?.map((char) => abbreviations.get(char) ?? char).join(" / ") ?? "",
      }, itemMap));
    if (unknown.stats.totalNum) rows.push(compact(unknown, {
      version: "未判定期次", half: "", from: "", to: "", name: "", unassigned: true,
    }, itemMap));
  }

  const totalStat: Version["totalStat"] = {
    ...all.stats,
    avgUpNum: completeUp && all.stats.upNum ? (all.stats.totalNum / all.stats.upNum).toFixed(1) : 0,
    unassignedDraws: unknown.stats.totalNum, unassignedFiveStars: unknown.stats.star5Num,
    ...(unclassified ? { unclassifiedDraws: unclassified } : {}),
  };
  const count = rows.length;
  const total = maxRows ? Math.max(1, Math.ceil(count / maxRows)) : 1;
  if (page !== undefined && page > total) throw new RangeError("星铁抽卡统计页码超出范围。");
  const from = maxRows ? ((page ?? 1) - 1) * maxRows : 0;
  const to = maxRows ? Math.min(count, from + maxRows) : count;
  const pageInfo = page !== undefined && total > 1 ? { page, total, from: from + 1, to, count } : undefined;
  const limited = page === undefined && to < count ? { shownNum: to, hiddenNum: count - to } : undefined;
  return { uid, recordArchive: true, face, poolName: selected.name, pageInfo,
    gacha: { versionData: rows.slice(from, to), itemMap, totalStat, isMix: false, ...limited } };
}
