import { expect, test } from "bun:test";
import { makeStarRailLedgerCard, matchStarRailLedger } from "../ledger-command.ts";

test("游戏流水保留旧页号和别名，档号独立，光锥与武器仍走跃迁", () => {
  expect(matchStarRailLedger("*充值记录6")).toEqual({ kind: "dreams", page: 6, profileId: 1 });
  expect(matchStarRailLedger("#星铁古老梦华记录2 档案3")).toEqual({ kind: "dreams", page: 2, profileId: 3 });
  expect(matchStarRailLedger("#sr星琼记录 档案2")).toEqual({ kind: "stellar", page: 1, profileId: 2 });
  expect(matchStarRailLedger("＊体力记录")).toEqual({ kind: "power", page: 1, profileId: 1 });
  expect(matchStarRailLedger("#星铁遗器记录")).toEqual({ kind: "relic", page: 1, profileId: 1 });
  for (const msg of ["*光锥记录", "*武器记录", "*遗器列表", "*月收入", "#原神充值记录", "#绝区零充值记录"]) {
    expect(matchStarRailLedger(msg)).toBeUndefined();
  }
});

test("流水图保持旧标题、页码与时间、获取量、原因三列", async () => {
  const model = makeStarRailLedgerCard("100000732", "dreams", 2, [
    { time: "2000-01-02 03:04:05", count: 2, reason: "系统邮件" },
    { time: "2000-01-02 03:04:05", count: 3, reason: "<script>fixture</script>" },
  ]);
  const compiler = require("art-template") as { compile(source: string, options: { filename: string }): (data: object) => string };
  const html = compiler.compile(await Bun.file(model.tplFile).text(), { filename: model.tplFile })(model);
  for (const text of ["古老梦华记录", "Dreams History", "UID 100000732", "当前第2页", "2000-01-02 03:04:05", "获取数量", "变化原因",
    "系统邮件", "Deco4.png", "bg_main.b435ab02..png"]) expect(html).toContain(text);
  expect(html).not.toContain("<script>fixture</script>");
});
