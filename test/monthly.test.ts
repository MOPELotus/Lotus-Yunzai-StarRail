import { expect, test } from "bun:test";
import { makeStarRailMonthlyCard, starRailMonthlyText } from "../monthly-card.ts";
import { matchStarRailMonthly } from "../monthly-period.ts";

const snapshot = {
  month: "11", monthly: { hcoin: 3, railsPass: 12345 }, today: { hcoin: 0, railsPass: 1 },
  yesterday: { hcoin: 2, railsPass: 0 }, groups: [
    { name: "每日任务", count: 1 }, { name: "活动", count: 1 }, { name: "邮件", count: 1 },
  ],
};

test("当月入口保留原星铁收入别名及本人档号，避开流水和游戏日历", () => {
  for (const word of ["星琼获取", "月历", "月收入", "收入", "原石"]) {
    for (const prefix of ["#星铁", "*", "＊", "#sr"]) {
      expect(matchStarRailMonthly(prefix + word)).toEqual({ type: "month", legacy: false, profileId: 1, month: undefined });
      expect(matchStarRailMonthly(prefix + word + " 档案2")).toEqual({ type: "month", legacy: false, profileId: 2, month: undefined });
    }
  }
  for (const excluded of ["#星铁充值记录", "#星铁星琼记录", "#星铁日历", "#星铁月收入上月", "#绝区零月收入", "#收入"]) {
    expect(matchStarRailMonthly(excluded)).toBeUndefined();
  }
});

test("开拓日历保留旧总计、零值和 0 位环图百分比", async () => {
  const model = makeStarRailMonthlyCard(snapshot);
  expect(model.groups.map(group => group.percentage)).toEqual([34, 33, 33]);
  expect(model.incomes.map(income => [income.label, income.hcoin, income.railsPass])).toEqual([
    ["当月共获取", 3, 12345], ["今日共获取", 0, 1], ["昨日共获取", 2, 0],
  ]);
  expect(makeStarRailMonthlyCard({ ...snapshot, groups: [{ name: "空", count: 0 }] }).groups[0])
    .toMatchObject({ percentage: 0, visible: false, showPercentage: false });
  const compiler = require("art-template") as { compile(template: string, options: { filename: string }): (data: object) => string };
  const html = compiler.compile(await Bun.file(model.tplFile).text(), { filename: model.tplFile })(model);
  for (const str of ["11 | 开拓日历", "星琼：0", "星轨通票", "34%", "12345", "本月星琼收入", "Lotus-Yunzai"]) {
    expect(html).toContain(str);
  }
  const escaped = makeStarRailMonthlyCard({ ...snapshot, groups: [{ name: "<script>fixture</script>", count: 2 }] });
  expect(compiler.compile(await Bun.file(model.tplFile).text(), { filename: model.tplFile })(escaped)).not.toContain("<script>fixture</script>");
  const fallback = starRailMonthlyText(snapshot);
  expect(fallback).toContain("昨日共获取 · 星琼：2 · 星轨通票&星轨专票：0");
  expect(fallback).toContain("每日任务 1 · 34%");
});
