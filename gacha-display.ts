import type { StarRailGachaPool } from "@lotus-yunzai/hoyo-client";
import { officialStarRailGachaSource, officialStarRailGachaTime } from "./gacha-time.ts";

const legacyPoolTypes = Object.freeze({
  GachaType_AvatarUp: 11,
  GachaType_EquipmentUp: 12,
  GachaType_CollabAvatarUp: 21,
  GachaType_CollabEquipmentUp: 22,
  GachaType_Standard: 1,
  GachaType_Newbie: 2,
} as const satisfies Record<StarRailGachaPool, number>);

type Pool = keyof typeof legacyPoolTypes;
type LegacyPool = typeof legacyPoolTypes[Pool];

export interface StarRailLegacyGachaRecord {
  readonly id: string;
  readonly uid: string;
  readonly name: string;
  readonly item_type: "角色" | "光锥";
  readonly rank_type: "3" | "5";
  readonly gacha_type: `${LegacyPool}`;
  readonly time: string;
  readonly is_up?: boolean;
}

const fallbackTime = "1970-01-01 00:00:00";
// These old display rows are expanded in memory and must never be persisted as individual real pulls.
const maxDisplayRecords = 100_000;

function object(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(message);
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : "";
}

function count(value: unknown): number {
  if (value == null) return 0;
  const number = typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) {
    throw new TypeError("星铁抽卡显示数据包含无效计数。");
  }
  return number;
}

function timestamp(row: Record<string, unknown>, official: boolean): string {
  const explicit = text(row.time) || text(row.legacy_time);
  if (explicit) return explicit;
  if (official) {
    const time = officialStarRailGachaTime(row.id);
    return Number.isFinite(time) ? new Date(time).toISOString() : fallbackTime;
  }
  const seconds = text(row.id).slice(0, 10);
  return /^\d{10}$/u.test(seconds)
    ? new Date(Number(seconds) * 1000).toISOString().slice(0, 19).replace("T", " ")
    : fallbackTime;
}

function displayPool(value: unknown, uid: string, type: LegacyPool, remainingLimit: number, official: boolean) {
  const history = object(value ?? {}, "星铁抽卡显示卡池格式无效。");
  const rawRows = history.fiveStars ?? [];
  if (!Array.isArray(rawRows)) throw new TypeError("星铁五星显示列表格式无效。");
  if (rawRows.length > remainingLimit) throw new RangeError("星铁抽卡显示记录数量过多。");

  const rows = rawRows.map((row) => object(row, "星铁五星显示记录格式无效。"));
  const counts = rows.map((row) => Math.max(1, count(row.gacha_count)));
  const pity = count(history.pity);
  const expanded = counts.reduce((total, draws) => total + draws, pity);
  const total = Math.max(expanded, count(history.totalDraws));
  if (total > remainingLimit) throw new RangeError("星铁抽卡显示记录数量过多。");

  const records: StarRailLegacyGachaRecord[] = [];
  const identity = (row: Record<string, unknown>) => text(row.id) || text(row.uuid);
  const knownIds = new Set(rows.map(identity).filter(Boolean));
  const gachaType = String(type) as `${LegacyPool}`;
  const sequence = { lotus: 0, "lotus-five": 0 };

  function reserve(prefix: keyof typeof sequence) {
    let id = `${prefix}-${type}-${++sequence[prefix]}`;
    while (knownIds.has(id)) id = `${prefix}-${type}-${++sequence[prefix]}`;
    knownIds.add(id);
    return id;
  }

  function addFillers(amount: number, time: string) {
    for (let index = 0; index < amount; index++) {
      records.push({
        id: reserve("lotus"), uid, name: "占位记录",
        item_type: "光锥", rank_type: "3", gacha_type: gachaType, time,
      });
    }
  }

  addFillers(pity, timestamp(rows[0] ?? {}, official));
  for (const [index, row] of rows.entries()) {
    const time = timestamp(row, official);
    const item = object(row.item ?? {}, "星铁五星显示物品格式无效。");
    records.push({
      id: identity(row) || reserve("lotus-five"), uid,
      name: text(item.name) || "未知", item_type: item.item_type === "ItemType_Avatar" ? "角色" : "光锥",
      rank_type: "5", gacha_type: gachaType, time,
      ...(typeof row.is_up === "boolean" ? { is_up: row.is_up } : {}),
    });
    addFillers(counts[index]! - 1, time);
  }
  addFillers(total - records.length, timestamp(rows.at(-1) ?? {}, official));
  return records;
}

export function buildStarRailLegacyRecords(uid: string, history: unknown) {
  if (!/^[1-9]\d*$/u.test(uid)) throw new TypeError("星铁抽卡显示 UID 无效。");
  const log = object(history ?? {}, "星铁抽卡显示资料格式无效。");
  if (log.uid != null && text(log.uid) !== uid) throw new Error("星铁抽卡显示资料与当前角色不一致。");

  const pools = object(log.pools ?? {}, "星铁抽卡显示卡池清单格式无效。");
  const official = log.source === officialStarRailGachaSource;
  const display = {} as Record<LegacyPool, readonly StarRailLegacyGachaRecord[]>;
  let remainingLimit = maxDisplayRecords;
  for (const pool of Object.keys(legacyPoolTypes) as Pool[]) {
    const type = legacyPoolTypes[pool];
    const records = displayPool(pools[pool], uid, type, remainingLimit, official);
    display[type] = records;
    remainingLimit -= records.length;
  }
  return display;
}
