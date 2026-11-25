import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { StarRailGachaPool } from "@lotus-yunzai/hoyo-client";
import type { StarRailGachaDetailOptions } from "./gacha-detail.ts";
import { officialStarRailGachaSource, officialStarRailGachaTime } from "./gacha-time.ts";

const poolInfo = {
  GachaType_AvatarUp: { type: 11, typeName: "角色", max: 90 },
  GachaType_CollabAvatarUp: { type: 21, typeName: $t("gacha-special.text_957dff2ffa"), max: 90 },
  GachaType_EquipmentUp: { type: 12, typeName: "光锥", max: 80 },
  GachaType_CollabEquipmentUp: { type: 22, typeName: $t("gacha-special.text_7085c8362b"), max: 80 },
  GachaType_Standard: { type: 1, typeName: $t("gacha-special.text_300b6634fe"), max: 90 },
  GachaType_Newbie: { type: 2, typeName: $t("gacha-special.text_dcfce30c45"), max: undefined },
} as const satisfies Record<StarRailGachaPool, { type: number; typeName: string; max: number | undefined }>;

type PoolInfo = typeof poolInfo[StarRailGachaPool];
type RecordData = Record<string, unknown>;

interface FiveStarRow {
  readonly id: string;
  readonly name: string;
  readonly abbr: string;
  readonly icon?: string;
  readonly itemType?: "角色" | "光锥";
  readonly cardId?: string;
  readonly num?: number;
  readonly date?: string;
  readonly isUp?: boolean;
}

interface SpecialPool {
  readonly type: PoolInfo["type"];
  readonly typeName: PoolInfo["typeName"];
  readonly max?: number;
  readonly allNum: number;
  readonly pity?: number;
  readonly fiveNum: number;
  readonly fiveAvg?: number;
  readonly knownIntervals: number;
  readonly unknownDraws: number;
  readonly upNum: number;
  readonly notUpNum: number;
  readonly unknownUpNum: number;
  readonly firstTime?: string;
  readonly lastTime?: string;
  readonly fiveLog: readonly FiveStarRow[];
  readonly shownNum: number;
  readonly hiddenNum: number;
}

export interface StarRailGachaSpecialModel {
  readonly uid: string;
  readonly poolName: PoolInfo["typeName"] | "全部";
  readonly pools: readonly SpecialPool[];
  readonly totalDraws: number;
  readonly fiveNum: number;
  readonly pageInfo?: { readonly page: number; readonly total: number; readonly from: number; readonly to: number; readonly count: number };
}

export interface StarRailGachaSpecialOptions {
  readonly uid: string;
  readonly history: unknown;
  readonly pool: StarRailGachaPool | "all";
  readonly resolveItem?: StarRailGachaDetailOptions["resolveItem"];
  readonly now?: Date;
  readonly maxRows?: number;
  readonly page?: number;
}

const launch = Date.UTC(2023, 3, 25, 22);
const shanghaiTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

function object(value: unknown): RecordData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError($t("gacha-special.text_69e0e8620e"));
  return value as RecordData;
}

function list(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError($t("gacha-special.text_d325e3a87b"));
  return value;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : "";
}

function count(value: unknown): number {
  const number = typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) {
    throw new TypeError($t("gacha-special.text_11b6f1494c"));
  }
  return number;
}

function cardDraws(pool: RecordData): number {
  const counters = new Map<string, number>();
  for (const [id, value] of Object.entries(object(pool.cardCounters ?? {}))) {
    if (!id.trim()) throw new TypeError($t("gacha-special.text_105c402800"));
    counters.set(id, count(value));
  }
  for (const value of list(pool.cards ?? [])) {
    const card = object(value);
    const id = text(card.gacha_id);
    const draws = count(card.total_count);
    if (!id && draws) throw new TypeError($t("gacha-special.text_105c402800"));
    if (id) counters.set(id, Math.max(counters.get(id) ?? 0, draws));
  }
  return count([...counters.values()].reduce((sum, draws) => sum + draws, 0));
}

function explicitTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}[ T](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/u.test(value)) return NaN;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number) as [number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return NaN;
  const iso = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/u.test(iso) ? iso : iso + "+08:00");
}

function timeOf(row: RecordData, isOfficialHistory: boolean, now: number): number | undefined {
  const explicit = text(row.time) || text(row.legacy_time);
  const time = explicit ? explicitTime(explicit) : isOfficialHistory ? officialStarRailGachaTime(row.id) : NaN;
  return time >= launch && time <= now ? time : undefined;
}

function deduplicate(values: unknown): ReadonlyMap<string, RecordData> {
  const rows = list(values).map(object).filter((row) => {
    const rank = row.rank_type == null ? "5" : text(row.rank_type);
    return rank === "5" && !/^lotus-\d+-\d+$/u.test(text(row.id));
  });
  const byUuid = new Map<string, string>();
  for (const row of rows) {
    const id = text(row.id);
    const uuid = text(row.uuid);
    if (!id || !uuid) continue;
    if (byUuid.has(uuid) && byUuid.get(uuid) !== id) throw new Error($t("gacha-special.text_bbb72c798d"));
    byUuid.set(uuid, id);
  }
  const unique = new Map<string, RecordData>();
  for (const row of rows) {
    const uuid = text(row.uuid);
    const id = text(row.id) || byUuid.get(uuid) || uuid;
    if (!id) throw new TypeError($t("gacha-special.text_3179611f22"));
    const known = unique.get(id);
    unique.set(id, known ? {
      ...row, ...known, id: text(known.id) || text(row.id), item: known.item ?? row.item,
      gacha_count: count(known.gacha_count ?? 0) ? known.gacha_count : row.gacha_count,
      is_up: typeof known.is_up === "boolean" ? known.is_up : row.is_up,
      time: text(known.time) || text(known.legacy_time) || text(row.time) || text(row.legacy_time),
    } : row);
  }
  return unique;
}

function itemTypeOf(item: RecordData): FiveStarRow["itemType"] {
  if (item.item_type === "ItemType_Avatar" || item.item_type === "角色") return "角色";
  if (["ItemType_Equipment", "ItemType_Weapon", "光锥", "武器"].includes(text(item.item_type))) return "光锥";
}

function readPool(
  info: PoolInfo, raw: RecordData, uid: string, isOfficialHistory: boolean, now: number,
  resolveItem: StarRailGachaSpecialOptions["resolveItem"],
): SpecialPool | undefined {
  const pity = raw.pity == null ? undefined : count(raw.pity);
  const fiveLog: FiveStarRow[] = [];
  let intervalDraws = 0, knownIntervals = 0, upNum = 0, notUpNum = 0;
  let first = Infinity, last = -Infinity;
  for (const [id, row] of deduplicate(raw.fiveStars ?? [])) {
    const item = object(row.item ?? {});
    const name = text(item.name) || $t("gacha-special.text_4d8c1c5b42");
    const itemType = itemTypeOf(item);
    const num = count(row.gacha_count ?? 0) || undefined;
    const time = timeOf(row, isOfficialHistory, now);
    const date = time === undefined ? undefined : shanghaiTime.format(time);
    const cardId = text(row.gacha_id) || undefined;
    const isUp = typeof row.is_up === "boolean" ? row.is_up : undefined;
    const metadata = itemType && resolveItem?.({
      id, uid, name, item_type: itemType, rank_type: "5", gacha_type: `${info.type}`,
      time: date ?? "", ...(isUp === undefined ? {} : { is_up: isUp }),
    });

    if (num !== undefined) {
      intervalDraws = count(intervalDraws + num);
      knownIntervals++;
    }
    if (time !== undefined) {
      first = Math.min(first, time);
      last = Math.max(last, time);
    }
    if (isUp === true) upNum++;
    if (isUp === false) notUpNum++;
    fiveLog.push({
      id, name: metadata?.name ?? name, abbr: metadata?.abbr ?? name,
      ...(metadata?.img ? { icon: metadata.img } : {}),
      ...(itemType ? { itemType } : {}), ...(cardId ? { cardId } : {}),
      ...(num !== undefined ? { num } : {}), ...(date ? { date } : {}),
      ...(isUp !== undefined ? { isUp } : {}),
    });
  }

  if (fiveLog.every(({ date }) => date !== undefined)) {
    fiveLog.sort((a, b) => b.date!.localeCompare(a.date!, "en"));
  }
  const fiveNum = fiveLog.length;
  const coveredDraws = count((pity ?? 0) + intervalDraws + (fiveNum - knownIntervals));
  const allNum = Math.max(count(raw.totalDraws ?? 0), cardDraws(raw), coveredDraws);
  if (!allNum) return;

  return {
    type: info.type, typeName: info.typeName, ...(info.max === undefined ? {} : { max: info.max }),
    allNum, ...(pity === undefined ? {} : { pity }), fiveNum, knownIntervals, unknownDraws: allNum - coveredDraws,
    ...(knownIntervals ? { fiveAvg: Number((intervalDraws / knownIntervals).toFixed(1)) } : {}),
    upNum, notUpNum, unknownUpNum: fiveNum - upNum - notUpNum,
    ...(Number.isFinite(first) ? { firstTime: shanghaiTime.format(first), lastTime: shanghaiTime.format(last) } : {}),
    fiveLog, shownNum: fiveNum, hiddenNum: 0,
  };
}

