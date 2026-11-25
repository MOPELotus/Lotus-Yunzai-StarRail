import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { StarRailGachaDetailOptions } from "./gacha-detail.ts";
import { officialStarRailGachaSource, officialStarRailGachaTime } from "./gacha-time.ts";

const pools = {
  GachaType_AvatarUp: { legacy: "11", itemType: "char" },
  GachaType_EquipmentUp: { legacy: "12", itemType: "weapon" },
  GachaType_Standard: { legacy: "1", itemType: null },
} as const;
type Pool = keyof typeof pools;
type Selection = "up" | "char" | "weapon" | "normal" | "all";

const selection: Record<Selection, { pools: readonly Pool[]; name: string; aggregate?: string }> = {
  up: { pools: ["GachaType_AvatarUp", "GachaType_EquipmentUp"], name: $t("gacha-version.text_02d44306fd") },
  char: { pools: ["GachaType_AvatarUp"], name: "角色" },
  weapon: { pools: ["GachaType_EquipmentUp"], name: "光锥" },
  normal: { pools: ["GachaType_Standard"], name: $t("gacha-version.text_300b6634fe"), aggregate: $t("gacha-version.text_d0cf5ec4c8") },
  all: { pools: ["GachaType_AvatarUp", "GachaType_EquipmentUp", "GachaType_Standard"], name: $t("gacha-version.text_5c55a67935"), aggregate: $t("gacha-version.text_5336683ac2") },
};

export interface StarRailGachaSchedulePeriod {
  readonly version: string;
  readonly half: string;
  readonly from: string;
  readonly to: string;
  readonly name?: string;
  readonly char5?: readonly string[];
  readonly weapon5?: readonly string[];
  readonly gachaIds?: Readonly<Partial<Record<Pool, readonly string[]>>>;
}

interface Item {
  readonly type?: "char" | "weapon" | undefined;
  readonly count: 0;
  readonly name: string;
  readonly abbr: string;
  readonly star: 3 | 4 | 5;
  readonly img: string;
}

interface Stats {
  w5Num: number;
  w5UpNum: number;
  c5Num: number;
  c5UpNum: number;
  c4Num: number;
  w4Num: number;
  w3Num: number;
  upNum: number;
  star5Num: number;
  star4Num: number;
  totalNum: number;
}

interface Group {
  readonly version: string;
  readonly half: string;
  readonly from: string;
  readonly to: string;
  readonly name: string;
  readonly upIds: Readonly<Record<string, string>>;
  readonly items: readonly { id: string; num: number; star: 3 | 4 | 5; isUp: 0 | 1 }[];
  readonly stats: Stats;
  readonly unassigned?: true;
}

export interface StarRailGachaVersionModel {
  readonly uid: string;
  readonly recordArchive?: true;
  readonly face: StarRailGachaDetailOptions["face"];
  readonly poolName: string;
  readonly gacha: {
    readonly versionData: readonly Group[];
    readonly itemMap: Readonly<Record<string, Item>>;
    readonly totalStat: Stats & {
      readonly avgUpNum: string | 0;
      readonly unassignedDraws: number;
      readonly unassignedFiveStars: number;
      readonly unclassifiedDraws?: number;
    };
    readonly isMix: false;
    readonly shownNum?: number;
    readonly hiddenNum?: number;
  };
  readonly pageInfo?: { readonly page: number; readonly total: number; readonly from: number; readonly to: number; readonly count: number };
}

export interface StarRailGachaVersionOptions {
  readonly uid: string;
  readonly history: unknown;
  readonly face: StarRailGachaDetailOptions["face"];
  readonly type?: Selection;
  readonly schedule: readonly StarRailGachaSchedulePeriod[];
  readonly resolveItem?: StarRailGachaDetailOptions["resolveItem"];
  readonly maxRows?: number;
  readonly page?: number;
}

const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });

function timestamp(value: string): number {
  // Calendar-day-only values cannot prove which half contained a boundary-day pull.
  if (!/^\d{4}-\d{2}-\d{2}[ T](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/u.test(value)) return NaN;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number) as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return NaN;
  const iso = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/u.test(iso) ? iso : `${iso}+08:00`);
}

function day(time: number): string {
  return formatter.format(time).slice(2);
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : "";
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError($t("gacha-version.text_69e0e8620e"));
  return value as Record<string, unknown>;
}

function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError($t("gacha-version.text_d325e3a87b"));
  return value;
}

function count(value: unknown): number {
  const number = typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) {
    throw new TypeError($t("gacha-version.text_11b6f1494c"));
  }
  return number;
}

function readCounters(raw: Record<string, unknown>): Map<string, number> {
  const byCard = new Map<string, number>();
  for (const [id, draws] of Object.entries(object(raw.cardCounters ?? {}))) {
    if (!id.trim()) throw new TypeError($t("gacha-version.text_105c402800"));
    byCard.set(id, count(draws));
  }
  for (const entry of list(raw.cards ?? [])) {
    const card = object(entry);
    const id = text(card.gacha_id);
    const draws = count(card.total_count);
    if (!id && draws) throw new TypeError($t("gacha-version.text_105c402800"));
    if (id) byCard.set(id, Math.max(byCard.get(id) ?? 0, draws));
  }
  return byCard;
}

