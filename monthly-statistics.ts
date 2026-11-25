import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { StarRailArchivedMonth } from "./monthly-archive.ts";
import type { starRailStatisticsPeriod } from "./monthly-period.ts";

export function buildStarRailMonthlyStatistics(uid: string, records: readonly StarRailArchivedMonth[],
  period: NonNullable<ReturnType<typeof starRailStatisticsPeriod>>) {
  const months = records.filter(({ key }) => {
    const at = Number(key.slice(0, 4)) * 12 + Number(key.slice(4));
    return at >= period.first && at <= period.last;
  });
  if (!months.length) return;
  const sources = new Map<string, { name: string; count: number; action?: string }>();
  let hcoin = 0, railsPass = 0;
  let bestJade = months[0]!, bestPass = months[0]!;
  for (const month of months) {
    const { monthly, groups } = month.snapshot;
    hcoin += monthly.hcoin;
    railsPass += monthly.railsPass;
    if (monthly.hcoin > bestJade.snapshot.monthly.hcoin) bestJade = month;
    if (monthly.railsPass > bestPass.snapshot.monthly.railsPass) bestPass = month;
    for (const { name, count, action } of groups) {
      const group = sources.get(name);
      sources.set(name, { name, count: (group?.count ?? 0) + count, action: group?.action ?? action });
    }
  }
  return { uid, period, months, hcoin, railsPass, bestJade, bestPass, wishes: Math.round(hcoin / 160 + railsPass),
    sources: [...sources.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)) };
}

export type StarRailMonthlyStatistics = NonNullable<ReturnType<typeof buildStarRailMonthlyStatistics>>;

export function starRailStatisticsText(model: StarRailMonthlyStatistics) {
  return [$t("monthly-statistics.text_c90ed3a63f", { "label": model.period.label, "uid": model.uid }),
    $t("monthly-statistics.text_8f59f43d11", { "length": model.months.length, "value2": model.period.last - model.period.first + 1 }),
    $t("monthly-statistics.text_f6ff8efaf7", { "hcoin": model.hcoin, "railsPass": model.railsPass, "wishes": model.wishes }),
    ...model.months.map(({ key, snapshot, finalized }) =>
      $t("monthly-statistics.text_1fb3dd6db7", { "value1": key.slice(0, 4), "value2": Number(key.slice(4)), "hcoin": snapshot.monthly.hcoin, "railsPass": snapshot.monthly.railsPass, "value5": finalized ? "" : $t("monthly-statistics.text_fb32e18964") })),
    ...model.sources.map(({ name, count }) => `${name}：${count}`)].join("\n");
}
