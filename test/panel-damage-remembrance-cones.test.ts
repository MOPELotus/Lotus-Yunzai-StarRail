import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import remembrance from "./fixtures/panel-damage-remembrance-cones.json";

const { avatar, character, setNames, selected, titles, cases } = remembrance;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "记忆",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Remembrance Light Cone ${fixture.id} (${fixture.build})`, () => {
    const { equipped, context } = inputs(fixture);
    const result = readStarRailPersonalDamage(equipped, context).damage!;
    expect(result.selected).toBe(selected);
    expect(result.rows.map(row => row.title)).toEqual(titles);
    fixture.rows.forEach(([critical, average], index) => {
      if (critical === null) expect(result.rows[index]?.critical).toBeUndefined();
      else expect(result.rows[index]?.critical).toBeCloseTo(critical!, 7);
      expect(result.rows[index]?.average).toBeCloseTo(average!, 7);
    });
    const [critical, average] = fixture.swap;
    if (critical === null) expect(result.swaps[0]?.values[1]?.critical).toBeUndefined();
    else expect(result.swaps[0]?.values[1]?.critical).toBeCloseTo(critical!, 7);
    expect(result.swaps[0]?.values[1]?.average).toBeCloseTo(average!, 7);
  });
}

test("distinguishes the original wearer attack and memosprite scenarios in the same saved panel", () => {
  for (const [id, condition] of [
    ["21054", "忆灵的治疗量提高"], ["21057", "忆灵造成的暴击伤害额外提高"],
    ["23049", "【夜色】状态"], ["23052", "敌方全体受到的伤害提高"],
  ] as const) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const wearer = readStarRailPersonalDamage(equipped, context, 1).damage!;
    const sprite = readStarRailPersonalDamage(equipped, context, 4).damage!;
    expect(wearer.rows[wearer.selected]?.title).toBe("普攻");
    expect(sprite.rows[sprite.selected]?.title).toMatch(/^忆灵技/);
    expect(wearer.buffs.some(buff => buff.includes(condition))).toBe(false);
    expect(sprite.buffs.some(buff => buff.includes(condition))).toBe(true);
  }
});

test("honors the old empty cone and the Remembrance Trailblazer-only behavior", () => {
  const burning = cases.find(entry => entry.id === "20021")!;
  const empty = inputs(burning);
  expect(readStarRailPersonalDamage(empty.equipped, empty.context).damage?.buffs.some(buff => buff.startsWith("焚影："))).toBe(false);
  expect(readStarRailPersonalDamage(empty.equipped, { ...empty.context, conePath: "虚无" }).damage).toBeUndefined();
  expect(readStarRailPersonalDamage({ ...empty.equipped, cone: { ...empty.equipped.cone, id: "29999", name: "焚影" } }, empty.context).damage)
    .toBeUndefined();

  const pink = inputs(cases.find(entry => entry.id === "22006")!);
  const result = readStarRailPersonalDamage(pink.equipped, pink.context).damage!;
  expect(result.rows.every(row => row.active.every(buff => !buff.includes("开拓者•记忆装备时")))).toBe(true);
  for (const id of ["8007", "8008"]) {
    expect(readStarRailPersonalDamage({ ...pink.equipped, id }, pink.context).reason).toBe("该星铁角色的个人伤害规则尚未接入");
  }
});
