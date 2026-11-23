import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parsePanelCommand, normalizePanel, readLegacyPanel } from "../panel-model.ts";
import { collectPanelRelics, readTheme } from "../panel-card.ts";
import { scoreStarRailRelics } from "../relic-score.ts";

const uid = "500000123";
const fields = { name: "银枝", abbr: "银枝", element: "物理" };
const legacy = readLegacyPanel(uid, { uid, avatars: { "1302": {
  id: 1302, name: "银枝", level: 80, promote: 6, cons: 2, _source: "mysPanelHSR",
  artis: { "1": { id: 61021, level: 15, star: 5, mainId: 1, attrIds: ["7,2,1"] },
    "3": { id: 61023, level: 15, star: 5, mainId: 4, attrIds: ["8,3,3", "9,1,0"] },
    "5": { id: 63015, level: 15, star: 5, mainId: 5, attrIds: ["8,2,2", "9,2,2"] },
  },
} } }).avatars[0]!;

test("matches per-character relic commands and keeps real draw logs separate", () => {
  expect(parsePanelCommand("#星铁三月遗器2")).toEqual({ type: "relics", profileId: 2, name: "三月" });
  expect(parsePanelCommand("*托帕&账账圣遗物 4")).toEqual({ type: "relics", profileId: 4, name: "托帕&账账" });
  for (const command of ["*逐抽记录", "*阵容伤害", "*凯文遗器256"]) {
    expect(parsePanelCommand(command)).toBeUndefined();
  }
});

test("scores only available pieces with role weights and applies the out-of-element penalty", () => {
  const card = scoreStarRailRelics(legacy, fields)!;
  expect(card.incomplete).toBe(0);
  expect(card.artis[1]?.main).toMatchObject({ key: "hpPlus", value: "705.6" });
  expect(card.artis[3]?.main).toMatchObject({ key: "cpct", value: "32.4%" });
  expect(card.artis[5]?.mainFactor).toBe(0.5);
  const matching = scoreStarRailRelics(legacy, { ...fields, element: "火" })!;
  expect(matching.artis[5]?.mainFactor).toBe(1);
  expect(matching.artis[5]!._mark).toBeGreaterThan(card.artis[5]!._mark);
  expect(Number(card.mark)).toBeCloseTo(Object.values(card.artis).reduce((total, piece) => total + piece._mark, 0), 1);
  const invalid = { ...legacy, relics: [...legacy.relics, { ...legacy.relics[1]!, slot: 2, legacyMainId: "none" }] };
  expect(scoreStarRailRelics(invalid, fields)?.incomplete).toBe(1);
});

test("matches official relic shapes, fixed main affixes and original profile weighting variants", () => {
  const [avatar] = normalizePanel(uid, [{ id: 1218, name: "椒丘", level: 80, rank: 6, relics: [
    { id: 61021, pos: 1, rarity: 5, level: 15, main_property: { property_type: 27, value: "706" },
      properties: [{ property_type: 52, value: "6.2%", times: 2 }] },
  ] }]).avatars;
  const card = scoreStarRailRelics(avatar!, { name: "椒丘", abbr: "椒丘", element: "火", base: { hp: 1358, atk: 602, def: 509 } })!;
  expect(card.charCfg.classTitle).toBe("椒丘-满魂");
  expect(card.artis[1]?.main.key).toBe("hpPlus");
  expect(card.artis[1]?.attrs[0]?.key).toBe("cpct");
  expect(card.charWeight.cpct).toBe(100);
  expect(scoreStarRailRelics({ ...avatar!, rank: 5 }, { name: "椒丘", abbr: "椒丘", element: "火", base: { hp: 1358, atk: 602, def: 509 } })
    ?.charCfg.classTitle).toBe("椒丘-通用");
  expect(scoreStarRailRelics({ ...avatar!, id: "1511" }, { name: "星神★阿哈", abbr: "星神", element: "量子", base: { hp: 1358, atk: 602, def: 509 } })
    ?.charCfg.ignoreMain).toEqual([5, 6]);
});

test("汇总遗器沿用同档案、旧筛选、降序和并列逆序", async () => {
  const scope = new AbortController().signal;
  const theme = await readTheme(new URL("./nonexistent-panel-theme", import.meta.url).pathname);
  const base = { ...legacy, id: "1218", name: "椒丘", rank: 6 };
  const original = { ...legacy.relics[0]!, legacyMainId: undefined, legacySubIds: undefined, name: "头部",
    main: { key: "hp", value: "706" }, subs: [{ key: "hp", value: "33" }] };
  const sorted = Array.from({ length: 32 }, (_, index) => ({
    ...base, relics: [{ ...original, name: `测试头部 ${index}` }],
  }));
  sorted[0]!.relics.push(
    { ...original, slot: 2, name: "只有有效主词条", main: { key: "atk", value: "350" }, subs: [{ key: "stance", value: "5%" }] },
    { ...original, slot: 3, name: "保留有效副词条", main: { key: "cpct", value: "32%" }, subs: [{ key: "cdmg", value: "22%" }] },
  );
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-relic-list-"));
  try {
    const configRoot = pathToFileURL(root + "/");
    const config = join(root, "config/panel-rank.yaml");
    const snapshot = { version: 1, uid, source: "legacy", avatars: sorted } as const;
    const result = await collectPanelRelics(snapshot, theme, scope, configRoot);
    expect(result.eligible).toBe(34);
    expect(result.entries).toHaveLength(28);
    expect(result.entries[0]?.part.name).toBe("保留有效副词条");
    expect(result.entries[1]?.part.name).toBe("测试头部 31");
    expect(result.entries[27]?.part.name).toBe("测试头部 5");
    expect(result.entries.some(({ part }) => part.name === "只有有效主词条")).toBeFalse();
    expect(result.entries.every(({ scored }, index) => !index || scored._mark <= result.entries[index - 1]!.scored._mark)).toBeTrue();
    await mkdir(join(root, "config"));
    await writeFile(config, "artifactListLimit: 4\n");
    expect((await collectPanelRelics(snapshot, theme, scope, configRoot)).entries).toEqual(result.entries.slice(0, 4));
    await writeFile(config, "artifactListLimit: 100\n");
    expect((await collectPanelRelics(snapshot, theme, scope, configRoot)).entries).toHaveLength(33);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("星铁遗器列表兼容旧入口、档案号与末尾 UID，避开原神圣遗物列表", () => {
  expect(parsePanelCommand("*遗器列表")).toEqual({ type: "relic-list", name: "", profileId: 1 });
  expect(parsePanelCommand("#遗器列表")).toEqual({ type: "relic-list", name: "", profileId: 1 });
  expect(parsePanelCommand("#星铁圣遗物列表2")).toEqual({ type: "relic-list", name: "", profileId: 2 });
  expect(parsePanelCommand("*遗器列表100000123 档案2")).toEqual({ type: "relic-list", name: "", profileId: 2, uid: "100000123" });
  expect(parsePanelCommand("*遗器列表1810000123")).toEqual({ type: "relic-list", name: "", profileId: 1, uid: "1810000123" });
  for (const command of ["#圣遗物列表", "#原神圣遗物列表", "*遗器列表256", "*遗器列表1000001232"]) {
    expect(parsePanelCommand(command)).toBeUndefined();
  }
});
