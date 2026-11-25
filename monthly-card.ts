import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
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

const incomeLabels = [$t("monthly-card.text_2494c80167"), $t("monthly-card.text_e44fd8e840"), $t("monthly-card.text_fe651e90c2")] as const;

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
    cardBrand: $t("monthly-card.text_00dfd4ad2c"), imgType: "png" as const, viewport: { width: 660, height: 880 }, scale: 1,
  };
}

export function starRailMonthlyText(snapshot: StarRailMonthlySnapshot) {
  return [$t("monthly-card.text_7d80867c35", { "month": snapshot.month }),
    ...incomeSections(snapshot).map(({ label, hcoin, railsPass }) => $t("monthly-card.text_3171e0b450", { "label": label, "hcoin": hcoin, "railsPass": railsPass })),
    ...(snapshot.groups.length ? [$t("monthly-card.text_03d531c062"), ...incomeGroups(snapshot.groups).map(
      group => `${group.name} ${group.count} · ${group.percentage}%`,
    )] : []),
  ].join("\n");
}
