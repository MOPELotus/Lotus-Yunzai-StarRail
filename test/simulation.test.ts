import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockFile } from "../../../lib/file-lock.ts";
import { createStarRailSimulation, parseWarpCommand } from "../simulation/commands.ts";
import { emptyPity, simulateWarps } from "../simulation/draw.ts";
import { createWarpPoolSource, readWarpRandomCandidates } from "../simulation/pools.ts";
import { createWarpSettingsStore, defaultWarpRates } from "../simulation/settings.ts";
import { createWarpArchive, warpDay } from "../simulation/store.ts";

const active = Date.parse("2026-11-20T09:00:00+08:00");

function rolls(...values: number[]) {
  return () => values.shift() ?? 0.99;
}

function output(result: Awaited<ReturnType<ReturnType<typeof createStarRailSimulation>>>) {
  return typeof result === "object" && !Array.isArray(result) && result !== null && "type" in result && result.type === "recallable" ? result.message : result;
}
test("simulation takes old size and pool aliases while leaving real history, update and other games to their handlers", () => {
  for (const [message, expected] of [
    ["#星铁单抽", { kind: "character", count: 1, slot: 1 }],
    ["#星铁单抽2", { kind: "character", count: 1, slot: 2 }],
    ["#星铁光锥三十连", { kind: "cone", count: 30, slot: 1 }],
    ["#星铁百连常驻", { kind: "standard", count: 100, slot: 1 }],
    ["#星铁抽卡光锥池2", { kind: "cone", count: 10, slot: 2 }],
  ] as const) expect(parseWarpCommand(message)).toEqual(expected);
  for (const message of ["#星铁抽卡记录", "#星铁更新抽卡记录", "#星铁逐抽记录", "#星铁十连常驻2", "#星铁常驻十连光锥", "#原神十连"]) {
    expect(parseWarpCommand(message)).toBeUndefined();
  }
});

