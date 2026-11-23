import { expect, test } from "bun:test";
import { lockFile } from "../../../lib/file-lock.ts";
import { createModule } from "../index.ts";

test("star rail routes unbranded gacha queries and help through the gacha feature", async () => {
  const { fallback, fallbackFeatures } = createModule({ signal: new AbortController().signal, lockFile });
  const context = (normalizedMessage: string) => ({ normalizedMessage, reply() {} });
  const commands = ["光锥记录2", "版本统计2", "新手记录2"];
  for (const command of commands) {
    const current = `#星铁${command}`;
    expect(await fallbackFeatures(context(current))).toEqual(["[gacha] 抽卡记录"]);
    expect(await fallback(current, context(current))).toBe("请从登录档案对应的 QQ 会话使用星铁抽卡记录。");

    const retired = `#星铁喵喵${command}`;
    expect(await fallbackFeatures(context(retired))).toEqual([]);
    expect(await fallback(retired, context(retired))).toBeUndefined();
  }
  const help = "#星铁抽卡帮助";
  expect(await fallbackFeatures(context(help))).toEqual(["[gacha] 抽卡记录"]);
  expect(await fallback(help, context(help))).toContain("*版本统计");
});

test("旧跃迁和导出别名沿用本人档案、范围和群聊发送确认", async () => {
  const { fallback, fallbackFeatures } = createModule({ signal: new AbortController().signal, lockFile });
  for (const normalizedMessage of ["#星铁跃迁记录", "#星铁光锥联动跃迁分析", "#星铁联动记录",
    "#星铁新手跃迁记录", "#星铁角色跃迁统计", "#星铁更新跃迁", "#星铁更新抽卡", "＊跃迁记录", "#sr更新跃迁2"]) {
    const context = { normalizedMessage, reply() {} };
    expect(await fallbackFeatures(context)).toEqual(["[gacha] 抽卡记录"]);
    expect(await fallback(normalizedMessage, context)).toBe("请从登录档案对应的 QQ 会话使用星铁抽卡记录。");
  }
  for (const normalizedMessage of ["#星铁导出抽卡记录", "#星铁导出跃迁记录json", "＊导出跃迁记录", "#sr导出跃迁记录jsonv2"]) {
    const context = { normalizedMessage, message_type: "group" as const, group_id: 77, user_id: 42, reply() {} };
    expect(await fallbackFeatures(context)).toEqual(["[gacha] 抽卡记录"]);
    expect(await fallback(normalizedMessage, context)).toContain("建议私聊导出");
  }
  for (const normalizedMessage of ["#星铁跃迁记录999", "#星铁导出跃迁记录999", "#绝区零跃迁记录", "#星铁跃迁统计我看看"]) {
    const context = { normalizedMessage, reply() {} };
    expect(await fallbackFeatures(context)).toEqual([]);
  }
});
