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
