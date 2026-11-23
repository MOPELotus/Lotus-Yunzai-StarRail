import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseStarRailPoolInfo, readStarRailPoolInfo } from "../gacha-pool-info.ts";
import { parsePanelCommand } from "../panel-model.ts";

test("keeps explicit Star Rail version queries separate from bare Genshin versions and personal draw commands", () => {
  expect(parseStarRailPoolInfo("#星铁4.1下半卡池")).toEqual({ type: "version", version: "4.1", half: "下半" });
  expect(parseStarRailPoolInfo(" #星铁3.0卡池 ")).toEqual({ type: "version", version: "3.0", half: "" });
  expect(parseStarRailPoolInfo("#星铁卡池帮助")).toEqual({ type: "help" });
  expect(parseStarRailPoolInfo("#白厄卡池")).toEqual({ type: "item", detail: false, item: "白厄", explicit: false });
  expect(parseStarRailPoolInfo("*白厄跃迁")).toEqual({ type: "item", detail: true, item: "白厄", explicit: true });
  expect(parseStarRailPoolInfo("白厄跃迁")).toEqual({ type: "item", detail: true, item: "白厄", explicit: false });
  expect(parseStarRailPoolInfo("*3.4上半跃迁")).toEqual({ type: "version", version: "3.4", half: "上半" });
  for (const message of ["*联动卡池", "*联动跃迁", "#星铁联动跃迁", "星铁联动卡池", "#*星铁联动卡池"]) {
    expect(parseStarRailPoolInfo(message)).toEqual({ type: "collaboration", explicit: true });
  }
  expect(parsePanelCommand("#星铁白厄卡池详情")).toBeUndefined();
  expect(parsePanelCommand("#星铁4.1下半卡池详情")).toBeUndefined();
  expect(parseStarRailPoolInfo("#星铁舞舞舞卡池详细")).toEqual({ type: "item", detail: true, item: "舞舞舞", explicit: true });
  for (const message of ["#4.1卡池", "#原神芙宁娜卡池", "#绝区零铃卡池", "#星铁光锥记录", "#星铁角色池十连", "#星铁4.1下半卡池详情"]) {
    expect(parseStarRailPoolInfo(message)).toBeUndefined();
  }
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "lotus-star-rail-history-pools-"));
  const dir = join(root, "meta-sr");
  for (const sub of ["character", "weapon", "info"]) await mkdir(join(dir, sub), { recursive: true });
  const characters = ["白厄", "万敌", "风堇", "艾丝妲"];
  const cones = ["舞！舞！舞！", "与行星相会", "晨光①", "晨光②", "晨光③", "晨光④", "晨光⑤", "晨光⑥", "晨光⑦"];
  await writeFile(join(dir, "character", "data.json"), JSON.stringify(Object.fromEntries(characters.map((name, index) =>
    [1401 + index, { name, star: name === "艾丝妲" ? 4 : 5 }]))));
  await writeFile(join(dir, "weapon", "data.json"), JSON.stringify(Object.fromEntries([...cones, "欢迎来到银河城"].map((name, index) =>
    [23001 + index, { name, type: "同谐", star: name === "欢迎来到银河城" ? 5 : 4 }]))));
  await writeFile(join(dir, "weapon", "alias.js"), `export const abbr = { '舞！舞！舞！': '舞舞舞' }\nexport const aliasCfg = {\n  // example\n '舞！舞！舞！': '舞舞舞,舞光锥'\n}`);
  const rule = { char4: ["艾丝妲"], weapon5: ["欢迎来的银河城"], weapon4: cones };
  const windows = [
    { ...rule, version: "3.3", half: "下半", from: "2025-06-11 12:00:00", to: "2025-07-01 14:59:59", char5: ["风堇"] },
    { ...rule, version: "3.7", half: "下半", from: "2025-11-26 12:00:00", to: "2025-12-16 14:59:59", char5: ["白厄", "万敌"] },
    { ...rule, version: "3.8", half: "上半", from: "2025-12-17 06:00:00", to: "2026-01-07 11:59:59", char5: ["风堇"] },
    { ...rule, version: "3.8", half: "中场", from: "2026-01-07 12:00:00", to: "2026-01-28 11:59:59", char5: ["白厄", "风堇"] },
    { ...rule, version: "3.8", half: "下半", from: "2026-01-28 12:00:00", to: "2026-02-12 14:59:59", char5: ["万敌"] },
    { ...rule, version: "4.10", half: "下半", from: "2026-11-01 12:00:00", to: "2026-11-22 14:59:59", char5: ["白厄"] },
  ];
  await writeFile(join(dir, "info", "index.js"), `export const poolDetailSr = ${JSON.stringify(windows)}`);
  return root;
}

