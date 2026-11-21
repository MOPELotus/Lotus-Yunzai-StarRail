import { fileURLToPath } from "node:url";
import type { StarRailMonthlySnapshot } from "@lotus-yunzai/hoyo-client";

const themePath = new URL("./monthly-theme/month/", import.meta.url);
const themeFile = (name: string) => new URL(name, themePath).href;
const colors = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc"];
const radius = 111, center = 145;
const circumference = 2 * Math.PI * radius;

function incomeGroups(groups: StarRailMonthlySnapshot["groups"]) {
  const counts = groups.map(group => BigInt(group.count));
  const total = counts.reduce((sum, count) => sum + count, 0n);
  const scaled = counts.map(count => count * 100n);
  const percentages = scaled.map(n => total ? Number(n / total) : 0);
  if (total) {
    const remainderOrder = scaled.map((n, index) => ({ index, remainder: n % total }))
      .sort((left, right) => left.remainder === right.remainder ? left.index - right.index : left.remainder > right.remainder ? -1 : 1);
    const remaining = 100 - percentages.reduce((sum, n) => sum + n, 0);
    for (const { index } of remainderOrder.slice(0, remaining)) percentages[index]!++;
  }
  let offset = 0;
  return groups.map((group, index) => {
    const length = total ? Number(counts[index]) / Number(total) * circumference : 0;
    const angle = (offset + length / 2) / radius - Math.PI / 2;
    const result = { ...group, percentage: percentages[index]!, color: colors[index % colors.length]!,
      dash: `${Math.max(0, length - 2)} ${circumference}`, offset: -offset,
      x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius,
      visible: length > 2, showPercentage: length >= 20 };
    offset += length;
    return result;
  });
}

const incomeLabels = ["当月共获取", "今日共获取", "昨日共获取"] as const;

function incomeSections(snapshot: StarRailMonthlySnapshot) {
  return [snapshot.monthly, snapshot.today, snapshot.yesterday].map((income, index) => ({
    ...income, label: incomeLabels[index]!,
  }));
}

export function makeStarRailMonthlyCard(snapshot: StarRailMonthlySnapshot) {
  return {
    tplFile: fileURLToPath(new URL("month.html", themePath)),
    css: themeFile("month.css"), jadeIcon: themeFile("星琼.png"), passIcon: themeFile("车票.png"),
    month: snapshot.month, total: snapshot.monthly.hcoin, incomes: incomeSections(snapshot), groups: incomeGroups(snapshot.groups),
    cardBrand: "Lotus-Yunzai · StarRail", imgType: "png" as const, viewport: { width: 660, height: 880 }, scale: 1,
  };
}

export function starRailMonthlyText(snapshot: StarRailMonthlySnapshot) {
  return [`${snapshot.month} | 开拓日历`,
    ...incomeSections(snapshot).map(({ label, hcoin, railsPass }) => `${label} · 星琼：${hcoin} · 星轨通票&星轨专票：${railsPass}`),
    ...(snapshot.groups.length ? ["本月星琼收入", ...incomeGroups(snapshot.groups).map(
      group => `${group.name} ${group.count} · ${group.percentage}%`,
    )] : []),
  ].join("\n");
}
