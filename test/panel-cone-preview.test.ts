import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { changePanelNamedCone } from "../panel-cone-preview.ts";
import { parsePanelCommand, readLegacyPanel } from "../panel-model.ts";

const uid = "100000123";
const target = readLegacyPanel(uid, { uid, avatars: { 1102: {
  id: 1102, level: 80, cons: 2, _source: "mysPanelHSR", talent: { a: 6, e: 10, t: 10, q: 10 }, trees: [],
  weapon: { id: 23001, level: 70, promote: 6, affix: 4 },
} } }).avatars[0]!;
const newCone = { id: "23012", name: "如泥酣眠", star: 5 };

test("resolves fixed Star Rail weapon names and aliases without guessing a name", () => {
  for (const name of ["如泥酣眠", "酣眠", "彦卿专武"]) {
    expect(parsePanelCommand(`#星铁希儿伤害2换${name} 2`)).toMatchObject({
      type: "damage", name: "希儿", profileId: 2, scenario: 2, equipment: { namedCone: "23012" },
    });
  }
  expect(parsePanelCommand("*希儿换陌生光锥")).toMatchObject({ equipment: { donor: "陌生", slots: [0] } });
  expect(parsePanelCommand("*希儿换不可识别的名称")).toBeUndefined();
  expect(parsePanelCommand("*希儿换三叠影如泥酣眠")).toMatchObject({ equipment: { superimposition: 3, coneName: "如泥酣眠" } });
});

test("keeps the archive equipment and applies old level, promotion and rarity defaults", () => {
  const before = structuredClone(target);
  const result = changePanelNamedCone(target, newCone, 5);
  assert("avatar" in result);
  expect(result.avatar.cone).toEqual({
    id: "23012", name: "如泥酣眠", level: 70, promote: 6, rank: 4, image: "", description: "",
  });
  const fromLowerRarity = changePanelNamedCone(target, newCone, 4);
  assert("avatar" in fromLowerRarity);
  expect(fromLowerRarity.avatar.cone?.rank).toBe(1);
  const missingTier = changePanelNamedCone({ ...target, cone: { ...target.cone!, rank: undefined } }, { ...newCone, star: 4 }, 5);
  assert("avatar" in missingTier);
  expect(missingTier.avatar.cone?.rank).toBe(5);
  expect(changePanelNamedCone({ ...target, cone: undefined }, newCone, undefined)).toMatchObject({
    error: expect.stringMatching(/缺少能确认/),
  });
  expect(target).toEqual(before);
});