test("keeps all source half labels, sorts down first, and loads real Star Rail metadata identifiers", async () => {
  const root = await fixture();
  try {
    const model = await readStarRailPoolInfo(root, { type: "version", version: "3.8", half: "" });
    expect(model?.pools.map(({ half }) => half)).toEqual(["下半", "上半", "中场", ""]);
    expect(model?.pools[0]?.groups.map(({ star }) => star)).toEqual([5, 4, 5, 4]);
    expect(model?.pools[0]?.groups[2]?.rows[0]?.[0]).toMatchObject({ name: "欢迎来到银河城", img: "meta-sr/weapon/同谐/欢迎来到银河城/icon.webp" });
    expect(model?.pools[0]?.groups[3]?.rows.map(row => row.length)).toEqual([8, 1]);
    expect(model?.reprint).toBeUndefined();
    const half = await readStarRailPoolInfo(root, { type: "version", version: "3.8", half: "上半" });
    expect(half?.pools.map(({ half }) => half)).toEqual(["上半", ""]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("compact groups keep peers and every rerun, while future windows do not reset the last completed rerun clock", async () => {
  const root = await fixture();
  try {
    const at = (date: string) => Date.parse(date + "+08:00");
    const character = { type: "item", item: "白厄", detail: false, explicit: true } as const;
    const model = await readStarRailPoolInfo(root, character, at("2026-02-07T12:00:00"));
    expect(model?.pools.map(({ version, half }) => [version, half])).toEqual([["4.10", "下半"], ["3.8", "中场"], ["3.7", "下半"]]);
    expect(model?.pools[1]?.groups.map(({ rows }) => rows.flatMap(row => row.map(({ name }) => name)))).toEqual([["白厄", "风堇"]]);
    expect(model?.reprint).toEqual({ up: false, days: 10, text: "该角色/武器已 10 天未复刻" });
    for (const edge of ["2026-01-07T12:00:00", "2026-01-28T11:59:59"]) {
      const active = await readStarRailPoolInfo(root, character, at(edge));
      expect(active?.reprint?.up).toBe(true);
    }
    const future = await readStarRailPoolInfo(root, character, at("2025-01-01T00:00:00"));
    expect(future?.reprint).toBeUndefined();
    const cone = { type: "item", item: "舞光锥", explicit: true } as const;
    const compact = await readStarRailPoolInfo(root, { ...cone, detail: false });
    expect(compact?.pools).toHaveLength(6);
    expect(compact?.pools[0]?.groups.map(g => g.rows.map(row => row.length))).toEqual([[8, 1]]);
    const full = await readStarRailPoolInfo(root, { ...cone, detail: true });
    expect(full?.pools[0]?.groups.map(({ title }) => title)).toEqual(["五星角色", "四星角色", "五星武器", "四星武器"]);
    const unknown = await readStarRailPoolInfo(root, { ...cone, item: "芙宁娜", detail: false });
    expect(unknown).toBeUndefined();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("首期联动名单可独立查询，只有命中的 3.4 及以后真实排期附带首期", async () => {
  const root = await fixture();
  try {
    const selected = await readStarRailPoolInfo(root, { type: "collaboration", explicit: true });
    expect(selected?.pools).toHaveLength(1);
    const pool = selected!.pools[0]!;
    expect(pool).toMatchObject({ version: "联动1.0", half: "", from: "2025-07-11 12:00:00", to: "未知" });
    expect(pool.groups.map(({ title, rows }) => [title, rows.flatMap(row => row.map(item => item.name))])).toEqual([
      ["五星角色", ["Saber", "Archer"]], ["五星武器", ["没有回报的加冕", "理想燃烧的地狱"]],
    ]);
    for (const item of ["吾王", "Archer", "saber专武", "理想燃烧的地狱"]) {
      const model = await readStarRailPoolInfo(root, { type: "item", item, explicit: true, detail: true });
      expect(model?.pools).toEqual([pool]);
      expect(model?.reprint).toBeUndefined();
    }
    const older = await readStarRailPoolInfo(root, { type: "version", version: "3.3", half: "" });
    expect(older?.pools.map(row => row.version)).toEqual(["3.3"]);
    const later = await readStarRailPoolInfo(root, { type: "version", version: "4.10", half: "下半" });
    expect(later?.pools.map(row => row.version)).toEqual(["4.10", "联动1.0"]);
    for (const options of [{ version: "9.9", half: "" }, { version: "4.10", half: "上半" }]) {
      expect(await readStarRailPoolInfo(root, { type: "version", ...options })).toBeUndefined();
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
