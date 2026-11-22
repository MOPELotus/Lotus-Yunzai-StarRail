import { expect, test } from "bun:test";
import { makeStarRailOnlineCard, starRailOnlineCommand } from "../online-command.ts";
import { starRailOnlineReport } from "../online-model.ts";

const samples = [
  { time: "2026-01-01 00:08:00", count: 1 },
  { time: "2025-12-31T16:08:00Z", count: 1 },
  { time: "2026-01-01 08:00:00", count: 5 },
  { time: "2026-01-01 00:02:00", count: 1 },
  { time: "2025-12-31 23:59:00", count: 1 },
];
const now = new Date("2026-01-01T02:12:00Z");

test("旧有效在线别名和档号，不接消耗/跃迁等其他入口", () => {
  for (const command of ["*在线", "#星铁在线时长", "＊在线分析", "#sr在线时长统计"]) {
    expect(starRailOnlineCommand.test(command)).toBe(true);
    expect(starRailOnlineCommand.exec(command + " 档案2")?.[1]).toBe("2");
  }
  for (const unrelated of ["#在线", "*在线成员", "*光锥记录", "*体力记录", "#原神在线统计"]) expect(starRailOnlineCommand.test(unrelated)).toBe(false);
});

test("在线估算用北京时间日桶，一次单点六分钟，跨午夜按前日拆分且不重复计算单点", () => {
  const report = starRailOnlineReport(samples, now)!;
  expect(report.year).toBe(2026);
  expect(report.since).toBe("2025-12-31");
  expect(report.sampleCount).toBe(3);
  expect(report.bars.map(({ date, hours }) => [date, hours])).toEqual([["2025-12-31", "0.1"], ["2026-01-01", "0.2"]]);
  expect(report.details[0]?.date).toBe("2026-01-01");
  expect(report.details[1]?.date).toBe("2025-12-31");
  expect(report.details[0]?.blocks.find(b => b.online)?.width).toBe(8 * 100 / 1440);
  expect(report.details[1]?.blocks.find(b => b.online)?.width).toBe(7 * 100 / 1440);
  expect(report.details).toHaveLength(7);
  expect(report.cells).toHaveLength(365);
  expect(report.cells[0]?.title).toBe("2026-01-01 0.2 小时");
  expect(report.cells[1]?.title).toBe("2026-01-02 无覆盖记录");
  expect(starRailOnlineReport([], now)).toBeUndefined();
  expect(() => starRailOnlineReport([{ time: "2025-02-29 20:00:00", count: 1 }], now)).toThrow("无效");
});

test("旧近七天时间、年度热力图和来源提示均进入真实模板，短页上限有明确提示", async () => {
  const view = makeStarRailOnlineCard({ uid: "100000732", region: "prod_gf_cn", regionName: "prod_gf_cn",
    gameBiz: "hkrpg_cn", chosen: true, nickname: "模拟开拓者" },
    samples, false, now)!;
  expect(view.region).toBe("国服");
  const compiler = require("art-template") as { compile(template: string, options: { filename: string }): (data: object) => string };
  const markup = compiler.compile(await Bun.file(view.tplFile).text(), { filename: view.tplFile })(view);
  for (const phrase of ["近期每日在线时长", "2026 年每日在线时长热力图", "近期在线可视化", "推算估计", "已达到查询页数上限",
    "模拟开拓者", "0.2", "pamu.png", "logo.png"]) expect(markup).toContain(phrase);
});
