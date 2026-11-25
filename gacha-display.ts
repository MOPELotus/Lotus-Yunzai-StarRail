import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
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
    throw new TypeError($t("gacha-display.text_016f100eb7"));
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
  const history = object(value ?? {}, $t("gacha-display.text_8df3f67d18"));
  const rawRows = history.fiveStars ?? [];
  if (!Array.isArray(rawRows)) throw new TypeError($t("gacha-display.text_ce6edb5f1f"));
  if (rawRows.length > remainingLimit) throw new RangeError($t("gacha-display.text_a4b99ff89f"));

  const rows = rawRows.map((row) => object(row, $t("gacha-display.text_f8c63c2cac")));
  const counts = rows.map((row) => Math.max(1, count(row.gacha_count)));
  const pity = count(history.pity);
  const expanded = counts.reduce((total, draws) => total + draws, pity);
  const total = Math.max(expanded, count(history.totalDraws));
  if (total > remainingLimit) throw new RangeError($t("gacha-display.text_a4b99ff89f"));

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
        id: reserve("lotus"), uid, name: $t("gacha-display.text_faea113859"),
        item_type: "光锥", rank_type: "3", gacha_type: gachaType, time,
      });
    }
  }

  addFillers(pity, timestamp(rows[0] ?? {}, official));
  for (const [index, row] of rows.entries()) {
    const time = timestamp(row, official);
    const item = object(row.item ?? {}, $t("gacha-display.text_372c2e0c82"));
    records.push({
      id: identity(row) || reserve("lotus-five"), uid,
      name: text(item.name) || $t("gacha-display.text_4d8c1c5b42"), item_type: item.item_type === "ItemType_Avatar" ? "角色" : "光锥",
      rank_type: "5", gacha_type: gachaType, time,
      ...(typeof row.is_up === "boolean" ? { is_up: row.is_up } : {}),
    });
    addFillers(counts[index]! - 1, time);
  }
  addFillers(total - records.length, timestamp(rows.at(-1) ?? {}, official));
  return records;
}

export function buildStarRailLegacyRecords(uid: string, history: unknown) {
  if (!/^[1-9]\d*$/u.test(uid)) throw new TypeError($t("gacha-display.text_7a9a5a67d7"));
  const log = object(history ?? {}, $t("gacha-display.text_7ef0da1e17"));
  if (log.uid != null && text(log.uid) !== uid) throw new Error($t("gacha-display.text_bda4feb8e5"));

  const pools = object(log.pools ?? {}, $t("gacha-display.text_e857d96930"));
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
