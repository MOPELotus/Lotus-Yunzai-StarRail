import { starRailMonthlyMonth } from "./monthly-archive.ts";

const named = new Map(["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"].map((word, index) => [word, index + 1]));
named.set("两", 2);
const modern = /^(?:#星铁|\*|＊|[#*]?sr)\s*(?:星琼获取|月历|月收入|收入|原石)(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;
const legacy = /^(?:#?星铁|#|\*|＊|[#*]?sr)?星琼(\d{1,2}|[一二两三四五六七八九十]{1,3})?月?(?:\s*档案\s*(\d{1,3}))?$/u;
const statistics = /^(?:[#*＊]?)(?:星铁|sr)?(今年|去年|\d{4}年)?(?:星铁)?星琼统计(?:\s*档案\s*(\d{1,3}))?$/u;
const task = /^(?:#星铁|#|\*|＊|[#*]?sr)星琼任务$/u;

export function matchStarRailMonthly(message: string) {
  const current = message.trim();
  const live = modern.exec(current);
  if (live) return { type: "month" as const, legacy: false, month: undefined, profileId: Number(live[1] ?? 1) };
  const archived = legacy.exec(current);
  if (archived) {
    const [, month, profileId] = archived;
    return { type: "month" as const, legacy: true, month: month === undefined ? undefined : named.get(month) ?? Number(month), profileId: Number(profileId ?? 1) };
  }
  const selected = statistics.exec(current);
  if (selected) return { type: "statistics" as const, selection: selected[1], profileId: Number(selected[2] ?? 1) };
  if (task.test(current)) return { type: "task" as const };
}

type Period = { readonly key: string; readonly finalized: boolean };
const offset = 8 * 3_600_000;
function calendar(now: number) {
  const date = new Date(now + offset);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function starRailRecentPeriods(now: number): readonly Period[] {
  const today = calendar(now);
  return [2, 1, 0].flatMap(delta => {
    const date = new Date(Date.UTC(today.year, today.month - 1 - delta, 1));
    const key = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    return starRailMonthlyMonth(key) ? [{ key, finalized: delta > 0 }] : [];
  });
}

export function starRailStatisticsPeriod(now: number, selection?: string) {
  const { year, month } = calendar(now);
  const current = year * 12 + month;
  if (!selection) return { label: "最近12个月", first: current - 11, last: current };
  const requested = selection === "今年" ? year : selection === "去年" ? year - 1 : Number(selection.slice(0, 4));
  return requested >= 2023 && requested <= year
    ? { label: `${requested}年`, first: requested * 12 + (requested === 2023 ? 4 : 1), last: requested * 12 + (requested === year ? month : 12) }
    : undefined;
}
