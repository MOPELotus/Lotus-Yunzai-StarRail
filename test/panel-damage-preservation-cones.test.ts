import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import preservation from "./fixtures/panel-damage-preservation-cones.json";
import mixedFixtures from "./fixtures/panel-damage-harmony-break.json";

const { avatar, character, setNames, selected, titles, cases } = preservation;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "存护",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Preservation Light Cone ${fixture.id} (${fixture.build})`, () => {
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

test("uses the recorded Defense and the original 32 percent cap", () => {
  const fixture = cases.find(entry => entry.id === "21039" && entry.build === "normal")!;
  const { equipped, context } = inputs(fixture);
  const stats = equipped.stats.filter(stat => stat.key !== "def");
  for (const [value, bonus] of [["2300", "27.6"], ["2700", "32"], ["4200", "32"]] as const) {
    const damage = readStarRailPersonalDamage({ ...equipped, stats: [...stats, { key: "def", base: "1200", value }] }, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("织造命运之线：") && buff.includes("伤害" + bonus + "%"))).toBe(true);
  }
  const fuXuan = mixedFixtures.find(entry => entry.avatar.id === "1208")!;
  const sets = new Map(Object.entries(fuXuan.metadata.setNames));
  const lackingDefense = {
    ...fuXuan.avatar,
    cone: { ...fuXuan.avatar.cone, id: "21039" },
    stats: fuXuan.avatar.stats.filter(stat => stat.key !== "def"),
  };
  expect(readStarRailPersonalDamage(lackingDefense, {
    ...fuXuan.metadata, cone: context.cone, setForId: id => sets.get(id),
  }).reason).toBe("缺少光锥所需的防御力");
});

test("keeps the old Defense-dependent reminder while leaving the original values intact", () => {
  const fixture = cases.find(entry => entry.id === "21030")!;
  const { equipped, context } = inputs(fixture);
  const withReminder = readStarRailPersonalDamage(equipped, context).damage!;
  const empty = readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "20010" } }, { ...context, cone: {} }).damage!;
  const value = (row: typeof empty.rows[number]) => [row.title, row.average, row.critical];
  expect(withReminder.buffs.some(buff => buff.includes("旧试算提示"))).toBe(true);
  expect(withReminder.rows.map(value)).toEqual(empty.rows.map(value));
  expect(withReminder.rows[withReminder.selected]?.metric).toBe("shield");
});

test("distinguishes the original empty Preservation rules from other equipment", () => {
  for (const [id, name] of [["20010", "戍御"], ["20017", "开疆"], ["21009", "朗道的选择"], ["21023", "我们是地火"]] as const) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const damage = readStarRailPersonalDamage(equipped, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith(name + "："))).toBe(false);
    expect(readStarRailPersonalDamage(equipped, { ...context, conePath: "虚无" }).damage).toBeUndefined();
    expect(readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "29999", name } }, context).damage).toBeUndefined();
  }
});
