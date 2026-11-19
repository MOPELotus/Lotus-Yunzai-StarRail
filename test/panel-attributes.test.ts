import { expect, test } from "bun:test";
import { calculateLegacyPanelAttributes, leveledAttributes } from "../panel-attributes.ts";
import { readLegacyPanel } from "../panel-model.ts";

const uid = "100000123";
const parts = Object.fromEntries([1, 2, 3, 4, 5, 6].map((slot) => [slot, {
  id: String(61010 + slot), level: 15, star: 5, mainId: 1, attrIds: slot === 3 ? ["7,2,1"] : [],
}]));
const data = {
  uid, avatars: { 1302: { id: 1302, name: "银枝", elem: "物理", level: 80, promote: 6, _source: "mysPanelHSR",
    weapon: { id: 23018, level: 80, promote: 6, affix: 3 },
    trees: ["1302201", "1302202", "1302101"], artis: parts } },
};
const character = {
  elem: "物理", weapon: "智识",
  attr: { 6: { attrs: { hp: 1000, atk: 500, def: 500, speed: 100, cpct: 5, cdmg: 50 }, grow: { hp: 1 } } },
  tree: { 1302201: { key: "atk", value: 4 }, 1302202: { key: "phy", value: 8 } },
};
const cone = {
  attr: { 6: { attrs: { hp: 50, atk: 50, def: 50 } } },
  growAttr: { hp: 5, atk: 5, def: 5 },
  skill: { tables: { 1: [36, 42, 48, 54, 60] } },
};
const relicMetadata = {
  mainIdx: { 1: { 1: "hpPlus" }, 2: { 1: "atkPlus" }, 3: { 1: "cpct" },
    4: { 1: "speed" }, 5: { 1: "phy" }, 6: { 1: "stance" } },
  starData: { 5: {
    main: {
      hpPlus: { base: 100, step: 10 }, atkPlus: { base: 30, step: 3 },
      cpct: { base: 10, step: 1 }, speed: { base: 5, step: 1 },
      phy: { base: 5, step: 2 }, stance: { base: 8, step: 1 },
    },
    sub: { 7: { key: "speed", base: 2, step: 0.3 } },
  } },
};
const setForId = (id: string) => Number(id) < 61015 ? "野穗伴行的快枪手" : "盗贼公国塔利亚";
const options = { character, cone, conePath: "智识", relicMetadata, setForId };

test("matches the old static panel for promotes, trace, cone superimposition and set bonuses", () => {
  const avatar = readLegacyPanel(uid, data).avatars[0]!;
  const stats = calculateLegacyPanelAttributes(avatar, options);
  expect(stats?.filter(({ key }) => ["hp", "atk", "speed", "cpct", "cdmg", "phy", "stance"].includes(key))).toEqual([
    { key: "hp", base: "1524", value: "1774" },
    { key: "atk", base: "945", value: "1171.2" },
    { key: "speed", base: "100", value: "130.3" },
    { key: "cpct", base: "5%", value: "30%" },
    { key: "cdmg", base: "50%", value: "98%" },
    { key: "phy", base: "0%", value: "43%" },
    { key: "stance", base: "0%", value: "39%" },
  ]);
  expect(calculateLegacyPanelAttributes(avatar, { ...options, conePath: "毁灭" })?.find(({ key }) => key === "cdmg")?.value).toBe("50%");
});

test("does not invent pre/post ascension or lose an unknown cached relic silently", () => {
  expect(leveledAttributes(character, 70, undefined, false)).toBeUndefined();
  const avatar = readLegacyPanel(uid, data).avatars[0]!;
  expect(calculateLegacyPanelAttributes(avatar, { ...options, setForId: () => undefined })).toBeUndefined();
  expect(calculateLegacyPanelAttributes({ ...avatar, legacy: undefined }, options)).toBeUndefined();
});

test("reads the indexed promotion array used by the enhanced Firefly source", () => {
  const { attr } = character;
  const enhanced = { ...character, attr: [...Array<null>(6).fill(null), attr[6]] };
  expect(leveledAttributes(enhanced, 80, 6, false)).toEqual(leveledAttributes(character, 80, 6, false));
  expect(leveledAttributes(enhanced, 70, 5, false)).toBeUndefined();
});
