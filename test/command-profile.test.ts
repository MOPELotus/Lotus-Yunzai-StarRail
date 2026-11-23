import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forGameCommandSender, withGameCommandProfiles } from "@lotus-yunzai/account";
import { lockFile } from "../../../lib/file-lock.ts";
import { parseChallengeQuery } from "../challenge-model.ts";
import { parseStarRailGridFight } from "../grid-fight-model.ts";
import { matchStarRailGrowth } from "../growth/command.ts";
import { createModule } from "../index.ts";
import { matchStarRailLedger } from "../ledger-command.ts";
import { matchStarRailMonthly } from "../monthly-period.ts";
import { parsePanelCommand } from "../panel-model.ts";
import { matchStarRailPersonalRecord } from "../personal-record.ts";
import { parseStarRailPersonalRoster } from "../personal-roster-model.ts";
import { parseStarRailRogue } from "../rogue-model.ts";
import { parseStarRailTeamDamage } from "../team-damage-model.ts";

const personalCommands = [
  [parsePanelCommand, "*面板", "*面板1"],
  [parsePanelCommand, "*练度统计", "*练度统计1"],
  [parsePanelCommand, "#星铁我的物理五星角色汇总force", "#星铁我的物理五星角色汇总force 档案1"],
  [parsePanelCommand, "*刷新行迹", "*刷新行迹1"],
  [parsePanelCommand, "*删除全部面板", "*删除全部面板1"],
  [parsePanelCommand, "*重载面板", "*重载面板1"],
  [parsePanelCommand, "*更新面板", "*更新面板1"],
  [parsePanelCommand, "*展板更新面板", "*展板更新面板1"],
  [parsePanelCommand, "*更新希儿面板", "*更新希儿面板1"],
  [parsePanelCommand, "*导出面板", "*导出面板1"],
  [parsePanelCommand, "*遗器列表", "*遗器列表 档案1"],
  [parsePanelCommand, "*希儿伤害2", "*希儿伤害2 1"],
  [parsePanelCommand, "*希儿面板换六魂", "*希儿面板换六魂 1"],
  [parsePanelCommand, "*希儿面板换等级 70", "*希儿面板换等级 70 1"],
  [parsePanelCommand, "*希儿面板换行迹6 9 9 9", "*希儿面板换行迹6 9 9 9 1"],
  [parsePanelCommand, "*100000123希儿面板", "*100000123希儿面板 档案1"],
  [parseChallengeQuery, "*简易混沌", "*简易混沌1"],
  [parseStarRailGridFight, "*币战战报2", "*币战战报2 档案1"],
  [parseStarRailGridFight, "#货币战争", "#货币战争 档案1"],
  [parseStarRailGridFight, "*货币战争", "*货币战争1"],
  [matchStarRailGrowth, "*克拉拉养成75 80 6 9 9 9", "*克拉拉养成75 80 6 9 9 9 档案1"],
  [matchStarRailLedger, "*星琼记录2", "*星琼记录2 档案1"],
  [matchStarRailMonthly, "*星琼获取", "*星琼获取1"],
  [matchStarRailMonthly, "*星琼十月", "*星琼十月 档案1"],
  [matchStarRailMonthly, "*去年星琼统计", "*去年星琼统计 档案1"],
  [matchStarRailPersonalRecord, "*探索", "*探索1"],
  [parseStarRailPersonalRoster, "*角色", "*角色1"],
  [parseStarRailPersonalRoster, "*五星行迹", "*五星行迹1"],
  [parseStarRailRogue, "*模拟宇宙", "*模拟宇宙 档案1"],
  [parseStarRailRogue, "*上期差分战绩2", "*上期差分战绩2 档案1"],
  [parseStarRailTeamDamage, "*队伍伤害希儿", "*队伍伤害希儿 档案1"],
] as const;

test("个人命令省略档号才使用星铁默认档，页码、等级、UID 和显式档号各自解析", () => {
  withGameCommandProfiles({ user: 42, profiles: { gs: 3, sr: 7, zzz: 4 }, isCurrent: () => true }, () => {
    for (const [parse, omitted, explicit] of personalCommands) {
      expect({ input: omitted, ...parse(omitted) }).toMatchObject({ input: omitted, profileId: 7 });
      expect({ input: explicit, ...parse(explicit) }).toMatchObject({ input: explicit, profileId: 1 });
    }
    expect(parsePanelCommand("*希儿面板换等级 70")).toMatchObject({ profileId: 7, equipment: { level: 70 } });
    expect(parsePanelCommand("*极限希儿")).toMatchObject({ type: "extreme", profileId: 1 });
    expect(parsePanelCommand("*100000123希儿面板")).toMatchObject({ uid: "100000123", profileId: 7 });
    expect(parseStarRailRogue("*上期差分战绩2")).toMatchObject({ index: 2, profileId: 7 });
    expect(parseStarRailGridFight("*币战战报2")).toMatchObject({ index: 2, profileId: 7 });
    expect(matchStarRailLedger("*星琼记录2")).toMatchObject({ page: 2, profileId: 7 });
    expect(forGameCommandSender(43, false, () => parsePanelCommand("*面板"))).toMatchObject({ profileId: 1 });
    expect(forGameCommandSender(42, true, () => parsePanelCommand("*面板"))).toMatchObject({ profileId: 1 });
  });
  expect(parsePanelCommand("*面板")).toMatchObject({ profileId: 1 });
});

test("星铁导出确认文字固定已选档号", async () => {
  const { fallback } = createModule({ signal: new AbortController().signal, lockFile });
  await withGameCommandProfiles({ user: 42, profiles: { sr: 7 }, isCurrent: () => true }, async () => {
    for (const [normalizedMessage, expected] of [
      ["#星铁导出跃迁记录jsonv2", "*强制导出记录jsonv27"],
      ["#星铁导出跃迁记录jsonv21", "*强制导出记录jsonv21"],
      ["#星铁导出面板", "*强制导出面板7"],
      ["#星铁导出面板1", "*强制导出面板1"],
    ] as const) {
      const reply = await fallback(normalizedMessage, { normalizedMessage, user_id: 42, group_id: 70, message_type: "group", reply() {} });
      expect(reply).toContain(expected);
    }
  });
});

test("星铁注册回退实际使用省略的当期默认档处理抽卡、在线与战绩", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-star-rail-command-default-"));
  const previous = Bun.env.LOTUS_PROFILE_DIR;
  Bun.env.LOTUS_PROFILE_DIR = directory;
  try {
    const { fallback } = createModule({ signal: new AbortController().signal, lockFile });
    await withGameCommandProfiles({ user: 42, profiles: { sr: 7 }, isCurrent: () => true }, async () => {
      for (const command of ["抽卡记录", "版本统计", "新手记录", "跃迁记录", "更新跃迁", "在线", "本期混沌"]) {
        for (const [suffix, profile] of [["", "7"], ["1", "1"]]) {
          const normalizedMessage = `#星铁${command}${suffix}`;
          const reply = await fallback(normalizedMessage, { normalizedMessage, user_id: 42, message_type: "private", reply() {} });
          expect({ command, suffix, reply }).toMatchObject({
            command, suffix, reply: expect.stringMatching(new RegExp(`(?:profile|档案) ${profile}(?=$|\\D)`, "u")),
          });
        }
      }
    });
  } finally {
    if (previous === undefined) delete Bun.env.LOTUS_PROFILE_DIR;
    else Bun.env.LOTUS_PROFILE_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
