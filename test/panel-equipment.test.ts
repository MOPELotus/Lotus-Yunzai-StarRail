import { expect, test } from "bun:test";
import { parsePanelCommand, readLegacyPanel } from "../panel-model.ts";
import { changePanelSuperimposition, replacePanelEquipment } from "../panel-equipment.ts";

const uid = "100000123";
const { avatars: [target, donor] } = readLegacyPanel(uid, { uid, avatars: {
  1102: { id: 1102, level: 80, _source: "mysPanelHSR", weapon: { id: 23001, level: 80, affix: 1 },
    artis: { 1: { id: 61081, level: 15, star: 5, mainId: 1, attrIds: [] }, 2: { id: 61082, level: 15, star: 5, mainId: 1, attrIds: [] } } },
  1220: { id: 1220, level: 75, _source: "mysPanelHSR", weapon: { id: 23030, level: 70, promote: 5, affix: 3 },
    artis: { 1: { id: 61011, level: 12, star: 5, mainId: 1, attrIds: ["9,2,2"] } } },
} });

test("accepts original Star Rail parts, details, bare target and damage with an archive number", () => {
  expect(parsePanelCommand("#星铁希儿面版换飞霄武器+帽子+手部+衣服+靴+球+链接绳")).toEqual({
    type: "detail", profileId: 1, name: "希儿", scenario: undefined, equipment: { donor: "飞霄", slots: [0, 1, 2, 3, 4, 5, 6] },
  });
  expect(parsePanelCommand("*希儿伤害2 换 飞霄遗器 2")).toEqual({
    type: "damage", profileId: 2, name: "希儿", scenario: 2, equipment: { donor: "飞霄", slots: ["relics"] },
  });
  expect(parsePanelCommand("*希儿换飞霄头")?.type).toBe("detail");
  expect(parsePanelCommand("*希儿换飞霄头换银枝光锥")).toBeUndefined();
  expect(parsePanelCommand("*希儿换飞霄100000123光锥")).toBeUndefined();
  expect(parsePanelCommand("#星铁100000123希儿换飞霄光锥")).toBeUndefined();
});

test("copies exactly the requested donor equipment without changing either snapshot record", () => {
  const before = structuredClone([target, donor]);
  const cachedDonor = { ...donor!, cone: { ...donor!.cone!, description: "缓存里保存的旧说明" } };
  const replaced = replacePanelEquipment(target!, cachedDonor, [0, 1]);
  expect(replaced.avatar).toMatchObject({
    id: "1102", level: 80, cone: { id: "23030", level: 70, promote: 5, rank: 3, description: "" }, stats: [],
    relics: [{ slot: 1, id: "61011", legacySubIds: ["9,2,2"] }, { slot: 2, id: "61082" }],
  });
  expect(replaced.label).toBe("临时换装 · 飞霄 · 光锥、头部");
  expect([target, donor]).toEqual(before);
  expect(cachedDonor.cone.description).toBe("缓存里保存的旧说明");
  expect(replacePanelEquipment(target!, donor!, [1, 1]).error).toMatch(/只能指定一次/);
  const all = parsePanelCommand("*希儿换飞霄遗器");
  if (!all || !("equipment" in all) || !("slots" in all.equipment)) throw new Error("missing relic command");
  expect(replacePanelEquipment(target!, donor!, all.equipment.slots).avatar?.relics).toEqual(donor!.relics);
  expect(replacePanelEquipment(target!, donor!, [2]).error).toMatch(/缺少可用的手部记录/);
});


test("parses numeric, Chinese and full superimposition tiers for the currently equipped light cone", () => {
  expect(parsePanelCommand("*希儿伤害2换五叠影武器 2")).toEqual({
    type: "damage", profileId: 2, name: "希儿", scenario: 2, equipment: { superimposition: 5, coneName: "武器" },
  });
  expect(parsePanelCommand("#星铁希儿面板换叠影3 于夜色中")).toMatchObject({
    type: "detail", name: "希儿", profileId: 1, equipment: { superimposition: 3, coneName: "于夜色中" },
  });
  expect(parsePanelCommand("*希儿换满精光锥")).toMatchObject({ equipment: { superimposition: 5, coneName: "光锥" } });
  expect(parsePanelCommand("*希儿换叠影6武器")).toBeUndefined();
  expect(parsePanelCommand("*希儿换叠影3")).toBeUndefined();
});

test("changes only the current light cone tier and recomputes its description from theme data", () => {
  const source = { ...target!, cone: { ...target!.cone!, name: "于夜色中", description: "原叠影描述" } };
  const before = structuredClone(source);
  const changed = changePanelSuperimposition(source, 5, "于夜色中", "");
  expect(changed.avatar).toEqual({ ...source, cone: { ...source.cone, rank: 5, description: "" }, stats: [] });
  expect(changed.label).toBe("临时换装 · 于夜色中 · 叠影5阶");
  expect(source).toEqual(before);
  expect(changePanelSuperimposition(source, 4, "如泥酣眠", "").error).toMatch(/当前装备/);
  expect(changePanelSuperimposition({ ...source, cone: undefined }, 4, "武器", "").error).toMatch(/没有光锥/);
});


test("combines exactly one eidolon segment and one same-archive donor segment in either order", () => {
  const expected = {
    type: "damage" as const, profileId: 2, name: "希儿", scenario: 2, equipment: { eidolon: 0, donor: "飞霄", slots: [0, 1] },
  };
  expect(parsePanelCommand("#星铁希儿伤害2换零星魂换飞霄光锥+头部 2")).toEqual(expected);
  expect(parsePanelCommand("*希儿伤害2换飞霄光锥+头部 换 零魂 2")).toEqual(expected);
  expect(parsePanelCommand("*希儿面板换飞霄遗器换六魂")).toMatchObject({
    type: "detail", equipment: { eidolon: 6, donor: "飞霄", slots: ["relics"] },
  });
  expect(parsePanelCommand("*希儿换飞霄光锥换六魂换银枝头")).toBeUndefined();
  expect(parsePanelCommand("*希儿换飞霄光锥换叠影5武器")).toBeUndefined();
  expect(parsePanelCommand("*希儿换零魂换飞霄100000123光锥")).toBeUndefined();
  expect(parsePanelCommand("*希儿换飞霄光锥换零魂换")).toBeUndefined();
  expect(parsePanelCommand("*希儿换零魂换满魂")).toBeUndefined();
});
