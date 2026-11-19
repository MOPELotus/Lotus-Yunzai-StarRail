import { expect, test } from "bun:test";
import { matchStarRailRankStats } from "../rank-statistics.ts";

test("matches the legacy public rank command with exact Star Rail names, collection aliases and playable character numbers", () => {
  for (const [command, expected] of [
    ["#星铁希儿排名统计", { id: 1102, name: "希儿" }],
    ["#希尔 排名统计", { id: 1102, name: "希儿" }],
    ["#星铁老杨排名统计", { id: 1004, name: "瓦尔特" }],
    ["#星铁1204排名统计", { id: 1204, name: "景元" }],
    ["#丹恒·饮月排名统计", { id: 1213, name: "丹恒•饮月" }],
    ["#星铁星神★阿哈排名统计", { id: 1511, name: "星神★阿哈" }],
  ] as const) expect(matchStarRailRankStats(command)).toEqual(expected);
});

test("does not turn ambiguous aliases, UID/account text or unrelated ranking commands into requests", () => {
  for (const command of ["#星铁云天明排名统计", "#星铁总排名", "#星铁希儿排名", "#星铁角色排名希儿100000001", "#星铁100000001排名统计",
    "#星铁希儿排名统计2", "#星铁希儿100000001排名统计", "#星铁芙宁娜排名统计", "#绝区零莱卡恩排名统计", "#星铁 排名统计"]) {
    expect(matchStarRailRankStats(command)).toBeUndefined();
  }
});
