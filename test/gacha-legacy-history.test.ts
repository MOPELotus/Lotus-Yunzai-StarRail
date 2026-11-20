import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { starRailGachaPools, type StarRailGachaPool } from "@lotus-yunzai/hoyo-client";
import { lockFile } from "../../../lib/file-lock.ts";
import type { StarRailGachaSnapshot } from "../gacha-history.ts";
import { createStarRailGachaHistoryStore } from "../gacha-store.ts";

const qq = "42";
const uid = "100001242";
const type = "GachaType_AvatarUp";
const oldId = "1735853810000001902";
const newId = "1735853810000001903";
const previous = {
  version: 1, qq, uid, profileId: 2, region: "prod_gf_cn",
  pools: { [type]: {
    fiveStars: [{ id: oldId, item: { item_id: 1204 }, gacha_count: 13 }], totalDraws: 20, pity: 7,
    cardCounters: { older: 20 },
  } },
};

test("用旧安装只读历史补齐首次同步，主档建立后仍以主档为准", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-legacy-history-"));
  const current = join(root, "current");
  const old = join(root, "old");
  const renamed = join(root, "renamed");
  const currentFile = join(current, qq, uid + ".json");
  const oldFile = join(old, qq, uid + ".json");
  const renamedFile = join(renamed, qq, uid + ".json");
  const original = JSON.stringify(previous, null, 2) + "\r\n";
  try {
    await Promise.all([oldFile, renamedFile].map(async (file) => {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, original);
    }));
    const store = createStarRailGachaHistoryStore(current, lockFile, [old, renamed]);
    expect(await store.read(qq, uid)).toBeNull();
    expect(await store.readLegacy(qq, uid)).toEqual(previous);
    expect(await Bun.file(currentFile).exists()).toBe(false);
    const latest: StarRailGachaSnapshot = {
      uid, region: "prod_gf_cn", revision: "fixture-profile", refreshedCookie: false, brief: { version_id: "", items: [] },
      pools: (Object.keys(starRailGachaPools) as StarRailGachaPool[]).map(pool => ({
        type: pool, name: starRailGachaPools[pool], pity: null,
        cards: pool === type ? [{ gacha_id: "newer", total_count: 30, up_count: 1 }] : [],
        fiveStars: pool === type ? [{ id: newId, uuid: "", got_item: null, item: { item_id: 1204 }, gacha_count: 30 }] : [],
      })),
    };
    const verifyProfile = async () => {};
    const update = await store.merge({ qq, profileId: 2 }, latest, verifyProfile);
    const pool = update.log.pools[type];
    expect(pool.totalDraws).toBe(50);
    expect(pool.fiveStars.map(row => row.id)).toEqual([newId, oldId]);
    expect(await Promise.all([oldFile, renamedFile].map(file => readFile(file, "utf8")))).toEqual([original, original]);
    await writeFile(renamedFile, JSON.stringify({ ...previous, profileId: 3 }));
    await expect(store.readLegacy(qq, uid)).rejects.toThrow("不一致");
    expect(await store.read(qq, uid)).toEqual(update.log);
    expect((await store.merge({ qq, profileId: 2 }, latest, verifyProfile)).added).toBe(0);

    const mismatchedFile = join(renamed, qq, "100001243.json");
    await writeFile(mismatchedFile, original);
    await expect(store.readLegacy(qq, "100001243")).rejects.toThrow("身份不一致");
    expect(await readFile(mismatchedFile, "utf8")).toBe(original);
    expect(await readFile(oldFile, "utf8")).toBe(original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
