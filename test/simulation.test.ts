import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockFile } from "../../../lib/file-lock.ts";
import { createStarRailSimulation, parseWarpCommand } from "../simulation/commands.ts";
import { emptyPity, simulateWarps } from "../simulation/draw.ts";
import { createWarpPoolSource } from "../simulation/pools.ts";
import { createWarpArchive, warpDay } from "../simulation/store.ts";

const active = Date.parse("2026-11-20T09:00:00+08:00");

function rolls(...values: number[]) {
  return () => values.shift() ?? 0.99;
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
    expect([left, right].filter((value) => typeof value === "string" && value.includes("通票不足"))).toHaveLength(1);
    expect([left, right].filter((value) => typeof value === "string" && value.includes("10. 4★"))).toHaveLength(1);
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
    expect(await make()("#星铁单抽", { user_id: 42, group_id: 77 })).toContain("5★ 星神★阿哈 UP（第 90 抽）");
    now += 1000;
    expect(await make()("#星铁单抽", { user_id: 42 })).toContain("3★");
    const result = JSON.parse(await readFile(join(directory, "42", "1.json"), "utf8"));
    expect(result.conversations["77"].expiresAt).toBeUndefined();
    expect(result.conversations["77"].pity.character.fiveMisses).toBe(0);
    expect(result.conversations.private.pity.character.fiveMisses).toBe(1);
    expect(result.legacy).toEqual({ balance: true, conversations: ["77", "private"] });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