function actualFiveStars(value: unknown): boolean {
  const row = object(value);
  return row.rank_type !== "3" && row.rank_type !== 3 && row.rank_type !== "4" && row.rank_type !== 4 &&
    !/^lotus-\d+-\d+$/u.test(text(row.id));
}

function startStats(): Stats {
  return { w5Num: 0, w5UpNum: 0, c5Num: 0, c5UpNum: 0, c4Num: 0, w4Num: 0,
    w3Num: 0, upNum: 0, star5Num: 0, star4Num: 0, totalNum: 0 };
}

function bucket() {
  return {
    stats: startStats(),
    items: new Map<string, { id: string; num: number; star: 5; isUp: 0 | 1 }>(),
    draws: new Map<Pool, { stars: number; official: number }>(),
  };
}
type Bucket = ReturnType<typeof bucket>;

function drawsIn(group: Bucket, pool: Pool) {
  const result = group.draws.get(pool) ?? { stars: 0, official: 0 };
  group.draws.set(pool, result);
  return result;
}

function addStar(group: Bucket, id: string, item: Item, up: boolean, pool: Pool) {
  const prior = group.items.get(id);
  group.items.set(id, { id, star: 5, num: (prior?.num ?? 0) + 1, isUp: prior?.isUp || up ? 1 : 0 });
  drawsIn(group, pool).stars++;
  group.stats.star5Num++;
  if (item.type === "char") {
    group.stats.c5Num++;
    if (up) group.stats.c5UpNum++;
  } else if (item.type === "weapon") {
    group.stats.w5Num++;
    if (up) group.stats.w5UpNum++;
  }
  if (up) group.stats.upNum++;
}

function groupDraws(group: Bucket): number {
  return count([...group.draws.values()].reduce((sum, { stars, official }) => sum + Math.max(stars, official), 0));
}

function compact(
  group: Bucket, metadata: Pick<Group, "version" | "half" | "from" | "to" | "name" | "unassigned">,
  itemMap: Readonly<Record<string, Item>>, draws: number,
): Group {
  return {
    ...metadata, stats: { ...group.stats, totalNum: draws },
    items: [...group.items.values()].sort((a, b) => b.num - a.num || b.isUp - a.isUp || b.id.localeCompare(a.id, "en")),
    upIds: Object.fromEntries([...group.items.values()].filter(({ isUp }) => isUp).map(({ id }) => [id, itemMap[id]!.name])),
  };
}

function periodsFrom(schedule: readonly StarRailGachaSchedulePeriod[]) {
  return schedule.map((period) => {
    const start = timestamp(period.from);
    const end = timestamp(period.to);
    if (!period.version.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      throw new TypeError($t("gacha-version.text_9b92c882f1"));
    }
    return { ...period, start, end, bucket: bucket() };
  });
}

function single<T>(items: readonly T[]): T | undefined {
  return items.length === 1 ? items[0] : undefined;
}

