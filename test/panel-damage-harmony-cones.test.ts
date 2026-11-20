import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import harmony from "./fixtures/panel-damage-harmony-cones.json";
import supportFixtures from "./fixtures/panel-damage-harmony.json";

const { avatar, character, setNames, selected, titles, cases } = harmony;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "同谐",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Harmony Light Cone ${fixture.id} (${fixture.build})`, () => {
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

test("honors catalog-only and explicitly empty rules without inventing party buffs", () => {
  for (const [id, name] of [
    ["20012", "轮契"], ["21011", "与行星相会"], ["21018", "舞！舞！舞！"],
    ["21025", "过往未来"], ["21056", "追逐风的时候"], ["23034", "回到大地的飞行"],
  ] as const) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const damage = readStarRailPersonalDamage(equipped, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith(name + "："))).toBe(false);
    expect(readStarRailPersonalDamage(equipped, { ...context, conePath: "虚无" }).damage).toBeUndefined();
    expect(readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "29999", name } }, context).damage).toBeUndefined();
  }
});

test("keeps Sunday's ally support percentages when a cone has no original personal effect", () => {
  const fixture = supportFixtures.find(entry => entry.avatar.id === "1313")!;
  const { avatar, metadata } = fixture;
  const { setNames, ...original } = metadata;
  const sets = new Map(Object.entries(setNames));
  const context = { ...original, cone: {}, setForId: (id: string) => sets.get(id) };
  const kinds = ["21025", "23034"];
  const results = kinds.map(id => readStarRailPersonalDamage({ ...avatar, cone: { ...avatar.cone, id } }, context).damage!);
  expect(results[0]!.rows.map(row => row.percentage)).toEqual(["30.0%", "45.0%", "20.0%", "42.9%"]);
  expect(results[0]!.rows.every(row => row.metric === "support")).toBe(true);
  expect(results[1]).toEqual(results[0]);
});
