import { expect, test } from "bun:test";
import { readStarRailPersonalDamage } from "../panel-damage.ts";
import elation from "./fixtures/panel-damage-elation-cones.json";
import pearlFixtures from "./fixtures/panel-damage-elation.json";

const { avatar, character, setNames, selected, titles, cases } = elation;
const sets = new Map(Object.entries(setNames));

function inputs(fixture: typeof cases[number]) {
  const cone = { id: fixture.id, name: "", image: "", description: "", rank: 5, level: 80, promote: 6 };
  const stats = Object.entries(fixture.stats).map(([key, [base, value]]) => ({ key, base: base!, value: value! }));
  return {
    equipped: { ...avatar, cone, stats },
    context: {
      character,
      cone: { skill: { tables: fixture.tables } },
      conePath: "欢愉",
      relicMetadata: {},
      setForId: (id: string) => sets.get(id),
    },
  };
}

for (const fixture of cases) {
  test(`matches the fixed original Elation Light Cone ${fixture.id} (${fixture.build})`, () => {
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

test("uses only the recorded ally context for Until We Meet Again", () => {
  const fixture = cases.find(entry => entry.id === "22009")!;
  const { equipped, context } = inputs(fixture);
  const onsite = readStarRailPersonalDamage(equipped, context).damage!;
  const nativeBuffs = (buff: string) => buff.startsWith("在世界尽头相会吧！：");
  expect(onsite.buffs.filter(nativeBuffs)).toHaveLength(2);

  const pearl = pearlFixtures.find(entry => entry.avatar.id === "1503")!;
  const sets = new Map(Object.entries(pearl.metadata.setNames));
  const own = readStarRailPersonalDamage({
    ...pearl.avatar,
    cone: { ...pearl.avatar.cone, id: "22009", rank: 5 },
  }, { ...pearl.metadata, cone: context.cone, setForId: id => sets.get(id) }).damage!;
  expect(own.buffs.filter(nativeBuffs)).toHaveLength(1);
  expect(own.buffs.filter(nativeBuffs)[0]).toContain("队伍中的欢愉角色");
});

test("requires the recorded energy cap for Encounter in the Next Flower Season", () => {
  const fixture = cases.find(entry => entry.id === "23058")!;
  const { equipped, context } = inputs(fixture);
  for (const sp of [undefined, 0, Number.NaN]) {
    expect(readStarRailPersonalDamage(equipped, { ...context, character: { ...context.character, sp } }).reason)
      .toBe("缺少光锥所需的角色能量上限");
  }
  for (const [sp, bonus] of [[8, 12.6], [120, 16], [480, 26.8], [500, 26.8]]) {
    const damage = readStarRailPersonalDamage(equipped, { ...context, character: { ...context.character, sp } }).damage!;
    expect(damage.buffs.some(buff => buff.startsWith("邂逅于下一个花季：能量恢复效率提高" + bonus + "%"))).toBe(true);
  }
});

test("uses base attributes for the fixed catalog entries without original solver effects", () => {
  for (const [id, name] of [["20023", "嗤笑"], ["20024", "残泪"]] as const) {
    const fixture = cases.find(entry => entry.id === id)!;
    const { equipped, context } = inputs(fixture);
    const damage = readStarRailPersonalDamage(equipped, context).damage!;
    expect(damage.buffs.some(buff => buff.startsWith(name + "："))).toBe(false);
    expect(readStarRailPersonalDamage(equipped, { ...context, conePath: "虚无" }).damage).toBeUndefined();
    expect(readStarRailPersonalDamage({ ...equipped, cone: { ...equipped.cone, id: "29999", name } }, context).damage).toBeUndefined();
  }
});
