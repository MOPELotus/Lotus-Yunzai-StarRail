import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import cipherFixtures from "./fixtures/panel-damage-crit-special.json";
import nihility from "./fixtures/panel-damage-nihility-cones.json";

const { avatar, character, setNames, selected, titles, cases } = nihility;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "虚无",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Nihility Light Cone ${fixture.id} (${fixture.build})`, () => {
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

test("requires the recorded Effect Hit Rate for It's Showtime and includes the bonus at 80 percent", () => {
  const normal = cases.find(entry => entry.id === "21041" && entry.build === "normal")!;
  const { equipped, context } = inputs(normal);
  const stats = equipped.stats.filter(stat => stat.key !== "effPct");
  expect(readStarRailPersonalDamage({ ...equipped, stats }, context).reason).toBe("缺少光锥所需的效果命中");
  for (const [value, active] of [["79.999%", false], ["80%", true], ["81%", true]] as const) {
    const damage = readStarRailPersonalDamage({ ...equipped, stats: [...stats, { key: "effPct", base: "0", value }] }, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("好戏开演：效果命中达到80%"))).toBe(active);
  }
});

test("includes Cipher's Light Cone defense reduction at 170 speed", () => {
  const fixture = cipherFixtures.find(entry => entry.avatar.id === "1406")!;
  const { avatar, metadata } = fixture;
  const { setNames, ...context } = metadata;
  const sets = new Map(Object.entries(setNames));
  for (const [speed, active] of [[169.999, false], [170, true], [171, true]] as const) {
    const stats = avatar.stats.map(stat => stat.key === "speed" ? { ...stat, value: String(speed) } : stat);
    const damage = readStarRailPersonalDamage({ ...avatar, stats }, { ...context, setForId: id => sets.get(id) }).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("谎言在风中飘扬：若装备者的速度大于等于170"))).toBe(active);
  }
});

test("keeps explicitly empty rules distinct from unknown or cross-path Light Cones", () => {
  for (const [id, name] of [["20018", "匿影"], ["21029", "后会有期"]]) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const damage = readStarRailPersonalDamage(equipped, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith(`${name}：`))).toBe(false);
    expect(readStarRailPersonalDamage(equipped, { ...context, conePath: "智识" }).damage).toBeUndefined();
    expect(readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "29999", name: name! } }, context).damage).toBeUndefined();
  }
});
