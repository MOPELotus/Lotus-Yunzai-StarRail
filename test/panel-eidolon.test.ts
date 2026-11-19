import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { changePanelEidolon } from "../panel-eidolon.ts";
import { parsePanelCommand, readLegacyPanel, type PanelAvatar } from "../panel-model.ts";

const uid = "100000123";
const legacy = readLegacyPanel(uid, { uid, avatars: { 1102: {
  id: 1102, level: 80, cons: 5, _source: "mysPanelHSR",
  talent: { a: 6, e: 10, q: 9, t: 8 }, trees: [],
  weapon: { id: 23001, level: 80, affix: 3 },
} } }).avatars[0]!;
const upgrades = { a: 5, e: 3, q: 5, t: 3, me: 5, mt: 3, xe: [3, 5] };
const managed = { ...legacy, legacy: undefined, skills: [
  ...legacy.skills.map(skill => ({ ...skill, level: { a: 7, e: 12, q: 11, t: 10 }[skill.key]! })),
  { key: "me", level: 7, icon: "" }, { key: "mt", level: 5, icon: "" }, { key: "xe", level: 10, icon: "" },
] };

test("accepts the fixed original constellation syntax, including zero, max and explicit archive", () => {
  expect(parsePanelCommand("#星铁希儿伤害2换六星魂 2")).toEqual({
    type: "damage", profileId: 2, name: "希儿", scenario: 2, equipment: { eidolon: 6 },
  });
  expect(parsePanelCommand("*希儿面板换零魂")).toMatchObject({ type: "detail", equipment: { eidolon: 0 } });
  expect(parsePanelCommand("*希儿换满命")).toMatchObject({ type: "detail", equipment: { eidolon: 6 } });
  expect(parsePanelCommand("*希儿面板换七魂")).toBeUndefined();
  expect(parsePanelCommand("*希儿面板换五星魂换5叠影武器")).toBeUndefined();
});

test("keeps original levels in a legacy cache and adjusts managed base, memo and double Elation upgrade levels", () => {
  const before = structuredClone({ legacy, managed });
  const original = changePanelEidolon(legacy, 6, { a: 5, e: 3, q: 5, t: 3 });
  assert("avatar" in original);
  expect(original.avatar).toMatchObject({ rank: 6, skills: legacy.skills, cone: legacy.cone, traces: legacy.traces });
  function preview(target: PanelAvatar, rank: number) {
    const result = changePanelEidolon(target, rank, upgrades);
    assert("avatar" in result);
    return result.avatar.skills;
  }
  const levels = (rank: number) => preview(managed, rank).map(skill => skill.level);
  expect(levels(0)).toEqual([6, 10, 9, 8, 6, 4, 8]);
  expect(levels(2)).toEqual([6, 10, 9, 8, 6, 4, 8]);
  expect(levels(3)).toEqual([6, 12, 9, 10, 6, 5, 9]);
  expect(levels(4)).toEqual([6, 12, 9, 10, 6, 5, 9]);
  expect(levels(5)).toEqual([7, 12, 11, 10, 7, 5, 10]);
  expect(levels(6)).toEqual([7, 12, 11, 10, 7, 5, 10]);
  const unboosted = { ...managed, rank: 0, skills: preview(managed, 0) };
  expect(preview(unboosted, 6).map(skill => skill.level)).toEqual(levels(6));
  expect({ legacy, managed }).toEqual(before);
});

test("rejects incomplete or ambiguous saved skill data", () => {
  const invalid = [
    { ...managed, rank: undefined },
    { ...managed, skills: managed.skills.filter(skill => skill.key !== "mt") },
    { ...managed, skills: managed.skills.map(skill => skill.key === "e" ? { ...skill, level: 2 } : skill) },
    { ...managed, skills: managed.skills.map(skill => skill.key === "e" ? { ...skill, level: 15 } : skill) },
  ];
  const message = { error: expect.stringMatching(/缺少可确认/) };
  for (const avatar of invalid) expect(changePanelEidolon(avatar, 0, upgrades)).toMatchObject(message);
  expect(changePanelEidolon(managed, 6, undefined)).toMatchObject(message);
  expect(changePanelEidolon(managed, 6, { ...upgrades, xe: [] })).toMatchObject(message);
});
