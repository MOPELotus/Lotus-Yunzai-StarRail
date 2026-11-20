import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { parsePanelCommand, readLegacyPanel } from "../panel-model.ts";
import { changePanelRelicSets, type PanelRelicSets } from "../panel-relic-set.ts";

const quantum = "繁星璀璨的天才";
const musketeer = "野穗伴行的快枪手";
const arena = "繁星竞技场";
const uid = "100000123";
const avatar = readLegacyPanel(uid, { uid, avatars: { 1102: {
  id: 1102, level: 80, _source: "mysPanelHSR", trees: [],
  artis: Object.fromEntries([61011, 61012, 61013, 61014, 63015, 63016].map((id, i) => [i + 1, {
    id, level: i + 8, star: i === 0 ? 4 : 5, mainId: 1, attrIds: ["7,1,1"],
  }])),
} } }).avatars[0]!;
function set(outer: boolean, base: number) {
  const slots = outer ? [1, 2, 3, 4] : [5, 6];
  return { outer, pieces: new Map(slots.flatMap(slot => [4, 5].map(star =>
    [`${slot}:${star}`, { id: String(base + slot + star * 10000), name: `部位 ${slot}` }] as const))) };
}
const sets: PanelRelicSets = new Map([[quantum, set(true, 10080)], [musketeer, set(true, 10020)], [arena, set(false, 10380)]]);

test("recognizes original set aliases, separators and suffixes", () => {
  const expected = { type: "damage" as const, name: "希儿", scenario: 2, profileId: 2,
    equipment: { relicSets: [quantum, musketeer, arena] } };
  expect(parsePanelCommand("*希儿伤害2换量子套2+快枪2+竞技场2 2")).toEqual(expected);
  expect(parsePanelCommand("#星铁希儿伤害2换量子套2快枪2竞技场2 2")).toEqual(expected);
  expect(parsePanelCommand("*希儿面板换快枪手")).toMatchObject({ equipment: { relicSets: [musketeer] } });
  expect(parsePanelCommand("*希儿面板换乐园")).toMatchObject({ equipment: { relicSets: ["妖精织梦的乐园"] } });
  expect(parsePanelCommand("*希儿换量子套+未知套装")).toBeUndefined();
  expect(parsePanelCommand("*希儿换量子套换五星魂")).toBeUndefined();
});

test("reuses existing slots, rarity, levels and rolls in the source outer and planar groups", () => {
  const before = structuredClone(avatar);
  const changed = changePanelRelicSets(avatar, [arena, quantum, musketeer], sets);
  assert("avatar" in changed);
  expect(changed.avatar.relics.map(part => part.id)).toEqual(["50081", "60082", "60023", "60024", "60385", "60386"]);
  expect(changed.avatar.relics.map(({ slot, rarity, level, legacyMainId, legacySubIds }) =>
    ({ slot, rarity, level, legacyMainId, legacySubIds }))).toEqual(avatar.relics.map(({ slot, rarity, level, legacyMainId, legacySubIds }) =>
    ({ slot, rarity, level, legacyMainId, legacySubIds })));
  const outerOnly = changePanelRelicSets(avatar, [musketeer], sets);
  assert("avatar" in outerOnly);
  expect(outerOnly.avatar.relics.map(part => part.id)).toEqual(["50021", "60022", "60023", "60024", "63015", "63016"]);
  const planarOnly = changePanelRelicSets({ ...avatar, relics: avatar.relics.slice(0, 5) }, [arena], sets);
  assert("avatar" in planarOnly);
  expect(planarOnly.avatar.relics.map(part => part.id)).toEqual(["61011", "61012", "61013", "61014", "60385"]);
  expect(avatar).toEqual(before);
});

test("reports parts or set metadata that cannot be reproduced", () => {
  expect(changePanelRelicSets(avatar, [quantum, arena], new Map())).toMatchObject({ error: expect.stringMatching(/套装资料/) });
  expect(changePanelRelicSets(avatar, [quantum, musketeer, quantum], sets)).toMatchObject({ error: expect.stringMatching(/最多/) });
  expect(changePanelRelicSets({ ...avatar, relics: [] }, [arena], sets)).toMatchObject({ error: expect.stringMatching(/没有可替换/) });
});
