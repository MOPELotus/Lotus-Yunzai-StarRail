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
  return [`${model.period.label}星琼统计 · UID ${model.uid}`,
    `共归档 ${model.months.length}/${model.period.last - model.period.first + 1} 个月`,
    `总星琼 ${model.hcoin} · 专票与通票 ${model.railsPass} · 约 ${model.wishes} 抽`,
    ...model.months.map(({ key, snapshot, finalized }) =>
      `${key.slice(0, 4)}年${Number(key.slice(4))}月：星琼 ${snapshot.monthly.hcoin}，专票与通票 ${snapshot.monthly.railsPass}${finalized ? "" : "（未完整）"}`),
    ...model.sources.map(({ name, count }) => `${name}：${count}`)].join("\n");
}