test("resolves distinct current official banners and expires reruns independently from the main banner", async () => {
  const select = createWarpPoolSource("");
  expect((await select("character", 1, active))?.featuredFive?.name).toBe("星神★阿哈");
  expect((await select("cone", 4, active))?.featuredFive?.name).toBe("当她决定看见");
  const end = Date.parse("2026-12-02T12:00:00+08:00");
  expect((await select("cone", 2, end - 1))?.featuredFive?.name).toBe("欢迎来到银河城");
  expect(await select("cone", 2, end)).toBeUndefined();
  expect((await select("character", 1, end))?.featuredFive?.name).toBe("星神★阿哈");
  expect((await select("standard", 1, end))?.otherFive).toHaveLength(14);
  const directory = await mkdtemp(join(tmpdir(), "warp-banner-test-"));
  try {
    const path = join(directory, "banners.json");
    const banner = { start: "2026-11-01T10:00:00+08:00", end: "2026-12-01T10:00:00+08:00", slot: 1, character: "银枝",
      cone: "片刻，留在眼底", characters4: ["艾丝妲"], cones4: ["论剑"] };
    await writeFile(path, JSON.stringify([banner]));
    const override = createWarpPoolSource(path);
    expect((await override("character", 1, active))?.featuredFive?.name).toBe("银枝");
    await writeFile(path, JSON.stringify([banner, banner]));
    await expect(override("character", 1, active)).rejects.toThrow("活动时间重叠");
    await mkdir(join(directory, "meta-sr", "info"), { recursive: true });
    await writeFile(join(directory, "meta-sr", "info", "index.js"), `export const poolDetailSr = [{ "version": "4.8", "half": "上",
      "from": "2026-12-23 11:00:00", "to": "2027-01-12 11:59:59", "char5": ["银枝"], "weapon5": ["片刻，留在眼底"],
      "char4": ["艾丝妲"], "weapon4": ["论剑"] }]`);
    const automatic = createWarpPoolSource("", () => directory);
    expect(await automatic("character", 1, Date.parse("2026-12-23T10:59:59+08:00"))).toBeUndefined();
    expect((await automatic("character", 1, Date.parse("2026-12-23T11:00:00+08:00")))?.featuredFive?.name).toBe("银枝");
    expect((await automatic("cone", 1, Date.parse("2026-12-23T11:00:00+08:00")))?.featuredFive?.name).toBe("片刻，留在眼底");
    expect(await automatic("cone", 2, Date.parse("2026-12-23T11:00:00+08:00"))).toBeUndefined();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("hard pity and carried guarantees cross the featured slot without crossing the light-cone or standard pools", async () => {
  const select = createWarpPoolSource("");
  const one = (await select("character", 1, active))!;
  const two = (await select("character", 2, active))!;
  const cone = (await select("cone", 1, active))!;
  const standard = (await select("standard", 1, active))!;
  const state = { ...emptyPity(), fiveMisses: 89, fourOrBetterMisses: 9 };
  expect(simulateWarps(one, state, 1, rolls()).at(0)).toMatchObject({ rarity: 5, pity: 90, featured: false, kind: "角色" });
  expect(state).toMatchObject({ fiveMisses: 0, fourOrBetterMisses: 0, nextFiveFeatured: true });
  expect(simulateWarps(two, state, 1, rolls(0)).at(0)).toMatchObject({ name: "银狼LV.999", featured: true, pity: 1 });
  const four = { ...emptyPity(), fourOrBetterMisses: 9 };
  expect(simulateWarps(one, four, 1, rolls()).at(0)).toMatchObject({ rarity: 4, featured: false });
  expect(four.nextFourFeatured).toBe(true);
  expect(simulateWarps(two, four, 1, rolls(0.015)).at(0)).toMatchObject({ rarity: 4, featured: true });
  expect(simulateWarps(cone, { ...emptyPity(), fiveMisses: 79 }, 1, rolls()).at(0)).toMatchObject({ rarity: 5, kind: "光锥", pity: 80 });
  expect(simulateWarps(standard, { ...emptyPity(), fiveMisses: 89 }, 1, rolls()).at(0)).toMatchObject({ rarity: 5, featured: false, pity: 90 });
});

test("concurrent replies debit one wallet, leave each conversation isolated, and reset at Beijing 04:00", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warp-state-test-"));
  try {
    let at = Date.parse("2026-11-20T03:59:00+08:00");
    const make = () => createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal, now: () => at,
      poolSource: createWarpPoolSource(""), random: () => 0.99, render: async () => { throw new Error("unavailable"); } });
    const group = { user_id: 42, group_id: 77 };
    const privateMessage = { user_id: 42 };
    const [left, right] = await Promise.all([make()("#星铁十连常驻", group), make()("#星铁十连常驻", group)]);
    expect([left, right].map(output).filter((value) => typeof value === "string" && value.includes("通票不足"))).toHaveLength(1);
    expect([left, right].map(output).filter((value) => typeof value === "string" && value.includes("10. 4★"))).toHaveLength(1);
    const simulation = make();
    expect(await simulation("#星铁我的星轨票", privateMessage)).toContain("100 张星轨专票和 0 张");
    await simulation("#星铁单抽", group);
    await simulation("#星铁单抽2", group);
    await simulation("#星铁单抽光锥", privateMessage);
    at += 60_000;
    expect(await simulation("#星铁我的星轨票", privateMessage)).toContain("100 张星轨专票和 10 张");
    const doc = JSON.parse(await readFile(join(directory, "42", "1.json"), "utf8"));
    expect(doc.conversations["77"].pity.character.fiveMisses).toBe(2);
    expect(doc.conversations["77"].pity.standard.fiveMisses).toBe(10);
    expect(doc.conversations["77"].pity.cone.fiveMisses).toBe(0);
    expect(doc.conversations.private.pity.cone.fiveMisses).toBe(1);
    expect(await simulation("#星铁十连4", {})).toContain("QQ 会话");
    expect(await simulation("#星铁抽卡记录", group)).toBeUndefined();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("restored simulation wallet and conversation expire at their saved absolute times after restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warp-legacy-expiry-test-"));
  try {
    let now = Date.parse("2026-11-20T10:00:00+08:00");
    const oldPity = { ...emptyPity(), fiveMisses: 89, nextFiveFeatured: true };
    await createWarpArchive(directory, lockFile).update({ qq: "42", uid: "1" }, async () => {}, () => ({
      document: { version: 1, balance: { day: warpDay(now), special: 12, regular: 3, expiresAt: now + 1000 },
        legacy: { balance: true, conversations: ["77", "private"] }, conversations: {
          "77": { lastDay: warpDay(now), expiresAt: now + 2000, pity: { character: oldPity, cone: emptyPity(), standard: emptyPity() } },
          private: { lastDay: warpDay(now), expiresAt: now + 2000, pity: { character: oldPity, cone: emptyPity(), standard: emptyPity() } },
        } }, result: null,
    }));
    const make = () => createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal, now: () => now,
      poolSource: createWarpPoolSource(""), random: () => 0.99, render: async () => { throw new Error("unavailable"); } });
    expect(await make()("#星铁我的星轨票", { user_id: 42 })).toContain("12 张星轨专票和 3 张");
    now += 1000;
    expect(await make()("#星铁我的星轨票", { user_id: 42 })).toContain("100 张星轨专票和 10 张");
    expect(output(await make()("#星铁单抽", { user_id: 42, group_id: 77 }))).toContain("5★ 星神★阿哈 UP（第 90 抽）");
    now += 1000;
    expect(output(await make()("#星铁单抽", { user_id: 42 }))).toContain("3★");
    const result = JSON.parse(await readFile(join(directory, "42", "1.json"), "utf8"));
    expect(result.conversations["77"].expiresAt).toBeUndefined();
    expect(result.conversations["77"].pity.character.fiveMisses).toBe(0);
    expect(result.conversations.private.pity.character.fiveMisses).toBe(1);
    expect(result.legacy).toEqual({ balance: true, conversations: ["77", "private"] });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("owner settings apply per-group new issuance, keep a shared wallet, and hold writes when disabled", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warp-settings-fixture-"));
  try {
    let time = active;
    const make = () => createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal, now: () => time,
      poolSource: createWarpPoolSource(""), random: () => 0.99, render: async () => { throw new Error("fixture"); } });
    const run = make(), user = { user_id: 42, group_id: 77 }, owner = { user_id: 60, group_id: 77, isMaster: true };
    const accountPath = join(directory, "42", "1.json");

    expect(await run("#星铁抽卡设置自定义关闭", user)).toContain("只有主人");
    expect(await run("#设置星铁抽卡专属票30", owner)).toContain("专票 30 张");
    expect(await run("#星铁设置星铁抽卡普通票20", owner)).toContain("通票 20 张");
    expect(await run("#设置星铁抽卡撤回时间0", owner)).toContain("撤回 0 秒");
    expect(await make()("#星铁领取专票", user)).toContain("30 张星轨专票和 20 张");
    expect(await run("#设置星铁抽卡专属票50", owner)).toContain("专票 50 张");
    expect(await run("#星铁我的星轨票", { ...user, group_id: 99 })).toContain("30 张星轨专票和 20 张");
    expect(await run("#星铁抽卡设置百连关闭", owner)).toContain("多连 关闭");
    const bytes = await readFile(accountPath, "utf8");
    expect(await run("#星铁二十连", user)).toContain("未开启多连");
    expect(await run("#星铁抽卡设置自定义关闭", owner)).toContain("模拟 关闭");
    expect(await run("#星铁单抽", user)).toContain("功能已关闭");
    expect(await run("#星铁十连", user)).toContain("功能已关闭");
    expect(await run("#星铁查询星轨票", { ...user, user_id: 43 })).toContain("功能已关闭");
    expect(await run("#星铁抽卡记录", user)).toBeUndefined();
    expect(await readFile(accountPath, "utf8")).toBe(bytes);
    expect(await Bun.file(join(directory, "43", "1.json")).exists()).toBeFalse();
    expect(await run("#星铁抽卡设置自定义开启", owner)).toContain("模拟 开启");
    expect(await run("#星铁抽卡设置百连开启", owner)).toContain("多连 开启");
    expect(await make()("#星铁单抽", user)).toContain("模拟 1 抽");
    expect(await run("#星铁我的星轨票", { user_id: 42 })).toContain("29 张星轨专票和 20 张");
    time += 86_400_000;
    expect(await make()("#星铁我的星轨票", user)).toContain("50 张星轨专票和 20 张");
    expect(await run("#星铁我的星轨票", { user_id: 44 })).toContain("100 张星轨专票和 10 张");
    expect(await run("#星铁抽卡设置总开关关闭", { ...owner, isDelegated: true })).toContain("只有主人");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("custom pools, editable base rates, reset and optional weekly boost remain distinct from official source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warp-rules-fixture-"));
  try {
    let chance = () => 0.01;
    const run = createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal, now: () => active,
      poolSource: createWarpPoolSource(""), random: () => chance(), render: async () => { throw new Error("fixture"); } });
    const owner = { user_id: 60, isMaster: true }, user = { user_id: 42 };
    expect(await run("#星铁抽卡设置五星角色银枝，希儿", owner)).toContain("卡池 手工设置");
    expect(await run("#星铁抽卡设置四星角色三月七", owner)).toContain("四星角色 三月七");
    expect(await run('#星铁抽卡设置五星光锥["片刻，留在眼底","论剑的佳话"]', owner)).toContain("五星光锥 片刻，留在眼底、论剑的佳话");
    expect(await run("#星铁抽卡设置五星角色概率10000", owner)).toContain("五星 10000/10000");
    expect(await run("#星铁抽卡设置小保底概率100", owner)).toContain("小保底 100%");
    expect(output(await run("#星铁单抽2", user))).toContain("5★ 希儿 UP");
    expect(await run("#星铁抽卡设置五星光锥概率10000", owner)).toContain("光锥池五星 10000/10000");
    expect(output(await run("#星铁光锥单抽", user))).toContain("5★ 片刻，留在眼底 UP");
    expect(await run("#星铁抽卡设置概率复位", owner)).toContain("角色池五星 60/10000");
    expect((await createWarpSettingsStore(lockFile, directory).read()).rates).toEqual(defaultWarpRates);
    expect(await run("#星铁抽卡设置卡池同步开启", owner)).toContain("自动同步");
    expect(output(await run("#星铁单抽", user))).toContain("星神★阿哈");
    chance = rolls(0);
    expect(output(await run("#星铁单抽", { user_id: 45 }))).toContain("5★");
    chance = rolls(0.01);
    expect(output(await run("#星铁单抽", { user_id: 45 }))).toContain("5★");
    expect(await run("#星铁抽卡设置每周双黄关闭", owner)).toContain("每周双黄 关闭");
    chance = rolls(0);
    expect(output(await run("#星铁单抽", { user_id: 46 }))).toContain("5★");
    chance = rolls(0.01);
    expect(output(await run("#星铁单抽", { user_id: 46 }))).toContain("4★");
    expect(await run("#星铁抽卡设置随机卡池", owner)).toContain("手工设置");
    const { poolNames } = await createWarpSettingsStore(lockFile, directory).read();
    expect(poolNames.characterFive).toHaveLength(2);
    expect(poolNames.coneFour).toHaveLength(5);
    expect(await run("#星铁抽卡设置四星光锥概率非法", owner)).toContain("请输入");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("random names can use locally installed limited character and cones while manual pools survive source damage", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warp-random-catalog-"));
  try {
    const meta = join(directory, "meta-sr");
    await Promise.all(["character", "weapon"].map(name => mkdir(join(meta, name), { recursive: true })));
    await writeFile(join(meta, "character", "data.json"), JSON.stringify({ 1102: { name: "希儿", star: 5 }, 1001: { name: "三月七", star: 4 } }));
    await writeFile(join(meta, "weapon", "data.json"), JSON.stringify({ 23001: { name: "于夜色中", type: "巡猎", star: 5 },
      21001: { name: "论剑", type: "巡猎", star: 4 } }));
    const candidates = await readWarpRandomCandidates(directory);
    expect(candidates.characterFive).toContain("希儿");
    expect(candidates.coneFive).toContain("于夜色中");
    expect(candidates.characterFour.filter(name => name === "三月七")).toEqual(["三月七"]);

    const run = createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal, now: () => active,
      poolSource: async () => { throw new Error("corrupt upstream fixture"); },
      random: () => 0, render: async () => { throw new Error("fixture"); } });
    const owner = { user_id: 60, isMaster: true }, user = { user_id: 42 };
    expect(await run("#星铁单抽", user)).toContain("无法完成");
    await run("#星铁抽卡设置五星角色希儿", owner);
    await run("#星铁抽卡设置四星角色三月七", owner);
    expect(output(await run("#星铁单抽", user))).toContain("5★ 希儿 UP");
    await run("#星铁抽卡设置卡池同步开启", owner);
    expect(await run("#星铁单抽", user)).toContain("无法完成");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("recall is held for high-rarity batches, budget failures keep metrics, and reincarnation cooldown survives restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warp-lifecycle-fixture-"));
  try {
    let time = active;
    let chance = () => 0.99;
    const signal = new AbortController().signal;
    const make = () => createStarRailSimulation({ directory, lockFile, signal, now: () => time, poolSource: createWarpPoolSource(""),
      random: () => chance(), render: async () => { throw new Error("fixture"); },
      renderReincarnation: async () => { throw new Error("fixture"); } });
    const run = make(), owner = { user_id: 60, group_id: 77, isMaster: true }, user = { user_id: 42, group_id: 77 };
    await run("#星铁设置抽卡撤回时间12", owner);
    expect(await run("#星铁单抽", user)).toMatchObject({ type: "recallable", seconds: 12 });
    expect(await run("#星铁十连", user)).toMatchObject({ type: "recallable", seconds: 12 });
    expect(await run("#星铁四十连", user)).toMatchObject({ type: "forward", recallSeconds: 12 });
    chance = () => 0;
    expect(await run("#星铁十连", user)).toEqual(expect.stringContaining("10 个五星"));
    expect(await run("#星铁二十连", user)).toMatchObject({ type: "forward", nodes: expect.arrayContaining([expect.stringContaining("20 个五星")]) });
    expect(await run("#星铁四十连", user)).toMatchObject({ type: "recallable", seconds: 12,
      message: expect.stringContaining("今日模拟五星 30 个 · 本周 30 个五星") });
    expect(await run("#星铁转生", user)).toContain("阿基维利 · 开拓");
    expect(await make()("#星铁转生", { user_id: 42 })).toContain("等待 120 分钟");
    expect(await run("#星铁抽卡设置转生间隔1", owner)).toContain("转生间隔 1 分钟");
    expect(await run("#星铁转生", owner)).toContain("阿基维利");
    expect(await run("#星铁转生", owner)).toContain("阿基维利");
    time += 120 * 60_000;
    chance = () => 0.99;
    expect(await run("#星铁转生", user)).not.toContain("等待");
    expect(await make()("#星铁转生", user)).toContain("等待 1 分钟");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Fate collaboration uses the two confirmed historical rosters and never substitutes regular banners", async () => {
  for (const message of ["#星铁十连联动", "#星铁抽卡联动角色", "#星铁角色联动十连"]) {
    expect(parseWarpCommand(message)).toEqual({ kind: "collaboration-character", count: 10, slot: 1 });
  }
  for (const message of ["#星铁十连联动光锥", "#星铁光锥联动抽卡", "#星铁联动武器十连"]) {
    expect(parseWarpCommand(message)).toEqual({ kind: "collaboration-cone", count: 10, slot: 1 });
  }
  for (const message of ["#星铁联动卡池", "#星铁抽卡记录", "#星铁十连联动2", "#星铁十连其他联动"]) {
    expect(parseWarpCommand(message)).toBeUndefined();
  }

  const select = createWarpPoolSource("/不存在的普通卡池-fixture.json");
  const firstStart = Date.parse("2025-07-11T12:00:00+08:00");
  expect(await select("collaboration-character", 1, firstStart - 1)).toBeUndefined();
  expect((await select("collaboration-character", 1, firstStart))?.featuredFivePool?.map(item => item.name))
    .toEqual(["Saber", "Archer"]);
  expect(await select("collaboration-character", 2, active)).toBeUndefined();
  const characters = (await select("collaboration-character", 1, active))!;
  const cones = (await select("collaboration-cone", 1, active))!;
  expect(characters.featuredFivePool?.map(item => item.name)).toEqual(["Saber", "Archer", "远坂凛", "吉尔伽美什"]);
  expect(cones.featuredFivePool?.map(item => item.name)).toEqual(["没有回报的加冕", "理想燃烧的地狱", "星火悄然闪耀", "所见即我"]);
  for (const pool of [characters, cones]) {
    expect(pool.featuredFour).toEqual([]);
    const isCone = pool.kind === "collaboration-cone";
    const missed = { ...emptyPity(), fiveMisses: isCone ? 79 : 89 };
    expect(simulateWarps(pool, missed, 1, rolls()).at(0)).toMatchObject({
      rarity: 5, featured: false, pity: isCone ? 80 : 90, kind: isCone ? "光锥" : "角色",
    });
    expect(missed.nextFiveFeatured).toBe(true);
    expect(simulateWarps(pool, missed, 1, rolls(0, 0.99)).at(0)).toMatchObject({
      name: isCone ? "所见即我" : "吉尔伽美什", featured: true, pity: 1,
    });
    const four = { ...emptyPity(), fourOrBetterMisses: 9 };
    expect(simulateWarps(pool, four, 1, rolls()).at(0)).toMatchObject({ rarity: 4, featured: false });
    expect(four.nextFourFeatured).toBe(false);
  }
});