export function buildStarRailGachaVersion({
  uid, history, face, type = "up", schedule, resolveItem, maxRows = 10, page,
}: StarRailGachaVersionOptions): StarRailGachaVersionModel | undefined {
  if (!/^[1-9]\d*$/u.test(uid)) throw new TypeError($t("gacha-version.text_1bd529e95c"));
  if (!Object.hasOwn(selection, type)) throw new TypeError($t("gacha-version.text_d6f76465a2"));
  if (!Number.isSafeInteger(maxRows) || maxRows < 0 || (page !== undefined && (!Number.isSafeInteger(page) || page < 1))) {
    throw new RangeError($t("gacha-version.text_a3d96943ab"));
  }

  const selected = selection[type];
  const log = object(history ?? {});
  if (log.uid != null && text(log.uid) !== uid) throw new Error($t("gacha-version.text_47b82edd05"));
  const historyPools = object(log.pools ?? {});
  const isMiniapp = log.source === officialStarRailGachaSource;
  const periods = periodsFrom(schedule);
  const itemMap: Record<string, Item> = Object.create(null);
  const all = bucket();
  const unknown = bucket();
  let allDraws = 0;

  for (const pool of selected.pools) {
    const raw = object(historyPools[pool] ?? {});
    const counters = readCounters(raw);
    const ids = new Set<string>();
    let intervals = 0;
    const sourceRows = list(raw.fiveStars ?? []).filter(actualFiveStars).map(object);
    const idsByUuid = new Map<string, string>();
    for (const row of sourceRows) {
      const id = text(row.id);
      const uuid = text(row.uuid);
      if (!id || !uuid) continue;
      if (idsByUuid.has(uuid) && idsByUuid.get(uuid) !== id) throw new Error($t("gacha-version.text_bbb72c798d"));
      idsByUuid.set(uuid, id);
    }
    for (const row of sourceRows) {
      const uuid = text(row.uuid);
      const pullId = text(row.id) || idsByUuid.get(uuid) || uuid;
      if (!pullId) throw new TypeError($t("gacha-version.text_3179611f22"));
      if (ids.has(pullId)) continue;
      ids.add(pullId);

      const sourceItem = object(row.item ?? {});
      const name = text(sourceItem.name) || $t("gacha-version.text_4d8c1c5b42");
      const isWeapon = sourceItem.item_type === "ItemType_Equipment" || sourceItem.item_type === "ItemType_Weapon";
      const itemType = sourceItem.item_type === "ItemType_Avatar" ? "char" : isWeapon ? "weapon" : pools[pool].itemType;
      const time = text(row.time) || text(row.legacy_time);
      const occurred = !time && isMiniapp ? officialStarRailGachaTime(row.id) : timestamp(time);
      // The old schedule declares priority for the rare overlapping window.
      const period = periods.find(({ start, end }) => occurred >= start && occurred <= end);
      const metadata = itemType && resolveItem?.({
        id: pullId, uid, name, item_type: itemType === "char" ? "角色" : "光锥", rank_type: "5",
        gacha_type: pools[pool].legacy, time: time || (period ? new Date(occurred).toISOString() : ""),
        ...(typeof row.is_up === "boolean" ? { is_up: row.is_up } : {}),
      });
      const key = metadata ? String(metadata.id) : `${itemType ?? "unknown"}:${name}`;
      const item = itemMap[key] ??= {
        type: itemType ?? undefined, count: 0, star: 5,
        name: metadata?.name ?? name, abbr: metadata?.abbr ?? name, img: metadata?.img ?? "",
      };
      const featured = itemType === "char" ? period?.char5 : itemType === "weapon" ? period?.weapon5 : undefined;
      const up = typeof row.is_up === "boolean" ? row.is_up : pool !== "GachaType_Standard" && (featured?.includes(item.name) ?? false);

      addStar(all, key, item, up, pool);
      addStar(period?.bucket ?? unknown, key, item, up, pool);
      intervals = count(intervals + Math.max(1, count(row.gacha_count ?? 0)));
    }

    let byCard = 0;
    for (const [id, draws] of counters) {
      byCard = count(byCard + draws);
      const period = single(periods.filter(({ gachaIds }) => gachaIds?.[pool]?.includes(id)));
      if (period) {
        const local = drawsIn(period.bucket, pool);
        local.official = count(local.official + draws);
      }
    }
    allDraws = count(allDraws + Math.max(count(raw.totalDraws ?? 0), byCard, count(intervals + count(raw.pity ?? 0))));
  }

  const datedDraws = count(periods.reduce((sum, period) => sum + groupDraws(period.bucket), 0));
  const totalNum = Math.max(allDraws, datedDraws);
  if (!totalNum) return;

  let rows: Group[];
  if (selected.aggregate) {
    rows = [compact(all, { version: selected.aggregate, half: "", from: "", to: "", name: "" }, itemMap, totalNum)];
  } else {
    rows = periods.toSorted((a, b) => b.start - a.start).flatMap((period) => {
      const draws = groupDraws(period.bucket);
      return draws ? [compact(period.bucket, {
        version: period.version, half: period.half, from: day(period.start), to: day(period.end),
        name: period.name ?? period.char5?.join(" / ") ?? "",
      }, itemMap, draws)] : [];
    });
    if (unknown.stats.star5Num) rows.push(compact(unknown, {
      version: $t("gacha-version.text_2e59e4b5fc"), half: "", from: "", to: "", name: "", unassigned: true,
    }, itemMap, unknown.stats.star5Num));
  }

  const totalStat = {
    ...all.stats, totalNum, avgUpNum: all.stats.upNum ? (totalNum / all.stats.upNum).toFixed(1) : 0 as const,
    unassignedDraws: selected.aggregate ? 0 : totalNum - datedDraws,
    unassignedFiveStars: selected.aggregate ? 0 : unknown.stats.star5Num,
  };
  const length = rows.length;
  let pageInfo: StarRailGachaVersionModel["pageInfo"];
  let clipped: { shownNum: number; hiddenNum: number } | undefined;
  if (page !== undefined) {
    const total = maxRows ? Math.max(1, Math.ceil(length / maxRows)) : 1;
    if (page > total) throw new RangeError($t("gacha-version.text_0a9b27f96e"));
    const from = (page - 1) * maxRows;
    const to = maxRows ? Math.min(length, from + maxRows) : length;
    if (total > 1) pageInfo = { page, total, from: from + 1, to, count: length };
    rows = rows.slice(from, to);
  } else if (maxRows > 0 && length > maxRows) {
    clipped = { shownNum: maxRows, hiddenNum: length - maxRows };
    rows = rows.slice(0, maxRows);
  }
  return {
    uid, face, poolName: selected.name, pageInfo,
    gacha: { versionData: rows, itemMap, totalStat, isMix: false, ...clipped },
  };
}
