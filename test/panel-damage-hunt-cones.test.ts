import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import iceFixtures from "./fixtures/panel-damage-ice-state.json";
import physicalFixtures from "./fixtures/panel-damage-physical-imaginary.json";
import hunt from "./fixtures/panel-damage-hunt-cones.json";

const { avatar, character, setNames, selected, titles, cases } = hunt;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "巡猎",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Hunt Light Cone ${fixture.id} (${fixture.build})`, () => {
    const { equipped, context } = inputs(fixture);
    const result = readStarRailPersonalDamage(equipped, context).damage!;
    expect(result.selected).toBe(selected);
    expect(result.rows.map(row => row.title)).toEqual(titles);
    fixture.rows.forEach(([critical, average], index) => {
      expect(result.rows[index]?.critical).toBeCloseTo(critical!, 7);
      expect(result.rows[index]?.average).toBeCloseTo(average!, 7);
    });
    const [critical, average] = fixture.swap;
    expect(result.swaps[0]?.values[1]?.critical).toBeCloseTo(critical!, 7);
    expect(result.swaps[0]?.values[1]?.average).toBeCloseTo(average!, 7);
  });
}

test("uses speed for In the Night's stacks and caps the old bonus at six", () => {
  const { avatar, metadata } = iceFixtures.find(entry => entry.avatar.id === "1209")!;
  const night = cases.find(entry => entry.id === "23001")!;
  const { setNames, ...context } = metadata;
  const sets = new Map(Object.entries(setNames));
  const cone = { ...avatar.cone, id: night.id, rank: 5 };
  const traces = avatar.traces.map(trace => trace.id === "1209103" ? { ...trace, active: false } : trace);
  for (const [speed, layers] of [[100, 0], [109.999, 0], [110, 1], [159.999, 5], [160, 6], [199, 6]]) {
    const stats = avatar.stats.map(stat => stat.key === "speed" ? { ...stat, value: String(speed) } : stat);
    const damage = readStarRailPersonalDamage({ ...avatar, cone, stats, traces },
      { ...context, cone: { skill: { tables: night.tables } }, setForId: id => sets.get(id) }).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("于夜色中：" + layers + "层"))).toBe(true);
  }
});

test("requires recorded Break Effect for Sailing Towards a Second Life and includes speed at 150 percent", () => {
  const fixture = physicalFixtures.find(entry => entry.avatar.id === "1315")!;
  const { avatar, metadata } = fixture;
  const { setNames, ...context } = metadata;
  const sets = new Map(Object.entries(setNames));
  for (const [value, active] of [["149.999%", false], ["150%", true], ["160%", true]] as const) {
    const stats = avatar.stats.map(stat => stat.key === "stance" ? { ...stat, value } : stat);
    const damage = readStarRailPersonalDamage({ ...avatar, stats }, { ...context, setForId: id => sets.get(id) }).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("驶向第二次生命：击破特攻达到150%"))).toBe(active);
  }
  const sailing = cases.find(entry => entry.id === "23027")!;
  const input = inputs(sailing);
  const stats = input.equipped.stats.filter(stat => stat.key !== "stance");
  expect(readStarRailPersonalDamage({ ...input.equipped, stats }, input.context).reason).toBe("缺少光锥所需的击破特攻");
});

test("retains the static-only Hunt rules and rejects unknown or cross-path equipment", () => {
  for (const [id, name] of [["23012", "如泥酣眠"], ["21031", "重返幽冥"]] as const) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const damage = readStarRailPersonalDamage(equipped, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith(name + "："))).toBe(false);
    expect(readStarRailPersonalDamage(equipped, { ...context, conePath: "虚无" }).damage).toBeUndefined();
    expect(readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "29999", name } }, context).damage).toBeUndefined();
  }
});