test("collaboration reads v1 three-pool saves and keeps own group, daily summary and cross-day pity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "warp-collaboration-test-"));
  try {
    let now = Date.parse("2026-11-20T03:59:59+08:00");
    const identity = { qq: "42", uid: "1" };
    const archive = createWarpArchive(directory, lockFile);
    const old = { lastDay: warpDay(now), pity: { character: { ...emptyPity(), fiveMisses: 30 }, cone: emptyPity(), standard: emptyPity() },
      today: { day: warpDay(now), standardAndCharacter: 35, cone: 1, five: 0, samples: [] }, week: { id: 0, five: 9 } };
    await archive.update(identity, async () => {}, () => ({
      document: { version: 1, balance: { day: warpDay(now), special: 33, regular: 10 }, conversations: { "77": old } }, result: null,
    }));
    const make = () => createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal,
      poolSource: createWarpPoolSource(""), now: () => now, random: rolls(), render: async () => { throw new Error("fixture"); } });
    const group = { user_id: 42, group_id: 77 };
    expect(output(await make()("#星铁十连联动", group))).toContain("Fate[UBW] 角色联动");
    expect(output(await make()("#星铁十连联动光锥", group))).toContain("Fate[UBW] 光锥联动");
    await make()("#星铁十连联动", { user_id: 42 });
    expect(output(await make()("#星铁十连联动", group))).toContain("今日已累计 10 抽无五星");
    expect(output(await make()("#星铁十连联动光锥", { user_id: 42 }))).toContain("今日已累计 0 抽无五星");
    let value = await archive.read(identity.qq, identity.uid) as { conversations: Record<string, unknown> };
    expect(value.conversations["77"]).toMatchObject({ pity: {
      character: old.pity.character, cone: old.pity.cone, standard: old.pity.standard,
      "collaboration-character": { fiveMisses: 10 }, "collaboration-cone": { fiveMisses: 10 },
    }, today: { standardAndCharacter: 35, cone: 1 }, week: old.week });
    now += 1000;
    await make()("#星铁单抽联动光锥", group);
    value = await archive.read(identity.qq, identity.uid) as typeof value;
    expect(value.conversations["77"]).toMatchObject({ pity: {
      "collaboration-character": { fiveMisses: 10 }, "collaboration-cone": { fiveMisses: 11 },
    }, today: { day: warpDay(now), standardAndCharacter: 0, cone: 0, collaboration: {
      "collaboration-cone": { draws: 1 },
    } } });
    expect(value.conversations.private).toMatchObject({ pity: { "collaboration-character": { fiveMisses: 10 } } });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
