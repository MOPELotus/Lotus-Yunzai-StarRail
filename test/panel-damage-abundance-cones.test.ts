import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import abundance from "./fixtures/panel-damage-abundance-cones.json";

const { avatar, character, setNames, selected, titles, cases } = abundance;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "丰饶",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Abundance Light Cone ${fixture.id} (${fixture.build})`, () => {
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

test("reads Effect RES and applies the original Perfect Timing healing cap", () => {
  const fixture = cases.find(entry => entry.id === "21014" && entry.build === "normal")!;
  const { equipped, context } = inputs(fixture);
  const stats = equipped.stats.filter(stat => stat.key !== "effDef");
  expect(readStarRailPersonalDamage({ ...equipped, stats }, context).reason).toBe("缺少光锥所需的效果抵抗");
  for (const [value, bonus] of [["0%", "0"], ["46%", "20.7"], ["60%", "27"], ["100%", "27"]] as const) {
    const damage = readStarRailPersonalDamage({
      ...equipped, stats: [...stats, { key: "effDef", base: "0", value }],
    }, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("此时恰好：") && buff.endsWith("提高治疗量" + bonus + "%"))).toBe(true);
  }
});

test("reads Break Effect and includes extra vulnerability at 150 percent", () => {
  const fixture = cases.find(entry => entry.id === "23032")!;
  const { equipped, context } = inputs(fixture);
  const stats = equipped.stats.filter(stat => stat.key !== "stance");
  expect(readStarRailPersonalDamage({ ...equipped, stats }, context).reason).toBe("缺少光锥所需的击破特攻");
  for (const [value, bonus] of [["149.999%", "18"], ["150%", "34"], ["151%", "34"]] as const) {
    const damage = readStarRailPersonalDamage({
      ...equipped, stats: [...stats, { key: "stance", base: "0", value }],
    }, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("唯有香如故：") && buff.includes("受到的伤害提高" + bonus + "%"))).toBe(true);
  }
});

test("keeps the original healing reminders and distinct empty Abundance cones", () => {
  for (const id of ["21000", "20001"]) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const reminder = readStarRailPersonalDamage(equipped, context).damage!;
    const empty = readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "20008" } }, { ...context, cone: {} }).damage!;
    const value = (row: typeof empty.rows[number]) => [row.title, row.average, row.critical];
    expect(reminder.buffs.some(buff => buff.includes("旧试算提示"))).toBe(true);
    expect(reminder.rows.map(value)).toEqual(empty.rows.map(value));
    expect(reminder.rows.some(row => row.metric === "heal")).toBe(true);
  }
  for (const [id, name] of [["20008", "嘉果"], ["21021", "等价交换"], ["20015", "蕃息"]] as const) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const damage = readStarRailPersonalDamage(equipped, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith(name + "："))).toBe(false);
    expect(readStarRailPersonalDamage(equipped, { ...context, conePath: "虚无" }).damage).toBeUndefined();
    expect(readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "29999", name } }, context).damage).toBeUndefined();
  }
});
