import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readStarRailGachaItems } from "../gacha-detail-source.ts";
import { makePanelDetailCard, readTheme } from "../panel-card.ts";
import { normalizePanel } from "../panel-model.ts";

const catalogName = "当第一声「阿哈」响起";
const displayName = "当第一声『阿哈』响起";

test("light-cone panel artwork follows the catalog id while keeping the source display title", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-star-rail-panel-art-"));
  try {
    const weapons = join(root, "meta-sr", "weapon");
    const asset = join(weapons, "欢愉", catalogName, "splash.webp");
    await mkdir(join(weapons, "欢愉", catalogName), { recursive: true });
    await writeFile(join(weapons, "data.json"), JSON.stringify({ 23065: { name: catalogName, type: "欢愉", star: 5 } }));
    await writeFile(asset, "physical path fixture");
    const sample = normalizePanel("100000121", [{ id: 1511, name: "星神★阿哈", level: 80, element: "Quantum",
      equip: { id: 23065, name: displayName, level: 80, rank: 1 } }]);
    const model = await makePanelDetailCard(sample, sample.avatars[0]!, await readTheme(root), new AbortController().signal);
    expect(model.element).toBe("量子");
    expect(model.data.weapon?.name).toBe(displayName);
    expect(fileURLToPath(model.data.weapon!.splash)).toBe(asset);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("warp images resolve the two title quote styles only within the matching Star Rail item kind", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-star-rail-warp-art-"));
  try {
    const weapon = join(root, "meta-sr", "weapon");
    await mkdir(weapon, { recursive: true });
    const dataFile = join(weapon, "data.json");
    const catalog = { 23065: { name: catalogName, type: "欢愉", star: 5 } };
    await writeFile(dataFile, JSON.stringify(catalog));
    let resolve = await readStarRailGachaItems(root);
    expect(resolve({ name: displayName, item_type: "光锥" })).toMatchObject({ id: "23065", name: displayName,
      img: `meta-sr/weapon/欢愉/${catalogName}/icon.webp` });
    expect(resolve({ name: displayName, item_type: "角色" })).toBeUndefined();
    await writeFile(dataFile, JSON.stringify({ ...catalog, 23066: { name: "当第一声「阿哈』响起", type: "欢愉", star: 5 } }));
    resolve = await readStarRailGachaItems(root);
    expect(resolve({ name: catalogName, item_type: "光锥" })?.id).toBe("23065");
    expect(resolve({ name: displayName, item_type: "光锥" })).toBeUndefined();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("draw records resolve character separator variants without mixing forms", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-star-rail-portrait-"));
  try {
    const characters = join(root, "meta-sr", "character");
    await mkdir(characters, { recursive: true });
    const dataFile = join(characters, "data.json");
    const catalog = {
      1002: { name: "丹恒", star: 4 }, 1213: { name: "丹恒•饮月", star: 5 },
      1414: { name: "丹恒•腾荒", star: 5 }, 8007: { name: "穹·记忆", star: 5 }, 8008: { name: "星·记忆", star: 5 },
    };
    await writeFile(dataFile, JSON.stringify(catalog));
    let resolve = await readStarRailGachaItems(root);
    expect(resolve({ name: "丹恒·饮月", item_type: "角色" })).toMatchObject({ id: 1213, name: "丹恒·饮月",
      img: "/meta-sr/character/丹恒•饮月/imgs/face.webp" });
    expect(resolve({ name: "丹恒·腾荒", item_type: "角色" })?.id).toBe(1414);
    expect(resolve({ name: "丹恒", item_type: "角色" })?.id).toBe(1002);
    expect(resolve({ name: "穹•记忆", item_type: "角色" })?.id).toBe(8007);
    expect(resolve({ name: "星•记忆", item_type: "角色" })?.id).toBe(8008);
    expect(resolve({ name: "丹恒·饮月", item_type: "光锥" })).toBeUndefined();
    await writeFile(dataFile, JSON.stringify({ ...catalog, 1999: { name: "丹恒·饮月", star: 5 } }));
    resolve = await readStarRailGachaItems(root);
    expect(resolve({ name: "丹恒•饮月", item_type: "角色" })?.id).toBe(1213);
    expect(resolve({ name: "丹恒・饮月", item_type: "角色" })).toBeUndefined();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("official panel detail keeps the effective skill level and recovers the original where supported", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-star-rail-panel-skill-"));
  try {
    const characters = join(root, "meta-sr", "character");
    const avatar = join(characters, "飞霄");
    await mkdir(avatar, { recursive: true });
    await writeFile(join(characters, "data.json"), JSON.stringify({ 1220: { name: "飞霄", weapon: "巡猎" } }));
    await writeFile(join(avatar, "data.json"), JSON.stringify({ id: 1220, talentCons: { q: 3, a: 3, e: 5 } }));
    const sample = normalizePanel("100000121", [{ id: 1220, name: "飞霄", level: 80, rank: 3,
      skills: [{ remake: "终结技", level: 12 }, { remake: "普攻", level: 6 },
        { remake: "战技", level: 10 }, { remake: "天赋", level: 9 }] }]);
    const theme = await readTheme(root);
    const signal = AbortSignal.abort();
    const model = await makePanelDetailCard(sample, sample.avatars[0]!, theme, signal);
    expect(model.data.talent.q).toEqual({ level: 12, original: 10 });
    expect(model.data.talent.a).toEqual({ level: 6, original: 5 });
    expect(model.data.talent.e).toEqual({ level: 10, original: 10 });
    expect(model.data.talent.t).toEqual({ level: 9, original: undefined });
    expect(sample.avatars[0]?.skills.find(skill => skill.key === "q")).toEqual({ key: "q", level: 12, icon: "" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
