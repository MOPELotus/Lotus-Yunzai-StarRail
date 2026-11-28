import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { gachaProbabilityFor, type GachaDisplaySettings } from "@lotus-yunzai/gacha/display-settings";
import { applyGachaGuarantees, gachaLuckFor, type GachaLuck } from "@lotus-yunzai/gacha";
import { buildStarRailLegacyRecords, type StarRailLegacyGachaRecord } from "./gacha-display.ts";

type ItemId = number | string;
type Face = { readonly name: string; readonly face?: string; readonly banner?: string };
type ResolvedItem = { readonly id: ItemId; readonly name: string; readonly abbr: string; readonly star?: number; readonly img?: string };
type Items = Record<string, {
  name: string; abbr: string; star: number; img?: string; type?: "char" | "weapon"; count?: number;
}>;

interface FiveStarDisplay {
  id: ItemId;
  count: number;
  countKnown?: false;
  countAtLeast?: true;
  date: string;
  isUp?: boolean;
  isBig?: true;
  isNewPool?: boolean;
}

type DecimalOrZero = string | 0;

interface GachaDetailStats {
  readonly allNum: number;
  readonly noFiveNum: number;
  readonly noFourNum: number;
  readonly fiveNum: number;
  readonly fourNum: number;
  readonly fiveAvg: DecimalOrZero;
  readonly fourAvg: DecimalOrZero;
  readonly wai: number;
  readonly isvalidNum: DecimalOrZero;
  readonly weaponNum: number;
  readonly weaponFourNum: number;
  readonly upYs: string;
}

export interface StarRailGachaDetailModel {
  readonly uid: string;
  readonly recordArchive?: true;
  readonly face: Face;
  readonly poolName: string;
  readonly gacha: {
    readonly stat: GachaDetailStats;
    readonly items: Items;
    readonly fiveLog: readonly FiveStarDisplay[];
    readonly luck?: GachaLuck;
    readonly maxFour: { readonly name: string; readonly count: number };
    readonly noWaiRate: DecimalOrZero;
    readonly unclassified?: number;
    readonly shownNum?: number;
    readonly hiddenNum?: number;
  };
  readonly pageInfo?: { readonly page: number; readonly total: number; readonly from: number; readonly to: number; readonly count: number };
}

export type StarRailGachaDetailPool = keyof typeof detailPools;

export interface StarRailGachaDetailOptions {
  readonly uid: string;
  readonly history: unknown;
  readonly face: Face;
  readonly now?: Date;
  readonly resolveItem?: (record: StarRailLegacyGachaRecord) => ResolvedItem | undefined;
  readonly resolvePool?: (record: StarRailLegacyGachaRecord) => { isUp?: boolean; isNewPool?: boolean } | undefined;
  readonly pool?: StarRailGachaDetailPool;
  readonly maxRows?: number;
  readonly display?: GachaDisplaySettings;
  readonly page?: number;
}

const pityItem = 888;
const unknownPull = 403;
export const detailPools = {
  GachaType_CollabAvatarUp: { legacy: 21, name: $t("gacha-record-special.text_957dff2ffa"), base: 0.006, soft: 74, step: 0.06, hard: 90, upRate: 0.5 },
  GachaType_CollabEquipmentUp: { legacy: 22, name: $t("gacha-record-special.text_7085c8362b"), base: 0.008, soft: 66, step: 0.07, hard: 80, upRate: 0.75 },
  GachaType_Newbie: { legacy: 2, name: $t("gacha-record-special.text_dcfce30c45"), base: 0.006, soft: 50, step: 0, hard: 50, upRate: 0 },
  GachaType_AvatarUp: { legacy: 11, name: $t("gacha-detail.text_c47b54e84e"), base: 0.006, soft: 74, step: 0.06, hard: 90, upRate: 0.5 },
  GachaType_EquipmentUp: { legacy: 12, name: $t("gacha-detail.text_e733238b28"), base: 0.008, soft: 66, step: 0.07, hard: 80, upRate: 0.75 },
  GachaType_Standard: { legacy: 1, name: $t("gacha-detail.text_300b6634fe"), base: 0.006, soft: 74, step: 0.06, hard: 90, upRate: 0 },
} as const;
const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" });
function countOnlyPity(history: unknown, pool: StarRailGachaDetailPool): number {
  const value = (history as { pools?: Partial<Record<StarRailGachaDetailPool, { pity?: unknown }>> })?.pools?.[pool]?.pity;
  // The legacy conversion has already checked the input; a missing pity field carries no known current count.
  return typeof value === "string" || typeof value === "number" ? Number(value) : 0;
}

function actualTime(raw: string): number {
  if (raw === "1970-01-01 00:00:00") return NaN;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(raw)
    ? `${raw.replace(" ", "T")}+08:00` : raw;
  return Date.parse(normalized);
}

function dateAt(time: number): string {
  return Number.isFinite(time) ? dateFormat.format(time).replace("/", "-") : "";
}

