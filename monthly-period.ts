import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { gameCommandProfileId } from "@lotus-yunzai/account";
import { starRailMonthlyMonth } from "./monthly-archive.ts";

const named = new Map(["一", $t("monthly-period.text_084b42f6e9"), $t("monthly-period.text_a4c3313deb"), $t("monthly-period.text_754a9d5828"), $t("monthly-period.text_c9b87f516a"), $t("monthly-period.text_de07b53838"), $t("monthly-period.text_1b0542878c"), $t("monthly-period.text_2c467d3673"), $t("monthly-period.text_df897da6e0"), $t("monthly-period.text_fc7edd399a"), $t("monthly-period.text_41cbc3e287"), $t("monthly-period.text_80b044f1af")].map((word, index) => [word, index + 1]));
named.set($t("monthly-period.text_83385d2eda"), 2);
const modern = /^(?:#星铁|\*|＊|[#*]?sr)\s*(?:星琼获取|月历|月收入|收入|原石)(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;
const legacy = /^(?:#?星铁|#|\*|＊|[#*]?sr)?星琼(\d{1,2}|[一二两三四五六七八九十]{1,3})?月?(?:\s*档案\s*(\d{1,3}))?$/u;
const statistics = /^(?:[#*＊]?)(?:星铁|sr)?(今年|去年|\d{4}年)?(?:星铁)?星琼统计(?:\s*档案\s*(\d{1,3}))?$/u;
const task = /^(?:#星铁|#|\*|＊|[#*]?sr)星琼任务$/u;

export function matchStarRailMonthly(message: string) {
  const current = message.trim();
  const live = modern.exec(current);
  if (live) return { type: "month" as const, legacy: false, month: undefined, profileId: gameCommandProfileId("sr", live[1]) };
  const archived = legacy.exec(current);
  if (archived) {
    const [, month, profileId] = archived;
    return { type: "month" as const, legacy: true, month: month === undefined ? undefined : named.get(month) ?? Number(month), profileId: gameCommandProfileId("sr", profileId) };
  }
  const selected = statistics.exec(current);
  if (selected) return { type: "statistics" as const, selection: selected[1], profileId: gameCommandProfileId("sr", selected[2]) };
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
  if (!selection) return { label: $t("monthly-period.text_bed98211d5"), first: current - 11, last: current };
  const requested = selection === "今年" ? year : selection === "去年" ? year - 1 : Number(selection.slice(0, 4));
  return requested >= 2023 && requested <= year
    ? { label: $t("monthly-period.text_cbed8520a4", { "requested": requested }), first: requested * 12 + (requested === 2023 ? 4 : 1), last: requested * 12 + (requested === year ? month : 12) }
    : undefined;
}