export function buildStarRailGachaSpecial({
  uid, history, pool, resolveItem, now = new Date(), maxRows = 48, page,
}: StarRailGachaSpecialOptions): StarRailGachaSpecialModel | undefined {
  if (!/^[1-9]\d*$/u.test(uid)) throw new TypeError($t("gacha-special.text_7a9a5a67d7"));
  if (pool !== "all" && !Object.hasOwn(poolInfo, pool)) throw new TypeError($t("gacha-special.text_9febac977d"));
  if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(maxRows) || maxRows < 1 ||
      (page !== undefined && (!Number.isSafeInteger(page) || page < 1))) {
    throw new RangeError($t("gacha-special.text_64ba011e89"));
  }
  const log = object(history ?? {});
  if (log.uid != null && text(log.uid) !== uid) throw new Error($t("gacha-special.text_bda4feb8e5"));
  const source = object(log.pools ?? {});
  const selected = pool === "all" ? Object.keys(poolInfo) as StarRailGachaPool[] : [pool];
  const isOfficialHistory = log.source === officialStarRailGachaSource;
  const pools = selected.flatMap((key) => {
    const result = readPool(poolInfo[key], object(source[key] ?? {}), uid, isOfficialHistory, now.getTime(), resolveItem);
    return result ? [result] : [];
  });
  if (!pools.length) return;

  const fiveNum = pools.reduce((sum, data) => sum + data.fiveNum, 0);
  const totalDraws = count(pools.reduce((sum, data) => sum + data.allNum, 0));
  const countPerPage = Math.max(...pools.map((data) => data.fiveNum));
  const total = Math.max(1, Math.ceil(countPerPage / maxRows));
  if (page !== undefined && page > total) return;
  const start = ((page ?? 1) - 1) * maxRows;
  const end = Math.min(start + maxRows, countPerPage);
  return {
    uid, poolName: pool === "all" ? $t("gacha-special.text_5c55a67935") : poolInfo[pool].typeName,
    totalDraws, fiveNum,
    pools: pools.map((data) => {
      const fiveLog = data.fiveLog.slice(start, end);
      return { ...data, fiveLog, shownNum: fiveLog.length, hiddenNum: data.fiveNum - fiveLog.length };
    }),
    ...(page === undefined ? {} : { pageInfo: { page, total, from: countPerPage ? start + 1 : 0, to: end, count: countPerPage } }),
  };
}
