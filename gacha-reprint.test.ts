import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { queryStarRailPoolInfo, readStarRailPoolInfo, readStarRailReprint } from "./gacha-pool-info.ts";

const first = { version: "3.4", half: "上半", from: "2025-07-02 06:00:00", to: "2025-07-23 11:59:59",
  char5: ["白厄", "姬子"], char4: ["丹恒", "停云"], weapon5: ["欢迎来的银河城"], weapon4: ["舞！舞！舞！", "记忆中的模样"] };
const next = { ...first, version: "3.3", half: "下半", from: "2025-09-03 06:00:00", to: "2025-09-24 11:59:59" };

test("星铁旧复刻按北京日期分期，角色与光锥各保留原同池的五四星", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-reprint-"));
  try {
    const meta = join(root, "meta-sr");
    for (const directory of ["character", "weapon", "info"]) await mkdir(join(meta, directory), { recursive: true });
    const characters = { 1408: { name: "白厄", star: 5 }, 1003: { name: "姬子", star: 5 }, 1002: { name: "丹恒", star: 4 } };
    const weapons = { 21021: { name: "舞！舞！舞！", type: "harmony", star: 4 }, 23052: { name: "欢迎来到银河城", type: "remembrance", star: 5 } };
    await Promise.all([
      writeFile(join(meta, "character/data.json"), JSON.stringify(characters)),
      writeFile(join(meta, "weapon/data.json"), JSON.stringify(weapons)),
      writeFile(join(meta, "weapon/alias.js"), 'export const aliasCfg = { "舞！舞！舞！": "舞舞舞" }'),
      writeFile(join(meta, "info/index.js"), `export const poolDetailSr = ${JSON.stringify([first, next])}`),
    ]);
    const before = Date.parse("2025-09-01T23:59:59+08:00");
    const role = await readStarRailReprint(root, "白厄老婆", before);
    expect(role).toEqual({ type: "forward", nodes: [
      "白厄卡池详情", "下期UP，还有2天开启卡池",
      "所属版本：3.3 下半\n五星UP：白厄，姬子\n四星UP：丹恒，停云\n开始时间：2025-09-03 06:00:00\n结束时间：2025-09-24 11:59:59",
      "所属版本：3.4 上半\n五星UP：白厄，姬子\n四星UP：丹恒，停云\n开始时间：2025-07-02 06:00:00\n结束时间：2025-07-23 11:59:59",
    ] });
    expect(await readStarRailReprint(root, "1408", before)).toEqual(role);
    expect(await readStarRailReprint(root, "舞舞舞", before)).toMatchObject({ type: "forward", nodes: [
      "舞！舞！舞！卡池详情", expect.anything(),
      expect.stringContaining("五星UP：欢迎来到银河城\n四星UP：舞！舞！舞！，记忆中的模样"), expect.anything(),
    ] });
    expect(await readStarRailReprint(root, "姬子", before)).toBe("常驻角色不支持查询");
    expect(await readStarRailReprint(root, "白厄", Date.parse("2025-09-24T19:00:00+08:00")))
      .toMatchObject({ nodes: ["白厄卡池详情", "当期UP，今天结束卡池", expect.anything(), expect.anything()] });
    expect(await readStarRailReprint(root, "白厄", Date.parse("2025-09-25T00:00:00+08:00")))
      .toMatchObject({ nodes: ["白厄卡池详情", "1天未复刻", expect.anything(), expect.anything()] });

    const normal = await readStarRailPoolInfo(root, { type: "item", item: "白厄", detail: false, explicit: true }, before);
    expect(normal?.pools[0]?.groups).toHaveLength(1);
    const signal = new AbortController().signal;
    for (const command of ["#白厄复刻", "#原神芙宁娜复刻", "#绝区零艾莲复刻", "#星铁复刻表", "#星铁白厄复刻统计"]) {
      expect(await queryStarRailPoolInfo(command, signal)).toBeUndefined();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
