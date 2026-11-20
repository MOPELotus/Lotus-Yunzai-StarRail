import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { changePanelCoreSkills } from "../panel-skill-preview.ts";
import { parsePanelCommand, readLegacyPanel } from "../panel-model.ts";

const uid = "100000123";
const source = readLegacyPanel(uid, { uid, avatars: { 1102: {
  id: 1102, level: 80, cons: 6, _source: "mysPanelHSR", talent: { a: 6, e: 10, q: 10, t: 10, xe: 7 },
  trees: ["1102102"], weapon: { id: 23001, level: 80, affix: 3 },
} } }).avatars[0]!;
const input = { a: 6, e: 10, t: 9, q: 12 };
const thresholds = { a: 5, e: 3, t: 3, q: 5 };

test("matches original four effective skills and separates the archive suffix", () => {
  for (const request of ["技能6 10 9 12", "天赋610912", "行迹6 10 9 12"]) {
    expect(parsePanelCommand(`#星铁希儿伤害2换${request}`)).toMatchObject({
      type: "damage", profileId: 1, scenario: 2, equipment: { skillLevels: input },
    });
    expect(parsePanelCommand(`*希儿面板换${request} 2`)).toMatchObject({
      type: "detail", profileId: 2, equipment: { skillLevels: input },
    });
  }
  expect(parsePanelCommand("*希儿换技能6,10,9,12")).toBeUndefined();
  expect(parsePanelCommand("*希儿换技能6 10 9")).toBeUndefined();
  expect(parsePanelCommand("*希儿换技能6 10 9 16")).toBeUndefined();
});

test("uses effective levels in both snapshot models and matches the old capped display", () => {
  const before = structuredClone(source);
  for (const avatar of [source, { ...source, legacy: undefined }]) {
    const result = changePanelCoreSkills(avatar, input, thresholds);
    assert("avatar" in result);
    expect(result.avatar.skills.map(({ key, level, original }) => [key, level, original]))
      .toEqual([["a", 6, 5], ["e", 10, 8], ["t", 9, 7], ["q", 12, 10]]);
    expect(result.avatar).toMatchObject({ level: 80, rank: 6, cone: avatar.cone, traces: avatar.traces });
  }
  const capped = changePanelCoreSkills(source, { ...input, a: 15, t: 2 }, thresholds);
  assert("avatar" in capped);
  expect(capped.avatar.skills[0]).toMatchObject({ level: 10, original: 14 });
  expect(capped.avatar.skills[2]).toMatchObject({ level: 2, original: 0 });
  expect(changePanelCoreSkills(source, input, {})).toMatchObject({ error: expect.stringMatching(/加级资料/) });
  expect(source).toEqual(before);
});
