import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { calculateEquipmentAttributeRows, changePanelLevel } from "../panel-attributes.ts";
import { parsePanelCommand, readLegacyPanel } from "../panel-model.ts";

const uid = "100000123";
const source = readLegacyPanel(uid, { uid, avatars: { 1102: {
  id: 1102, elem: "量子", level: 80, promote: 6, cons: 2, _source: "mysPanelHSR",
  talent: { a: 6, e: 10, q: 10, t: 10 }, trees: [],
  weapon: { id: 23001, level: 70, affix: 1, promote: 5 },
} } }).avatars[0]!;
const attr = Object.fromEntries(Array.from({ length: 7 }, (_, phase) => [phase, {
  attrs: { hp: 300 + phase * 100, atk: 500, def: 400, speed: 100 },
  grow: { hp: 3 },
}]));
const weaponAttr = Object.fromEntries(Array.from({ length: 7 }, (_, phase) => [phase, {
  attrs: { hp: 300 + phase * 40, atk: 60, def: 45 },
}]));
const metadata = {
  character: { elem: "量子", weapon: "巡猎", attr, tree: {} },
  cone: { attr: weaponAttr, growAttr: { hp: 1 }, skill: { tables: { 1: [18, 21, 24, 27, 30] } } },
  conePath: "巡猎", relicMetadata: {}, setForId: () => undefined,
};

test("recognizes fixed character level forms and distinguishes the level from the archive number", () => {
  for (const request of ["70级", "等级 70", "等级:70"]) {
    expect(parsePanelCommand(`#星铁希儿伤害2换${request}`)).toMatchObject({
      type: "damage", profileId: 1, name: "希儿", scenario: 2, equipment: { level: 70 },
    });
    expect(parsePanelCommand(`*希儿面板换${request} 2`)).toMatchObject({
      type: "detail", profileId: 2, name: "希儿", equipment: { level: 70 },
    });
  }
  expect(parsePanelCommand("*希儿换等级70")).toBeUndefined();
  expect(parsePanelCommand("*希儿换81级")).toBeUndefined();
  expect(parsePanelCommand("*希儿换70级武器")).not.toMatchObject({ equipment: { level: 70 } });
});

test("uses the old lower boundary for a new level and preserves the known phase at the same level", () => {
  const before = structuredClone(source);
  const preview = changePanelLevel(source, 70, metadata);
  assert(preview.avatar);
  expect(preview.promotion).toBe(5);
  expect(preview.avatar).toMatchObject({ level: 70, rank: 2, skills: source.skills, traces: source.traces, cone: source.cone });
  expect(calculateEquipmentAttributeRows(preview.avatar, metadata, preview.promotion)?.find(row => row.key === "hp")?.base)
    .toBe(1576);
  expect(changePanelLevel({ ...source, level: 70 }, 70, metadata).promotion).toBe(6);
  expect(changePanelLevel(source, 71, metadata).promotion).toBe(6);
  expect(changePanelLevel({ ...source, cone: { ...source.cone!, promote: undefined } }, 70, metadata).avatar?.cone?.promote).toBe(5);
  expect(source).toEqual(before);
});

test("compares managed base HP to boundary pairs without guessing an unknown phase", () => {
  const managed = { ...source, legacy: undefined, level: 70, cone: { ...source.cone!, promote: undefined },
    stats: [{ key: "hp", base: "1716", value: "1900" }] };
  const preview = changePanelLevel(managed, 70, metadata);
  expect(preview.promotion).toBe(6);
  expect(preview.avatar?.cone?.promote).toBe(6);
  expect(changePanelLevel(managed, 60, metadata).promotion).toBe(4);
  expect(changePanelLevel({ ...managed, stats: [] }, 70, metadata).error).toMatch(/缺少可确认/);
  const ambiguous = { ...metadata, cone: { ...metadata.cone, attr: { ...weaponAttr, 6: weaponAttr[5] } } };
  expect(changePanelLevel({ ...managed, stats: [{ key: "hp", base: "1676", value: "1900" }] }, 70, ambiguous).error)
    .toMatch(/缺少可确认/);
});


test("combines one level and one eidolon in source orderings, including a level separated from the archive", () => {
  for (const request of ["70级换零魂", "零魂换70级", "70级零魂", "零星魂70级", "零魂换等级 70", "零魂等级 70", "等级 70零魂"]) {
    expect(parsePanelCommand(`#星铁希儿伤害2换${request}`)).toMatchObject({
      type: "damage", profileId: 1, scenario: 2, equipment: { level: 70, eidolon: 0 },
    });
    expect(parsePanelCommand(`*希儿面板换${request} 2`)).toMatchObject({
      type: "detail", profileId: 2, equipment: { level: 70, eidolon: 0 },
    });
  }
  expect(parsePanelCommand("*希儿换81级六魂")).toBeUndefined();
  expect(parsePanelCommand("*希儿换70级换飞霄光锥换六魂")).toBeUndefined();
});


test("combines level and full traces in the original separate and compact forms", () => {
  for (const request of ["70级换满行迹", "满行迹换70级", "70级满行迹", "满行迹70级", "满行迹换等级 70", "满行迹等级 70", "等级 70满行迹"]) {
    expect(parsePanelCommand(`#星铁希儿伤害2换${request}`)).toMatchObject({
      type: "damage", profileId: 1, scenario: 2, equipment: { level: 70, fullTraces: true },
    });
    expect(parsePanelCommand(`*希儿面板换${request} 2`)).toMatchObject({
      type: "detail", profileId: 2, equipment: { level: 70, fullTraces: true },
    });
  }
  expect(parsePanelCommand("*希儿换满行迹81级")).toBeUndefined();
  expect(parsePanelCommand("*希儿换满行迹换70级换满行迹")).toBeUndefined();
});


test("recognizes the original distinct level, eidolon and full trace fields in one preview", () => {
  const variants = [
    "70级换零魂换满行迹", "满行迹换70级换零魂", "零魂换满行迹换等级 70", "满行迹零魂换70级",
    "零魂70级换满行迹", "70级零魂满行迹", "满行迹零魂等级 70", "等级 70满行迹零星魂",
  ];
  for (const variant of variants) {
    expect(parsePanelCommand(`#星铁希儿伤害2换${variant}`)).toMatchObject({
      type: "damage", profileId: 1, scenario: 2, equipment: { level: 70, eidolon: 0, fullTraces: true },
    });
    expect(parsePanelCommand(`*希儿面板换${variant} 2`)).toMatchObject({
      type: "detail", profileId: 2, equipment: { level: 70, eidolon: 0, fullTraces: true },
    });
  }
  expect(parsePanelCommand("*希儿换满行迹零魂换70级换六魂")).toBeUndefined();
  expect(parsePanelCommand("*希儿换零魂换满行迹换81级")).toBeUndefined();
  expect(parsePanelCommand("*希儿换满行迹零魂换70级换70级")).toBeUndefined();
});
