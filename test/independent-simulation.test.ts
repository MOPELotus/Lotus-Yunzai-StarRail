import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockFile } from "../../../lib/file-lock.ts";
import { createStarRailSimulation } from "../simulation/commands.ts";
import { convertIndependentWarpSettings } from "../simulation/independent-settings.ts";
import { createWarpPoolSource } from "../simulation/pools.ts";

test("独立 gccfg 顶层覆盖，保留群私分开、旧撤回默认、无限和禁群", () => {
  expect(convertIndependentWarpSettings({}, { limit: { group: false, count: 0 }, recall: { enable: true, time: 0 },
    disable_group: [77, "77", "78"] })).toEqual({
    enabled: true, group: false, private: false, dailyTenPulls: 0, disabledGroups: ["77", "78"], recallSeconds: 110,
  });
  expect(convertIndependentWarpSettings(undefined, { recall: { enable: false, time: 110 } }).recallSeconds).toBe(0);
  expect(() => convertIndependentWarpSettings({}, { limit: { count: -1 } })).toThrow("YAML 无效");
});

test("原群和私聊旧键按本人读取，五池各计次数，跨本机零点留保底，独立模拟不用现行票", async () => {
  const directory = await mkdtemp(join(tmpdir(), "independent-warp-test-"));
  const time = new Date(2026, 10, 24, 23, 59);
  let now = time.getTime();
  let random = 0.03;
  const keys: string[] = [];
  const old = (stars: unknown[], num5 = 0, isUp5 = false) => ({ num4: 0, num5, isUp5, isUp4: false, today: { stars } });
  const privateUser = { user_id: 42 };
  const group = { ...privateUser, group_id: 77 };
  const settingsFile = join(directory, "independent-settings", "1", "1.json");
  async function configure(overrides = {}) {
    await mkdir(join(directory, "independent-settings", "1"), { recursive: true });
    await writeFile(settingsFile, JSON.stringify({ enabled: true, group: true, private: true, dailyTenPulls: 1,
      disabledGroups: ["78"], recallSeconds: 110, ...overrides }));
  }
  try {
    await configure();
    const simulate = createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal,
      poolSource: createWarpPoolSource(""), now: () => now, random: () => random,
      render: async () => { throw new Error("text fixture"); },
      async readIndependentLegacy(key) {
        keys.push(key);
        if (key !== "sr-gacha:group:77:user:42") return;
        return { expiresAt: time.getTime() + 900_000,
          raw: JSON.stringify({ time: "2026-11-24", "up-char": old(Array.from({ length: 10 }, () => ({ star: 3 })), 90, true),
            "up-weapon": old([]) }) };
      },
    });
    expect(await simulate("#星铁十连", group)).toContain("今日已抽 10 抽");
    expect(await simulate("#星铁十连", group)).toContain("今日已抽 10 抽");
    expect(keys).toEqual(["sr-gacha:group:77:user:42"]);
    expect(await simulate("#星铁十连联动", { ...group, group_id: 78 })).toContain("本群已被禁用");
    expect(keys).toHaveLength(1);
    const privateDraw = await simulate("#星铁十连", privateUser);
    expect(privateDraw).toMatchObject({ type: "recallable", seconds: 110 });
    expect((privateDraw as { message: string }).message).toContain("10 个四星");
    expect(keys).toEqual(["sr-gacha:group:77:user:42", "sr-gacha:private:42"]);
    expect(await simulate("#星铁十连常驻", group)).toMatchObject({ type: "recallable", seconds: 110 });
    expect(await simulate("#星铁十连光锥", group)).toMatchObject({ type: "recallable", seconds: 110 });
    expect(await simulate("#星铁十连联动", group)).toMatchObject({ type: "recallable", seconds: 110 });
    expect(await simulate("#星铁十连联动光锥", group)).toMatchObject({ type: "recallable", seconds: 110 });
    expect(await simulate("#星铁我的星轨票", privateUser)).toContain("100 张星轨专票和 10 张");
    random = 0.99;
    now += 120_000;
    expect(await simulate("#星铁十连", group)).toContain("星神★阿哈 UP（第 91 抽）");
    expect(await simulate("#星铁十连", group)).toContain("今日已抽 10 抽");
    expect(await simulate("#星铁十连", { ...group, isMaster: true })).toMatchObject({ type: "recallable", seconds: 110 });
    const archive = JSON.parse(await readFile(join(directory, "independent-group", "42", "77.json"), "utf8"));
    expect(archive.day).toBe("2026-11-25");
    expect(Object.values(archive.pools).filter(value => !!value)).toHaveLength(5);
    expect(archive.pools.character).toMatchObject({ draws: 20, five: 1 });
    expect(archive.pools.standard.draws).toBe(0);
    expect(archive.expiresAt).toBe(now + 14 * 86_400_000);

    await configure({ private: false, dailyTenPulls: 0 });
    expect(await simulate("#星铁十连", privateUser)).toBeUndefined();
    expect(await simulate("#星铁十连", group)).toMatchObject({ type: "recallable", seconds: 110 });
    expect(await simulate("#星铁单抽", privateUser)).toMatchObject({ type: "recallable", seconds: 30 });
    expect(await simulate("#星铁我的星轨票", privateUser)).toContain("99 张星轨专票和 10 张");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
