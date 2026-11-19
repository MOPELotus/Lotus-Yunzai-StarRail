import { describe, expect, test } from "bun:test";
import { calculateStarRailPersonalDamage } from "../panel-damage.ts";
import { parsePanelCommand, type PanelAvatar } from "../panel-model.ts";

const metadata = {
  character: { id: 1102, elem: "量子", talent: {
    a: { tables: { 1: { name: "技能伤害", values: [1] } } },
    e: { tables: { 1: { name: "技能伤害", values: [2.2] } } },
    q: { tables: { 1: { name: "技能伤害", values: [4.25] } } },
    t: { tables: { 1: { name: "伤害提高", values: [0.8] } } },
  } },
  cone: { id: "23001", skill: { tables: { 1: [18], 2: [6], 3: [12] } } },
  conePath: "巡猎", relicMetadata: {},
  setForId: (id: string) => id.startsWith("6108") ? "繁星璀璨的天才" : id.startsWith("6309") ? "繁星竞技场" : "折断的龙骨",
};

const avatar: PanelAvatar = {
  id: "1102", name: "希儿", element: "量子", level: 80, rank: 2, path: "巡猎", face: "", splash: "", stars: [],
  skills: ["a", "e", "q", "t"].map(key => ({ key, level: 1, icon: "" })),
  traces: [{ id: "1102102", name: "", active: true, icon: "" }],
  cone: { id: "23001", name: "于夜色中", rank: 1, level: 80, image: "", description: "" },
  relics: ["61081", "61082", "61083", "61084", "63095", "63096"].map((id, i) => ({ id, slot: i + 1, name: "", image: "", subs: [] })),
  stats: [
    { key: "atk", base: "1222.4519999999998", value: "2152.249344045539" },
    { key: "speed", base: "115", value: "153.832" },
    { key: "cpct", value: "63.4%" }, { key: "cdmg", value: "50%" }, { key: "quantum", value: "48.8803015%" },
  ],
};

describe("Star Rail personal damage", () => {
  test("keeps the old scenario suffix distinct from the selected profile", () => {
    expect(parsePanelCommand("*希儿伤害")).toEqual({ type: "damage", name: "希儿", profileId: 1, scenario: 3 });
    expect(parsePanelCommand("#星铁希尔伤害2 3")).toEqual({ type: "damage", name: "希尔", profileId: 3, scenario: 2 });
    expect(parsePanelCommand("*希儿武器1")).toEqual({ type: "damage", name: "希儿", profileId: 1, scenario: 1 });
    expect(parsePanelCommand("*希儿武器8")).toBeUndefined();
    expect(parsePanelCommand("#希儿伤害")).toBeUndefined();
  });

  test("matches the old calculator's skill, crit, and substat replacements", () => {
    // Original DmgAttr + DmgCalc, Seele, 繁星璀璨的天才, 繁星竞技场 and 于夜色中.
    const damage = calculateStarRailPersonalDamage(avatar, metadata, 1)!;
    expect(damage.selected).toBe(0);
    const expected = [[5518.200978313834, 5120.890507875237], [12140.042152290436, 11265.959117325523],
      [27886.5093730746, 24576.3053415464]];
    damage.rows.forEach((row, index) => {
      expect(row.critical).toBeCloseTo(expected[index]![0]!, 7);
      expect(row.average).toBeCloseTo(expected[index]![1]!, 7);
    });
    expect(damage.swaps[0]?.values[0]).toBeUndefined();
    expect(damage.swaps[0]?.values[1]?.average).toBeCloseTo(5053.373023517272, 7);
    expect(damage.swaps[3]?.values[2]?.average).toBeCloseTo(5307.785353169554, 7);
    expect(damage.buffs).toContain("繁星竞技场 · 普攻与战技伤害 +20%");
  });

  test("withholds numbers for unsupported equipment or missing data", () => {
    expect(calculateStarRailPersonalDamage({ ...avatar, id: "2102" }, metadata, 3)).toBeUndefined();
    expect(calculateStarRailPersonalDamage(avatar, metadata, 4)).toBeUndefined();
    expect(calculateStarRailPersonalDamage({ ...avatar, skills: avatar.skills.slice(0, 3) }, metadata, 3)).toBeUndefined();
    expect(calculateStarRailPersonalDamage({ ...avatar, traces: [] }, metadata, 3)).toBeUndefined();
    expect(calculateStarRailPersonalDamage({ ...avatar, stats: avatar.stats.slice(0, 4) }, metadata, 3)).toBeUndefined();
    expect(calculateStarRailPersonalDamage({ ...avatar, cone: { ...avatar.cone!, id: "23013" } }, metadata, 3)).toBeUndefined();
    expect(calculateStarRailPersonalDamage({
      ...avatar, relics: avatar.relics.map((part, i) => i > 3 ? { ...part, id: String(i) } : part),
    }, metadata, 3)).toBeUndefined();
  });
});