export function buildStarRailGachaDetail({
  uid, history, face, now = new Date(), resolveItem, resolvePool, pool = "GachaType_AvatarUp", display, maxRows = display?.detailRows ?? 30, page,
}: StarRailGachaDetailOptions): StarRailGachaDetailModel | undefined {
  if (!Number.isSafeInteger(maxRows) || maxRows < 0 || (page !== undefined && (!Number.isSafeInteger(page) || page < 1))) {
    throw new RangeError($t("gacha-detail.text_e356344050"));
  }
  const model = detailPools[pool];
  if (!model) throw new TypeError($t("gacha-detail.text_03b8727e80"));
  const records = buildStarRailLegacyRecords(uid, history)[model.legacy];
  if (!records.length) return;

  const items: Items = Object.create(null);
  const dated: { row: FiveStarDisplay; time: number }[] = [];
  let prefix = 0;
  let fillers = 0;
  for (const record of records) {
    if (record.rank_type === "3") {
      fillers++;
      const previous = dated.at(-1);
      if (previous) previous.row.count++;
      else prefix++;
      continue;
    }

    const metadata = resolveItem?.(record);
    const id = metadata && String(metadata.id) !== String(pityItem) && String(metadata.id) !== String(unknownPull)
      ? metadata.id : `${record.item_type}:${record.name}`;
    const item = items[String(id)] ??= {
      name: metadata?.name ?? record.name, abbr: metadata?.abbr ?? record.name,
      star: metadata?.star ?? 5, img: metadata?.img ?? "", count: 0,
      type: record.item_type === "角色" ? "char" : "weapon",
    };
    item.count!++;
    const version = resolvePool?.(record);
    const time = actualTime(record.time);
    dated.push({ time, row: {
      id, date: dateAt(time), count: 1, isUp: record.is_up ?? version?.isUp, isNewPool: version?.isNewPool ?? false,
    } });
  }

  if (fillers) items[unknownPull] = { type: "weapon", count: fillers, star: 3, name: $t("gacha-detail.text_4d8c1c5b42"), abbr: $t("gacha-detail.text_4d8c1c5b42"), img: "" };
  // Sort only official five-star timestamps. Fillers belong to their interval, without giving them a draw date.
  if (dated.every(({ time }) => Number.isFinite(time))) dated.sort((a, b) => b.time - a.time);
  const five = dated.map(({ row }) => row);
  const fiveNum = five.length;
  const allNum = records.length;
  const pity = fiveNum ? prefix : countOnlyPity(history, pool);
  const fiveUsed = allNum - pity;
  const wai = five.filter(({ isUp }) => isUp === false).length;
  const upNum = model.upRate && five.every(({ isUp }) => isUp !== undefined) ? fiveNum - wai : 0;
  const upUsed = upNum ? fiveUsed - (five[0]?.isUp === false ? five[0].count : 0) : 0;
  const isvalidNum = upNum ? (upUsed / upNum).toFixed(2) : 0;
  const upYs = Number(isvalidNum) * 160;
  const state = applyGachaGuarantees(model.upRate ? five : []);
  const luck = pool === "GachaType_Newbie" ? undefined : gachaLuckFor(
    gachaProbabilityFor("sr", model.legacy, model, display), fiveNum, fiveUsed, upNum, upUsed,
    state, five.some(({ isNewPool }) => isNewPool), display?.luck,
  );

  const stat: GachaDetailStats = {
    allNum, noFiveNum: pity, fiveNum, fiveAvg: fiveNum ? (fiveUsed / fiveNum).toFixed(2) : 0,
    wai, isvalidNum, upYs: upYs >= 10_000 ? `${(upYs / 10_000).toFixed(2)}w` : upYs.toFixed(0),
    noFourNum: 0, fourNum: 0, fourAvg: 0, weaponNum: 0, weaponFourNum: 0,
  };
  const currentPity: FiveStarDisplay[] = [];
  if (pity) {
    items[pityItem] = { name: $t("gacha-detail.text_95b727161e"), abbr: $t("gacha-detail.text_95b727161e"), star: 5, img: "gacha/imgs/no-avatar.webp" };
    currentPity.push({ id: pityItem, isUp: true, count: pity, date: dateAt(now.valueOf()) });
  }

  let from = 0;
  let to = fiveNum;
  let pageInfo: StarRailGachaDetailModel["pageInfo"];
  const truncated = page === undefined && maxRows > 0 && fiveNum > maxRows;
  if (truncated) to = maxRows;
  if (page !== undefined) {
    const total = maxRows ? Math.max(1, Math.ceil(fiveNum / maxRows)) : 1;
    if (page > total) throw new RangeError($t("gacha-detail.text_4108a73b14"));
    from = (page - 1) * maxRows;
    to = maxRows ? Math.min(fiveNum, from + maxRows) : fiveNum;
    if (total > 1) pageInfo = { page, total, from: from + 1, to, count: fiveNum };
  }
  return {
    uid, face, poolName: model.name, pageInfo, gacha: {
      stat, items, luck, noWaiRate: state.noWaiRate, maxFour: { name: $t("gacha-detail.text_484d556139"), count: 0 },
      fiveLog: [...(from ? [] : currentPity), ...five.slice(from, to)],
      ...(truncated ? { shownNum: to, hiddenNum: fiveNum - to } : {}),
    },
  };
}
