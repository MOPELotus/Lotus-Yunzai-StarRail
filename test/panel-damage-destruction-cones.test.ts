import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import destruction from "./fixtures/panel-damage-destruction-cones.json";

const { avatar, character, setNames, selected, titles, cases } = destruction;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "毁灭",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Destruction Light Cone ${fixture.id} (${fixture.build})`, () => {
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

test("requires maximum HP for Flame of Blood, Blaze My Path and applies the extra bonus above 500 HP", () => {
  const fixture = cases.find(entry => entry.id === "23039")!;
  const { equipped, context } = inputs(fixture);
  const stats = equipped.stats.filter(stat => stat.key !== "hp");
  expect(readStarRailPersonalDamage({ ...equipped, stats }, context).reason).toBe("缺少光锥所需的生命上限");
  for (const [hp, bonus] of [[6249.9, 50], [6250, 50], [6250.1, 100]]) {
    const damage = readStarRailPersonalDamage({
      ...equipped,
      stats: [...stats, { key: "hp", base: "2500", value: String(hp) }],
    }, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("血火啊，燃烧前路：") && buff.endsWith("本次伤害提高" + bonus + "%"))).toBe(true);
  }
});

test("requires the actual maximum energy for 所见即我 and caps the bonus", () => {
  const fixture = cases.find(entry => entry.id === "23062")!;
  const { equipped, context } = inputs(fixture);
  for (const sp of [undefined, 0, -1, Number.NaN]) {
    expect(readStarRailPersonalDamage(equipped, { ...context, character: { ...context.character, sp } }).reason)
      .toBe("缺少光锥所需的角色能量上限");
  }
  for (const [sp, bonus] of [[120, 48], [359, 143.6], [360, 144], [361, 144]]) {
    const damage = readStarRailPersonalDamage(equipped, { ...context, character: { ...context.character, sp } }).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("所见即我：") && buff.includes("终结技伤害提高" + bonus + "%"))).toBe(true);
  }
});

test("keeps the original static-only rule and rejects unknown or cross-path equipment", () => {
  const fixture = cases.find(entry => entry.id === "21033")!;
  const { equipped, context } = inputs(fixture);
  const damage = readStarRailPersonalDamage(equipped, context).damage!;
  expect(damage.buffs.some(buff => buff.startsWith("无处可逃："))).toBe(false);
  expect(readStarRailPersonalDamage(equipped, { ...context, conePath: "虚无" }).damage).toBeUndefined();
  expect(readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "29999", name: "无处可逃" } }, context).damage).toBeUndefined();
});
