import { expect, test } from "bun:test";
import { lockFile } from "../../../lib/file-lock.ts";
import { createModule } from "../index.ts";

test("star rail routes unbranded gacha queries and help through the gacha feature", async () => {
  const { fallback, fallbackFeatures } = createModule({ signal: new AbortController().signal, lockFile });
  const context = (normalizedMessage: string) => ({ normalizedMessage, reply() {} });
  const commands = ["光锥记录2", "版本统计2", "新手记录2"];
  for (const command of commands) {
    const current = `#星铁${command}`;
    expect(fallbackFeatures(context(current))).toEqual(["[gacha] 抽卡记录"]);
    expect(await fallback(current, context(current))).toBe("请从登录档案对应的 QQ 会话使用星铁抽卡记录。");

    const retired = `#星铁喵喵${command}`;
    expect(fallbackFeatures(context(retired))).toEqual([]);
    expect(await fallback(retired, context(retired))).toBeUndefined();
  }
  const help = "#星铁抽卡帮助";
  expect(fallbackFeatures(context(help))).toEqual(["[gacha] 抽卡记录"]);
  expect(await fallback(help, context(help))).toContain("*版本统计");
});
