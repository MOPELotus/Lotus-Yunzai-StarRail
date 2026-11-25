import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { StarRailGachaSchedulePeriod } from "./gacha-version.ts";
import type { StarRailUigfArchive, StarRailUigfPool } from "./gacha-uigf.ts";

export interface StarRailRecordDraw {
  readonly id: string;
  readonly gachaId: string;
  readonly pool: StarRailUigfPool;
  readonly at: number;
  readonly rank?: 3 | 4 | 5;
  readonly item: {
    readonly id: string;
    readonly name: string;
    readonly abbr: string;
    readonly img: string;
    readonly kind?: "char" | "weapon";
  };
}

export type StarRailRecordItem = StarRailRecordDraw["item"] & { readonly rank?: StarRailRecordDraw["rank"] };
export type StarRailRecordItemResolver = (id: string) => StarRailRecordItem | undefined;

function kind(value: string | undefined): StarRailRecordDraw["item"]["kind"] {
  if (value === "角色") return "char";
  if (value === "光锥" || value === "武器") return "weapon";
}

export function starRailRecordDraws(archive: StarRailUigfArchive, resolveItem: StarRailRecordItemResolver): StarRailRecordDraw[] {
  const zone = Math.round(archive.timezone * 60) * 60_000;
  const draws = archive.records.map((row): StarRailRecordDraw => {
    const metadata = resolveItem(row.item_id);
    const name = row.name || $t("gacha-record-source.text_00e57f566a", { "item_id": row.item_id });
    return {
      id: row.id, gachaId: row.gacha_id, pool: row.gacha_type,
      at: Date.parse(`${row.time.replace(" ", "T")}Z`) - zone,
      rank: metadata?.rank ?? (row.rank_type ? Number(row.rank_type) as 3 | 4 | 5 : undefined),
      item: metadata ?? { id: row.item_id, name, abbr: name, img: "", kind: kind(row.item_type) },
    };
  });
  return draws.sort((left, right) => right.at - left.at || right.id.length - left.id.length ||
    (left.id < right.id ? 1 : left.id > right.id ? -1 : 0));
}

function serverTime(time: string) {
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(time)
    ? `${time.replace(" ", "T")}+08:00` : time);
}

export function starRailRecordPeriods(schedule: readonly StarRailGachaSchedulePeriod[]) {
  return schedule.flatMap((row) => {
    const start = serverTime(row.from), end = serverTime(row.to);
    return start < end ? [{ ...row, start, end }] : [];
  });
}

export function matchStarRailRecordPeriod<Period extends ReturnType<typeof starRailRecordPeriods>[number]>(
  periods: readonly Period[], { pool, at, gachaId }: StarRailRecordDraw,
): Period | undefined {
  if (pool !== "11" && pool !== "12") return;
  const matchingDate = ({ start, end }: Period) => start < at && at < end;
  if (periods.some(({ gachaIds }) => gachaIds !== undefined)) {
    const key = pool === "11" ? "GachaType_AvatarUp" : "GachaType_EquipmentUp";
    const byId = periods.filter((period) => period.gachaIds?.[key]?.includes(gachaId));
    if (byId.length === 1) return byId.find(matchingDate);
  }
  return periods.find(matchingDate);
}

export function starRailRecordUp(draw: StarRailRecordDraw, period?: StarRailGachaSchedulePeriod) {
  const { pool, rank, item } = draw;
  if (rank !== 5 || !item.img || (pool !== "11" && pool !== "12")) return;
  const featured = pool === "11" ? period?.char5 : period?.weapon5;
  if (featured?.length) return featured.includes(item.name);
}

export function resolveStarRailRecordPool(schedule: readonly StarRailGachaSchedulePeriod[]) {
  const periods = starRailRecordPeriods(schedule);
  return (draw: StarRailRecordDraw) => {
    const { pool, rank, at } = draw;
    if (rank !== 5 || (pool !== "11" && pool !== "12")) return;
    const period = matchStarRailRecordPeriod(periods, draw);
    const isUp = starRailRecordUp(draw, period);
    if (isUp !== undefined) return { isUp, isNewPool: false };
    if (!period && periods.length && periods.every(({ end }) => at > end)) return { isNewPool: true };
  };
}
