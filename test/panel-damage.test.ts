import { describe, expect, test } from "bun:test";
import { calculateStarRailPersonalDamage, readStarRailPersonalDamage } from "../panel-damage.ts";
import { parsePanelCommand, starRailLegacySkillLevel, type PanelAvatar } from "../panel-model.ts";
import advancedFixtures from "./fixtures/panel-damage.json";
import additionalFixtures from "./fixtures/panel-damage-additional.json";
import physicalImaginaryFixtures from "./fixtures/panel-damage-physical-imaginary.json";
import breakFixtures from "./fixtures/panel-damage-break-support.json";
import healthFixtures from "./fixtures/panel-damage-hp-support.json";
import nihilityFixtures from "./fixtures/panel-damage-nihility.json";
import iceFixtures from "./fixtures/panel-damage-ice-state.json";
import eruditionFixtures from "./fixtures/panel-damage-erudition.json";
import remembranceFixtures from "./fixtures/panel-damage-remembrance.json";
import abundanceFixtures from "./fixtures/panel-damage-abundance.json";
import destructionFixtures from "./fixtures/panel-damage-destruction.json";
import huntFixtures from "./fixtures/panel-damage-hunt.json";
import dotFixtures from "./fixtures/panel-damage-dot.json";
import harmonyFixtures from "./fixtures/panel-damage-harmony.json";
import trailblazerFixtures from "./fixtures/panel-damage-harmony-break.json";
import preservationFixtures from "./fixtures/panel-damage-preservation.json";
import destructionStateFixtures from "./fixtures/panel-damage-destruction-state.json";
import critSpecialFixtures from "./fixtures/panel-damage-crit-special.json";
import hpSpecialFixtures from "./fixtures/panel-damage-hp-special.json";
import breakMultiFixtures from "./fixtures/panel-damage-break-multi.json";
import elationFixtures from "./fixtures/panel-damage-elation.json";
import finalElationFixtures from "./fixtures/panel-damage-elation-final.json";
import cerydraFixtures from "./fixtures/panel-damage-cerydra.json";
import feixiaoConeFixtures from "./fixtures/panel-damage-feixiao-cones.json";
import hertaConeFixtures from "./fixtures/panel-damage-herta-cones.json";

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
    expect(parsePanelCommand("*希儿伤害")).toEqual({ type: "damage", name: "希儿", profileId: 1, scenario: undefined });
    expect(parsePanelCommand("#星铁希尔伤害2 3")).toEqual({ type: "damage", name: "希尔", profileId: 3, scenario: 2 });
    expect(parsePanelCommand("*希儿武器1")).toEqual({ type: "damage", name: "希儿", profileId: 1, scenario: 1 });
    expect(parsePanelCommand("*希儿武器8")).toMatchObject({ scenario: 8 });
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
    expect(damage.buffs.some(buff => buff.startsWith("繁星竞技场2："))).toBe(true);
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

describe("common engine with original character data", () => {
  for (const { avatar, metadata, expected } of [
    ...advancedFixtures, ...additionalFixtures, ...physicalImaginaryFixtures, ...breakFixtures,
    ...feixiaoConeFixtures, ...hertaConeFixtures,
    ...healthFixtures, ...nihilityFixtures, ...iceFixtures, ...eruditionFixtures, ...remembranceFixtures, ...abundanceFixtures, ...destructionFixtures, ...huntFixtures, ...dotFixtures, ...harmonyFixtures, ...trailblazerFixtures, ...preservationFixtures, ...destructionStateFixtures, ...critSpecialFixtures, ...hpSpecialFixtures, ...breakMultiFixtures, ...elationFixtures, ...finalElationFixtures, ...cerydraFixtures,
  ]) {
    test(`matches ${avatar.name}'s default, all rows and an original attribute swap`, () => {
      const { setNames, ...inputs } = metadata;
      const sets = new Map(Object.entries(setNames));
      const damage = calculateStarRailPersonalDamage(avatar, { ...inputs, setForId: id => sets.get(id) })!;
      expect(damage.selected).toBe(expected.selected);
      expect(damage.rows).toHaveLength(expected.rows.length);
      for (const [index, row] of expected.rows.entries()) {
        const actual = damage.rows[index]!;
        expect(actual.title).toBe(row.title);
        if (!("avg" in row) || typeof row.avg !== "number") {
          expect(actual.note).toBe("note" in row ? row.note : undefined);
          expect(actual.average).toBeUndefined();
          continue;
        }
        expect(actual.average).toBeCloseTo(row.avg, 7);
        if ("display" in row) expect(actual).toMatchObject({ metric: "support", display: row.display });
        if ("percentage" in row) expect(actual).toMatchObject({ metric: "support", percentage: row.percentage });
        if (!("dmg" in row) || typeof row.dmg !== "number") expect(actual.critical).toBeUndefined();
        else expect(actual.critical).toBeCloseTo(row.dmg, 7);
      }
      expect(damage.swaps[0]?.values[1]?.average).toBeCloseTo(expected.swap.avg, 7);
      if ("display" in expected.swap && typeof expected.swap.display === "string") expect(damage.swaps[0]?.values[1]?.display).toBe(expected.swap.display);
      if ("percentage" in expected.swap) expect(damage.swaps[0]?.values[1]?.percentage).toBe(expected.swap.percentage);
      if (!("dmg" in expected.swap) || typeof expected.swap.dmg !== "number") expect(damage.swaps[0]?.values[1]?.critical).toBeUndefined();
      else expect(damage.swaps[0]?.values[1]?.critical).toBeCloseTo(expected.swap.dmg, 7);
    });
  }

  test("filters locked scenarios and explains incomplete managed panels", () => {
    const herta = advancedFixtures.find(fixture => fixture.avatar.id === "1401")!;
    const { setNames, ...inputs } = herta.metadata;
    const sets = new Map(Object.entries(setNames));
    const metadata = { ...inputs, setForId: (id: string) => sets.get(id) };
    expect(readStarRailPersonalDamage(herta.avatar, metadata, 4).scenarioCount).toBe(3);
    expect(calculateStarRailPersonalDamage({ ...herta.avatar, rank: 6 }, metadata, 5)?.rows).toHaveLength(5);
    expect(readStarRailPersonalDamage({ ...herta.avatar, traces: [] }, metadata).reason).toBe("缺少对应的行迹状态");
  });

  test("retains the original summon slot and distinguishes damage without crit from healing", () => {
    const [jing, swan, lingsha] = ["1204", "1307", "1222"].map(id => {
      const { avatar, metadata } = additionalFixtures.find(fixture => fixture.avatar.id === id)!;
      const { setNames, ...inputs } = metadata;
      const sets = new Map(Object.entries(setNames));
      return { avatar, metadata: { ...inputs, setForId: (itemId: string) => sets.get(itemId) } };
    });
    const summon = calculateStarRailPersonalDamage({ ...jing!.avatar, rank: 6 }, jing!.metadata, 4)!;
    expect(summon.rows).toHaveLength(4);
    expect(summon.rows[summon.selected]?.title).toBe("10层神君单体伤害");
    const dot = calculateStarRailPersonalDamage(swan!.avatar, swan!.metadata)!;
    expect(dot.rows[dot.selected]).toMatchObject({ metric: "damage", critical: undefined });
    expect(readStarRailPersonalDamage({ ...swan!.avatar, stats: swan!.avatar.stats.filter(stat => stat.key !== "effPct") }, swan!.metadata).reason)
      .toBe("缺少计算所需的战斗属性");
    const heal = calculateStarRailPersonalDamage(lingsha!.avatar, lingsha!.metadata, 3)!;
    expect(heal.rows[heal.selected]).toMatchObject({ title: "召唤物治疗量", metric: "heal", critical: undefined });
  });

  test("does not estimate Boothill's break without a saved break effect attribute", () => {
    const { avatar, metadata } = physicalImaginaryFixtures.find(fixture => fixture.avatar.id === "1315")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared)!;
    expect(damage.rows[damage.selected]).toMatchObject({ metric: "damage", critical: undefined });
    const incomplete = { ...avatar, stats: avatar.stats.filter(stat => stat.key !== "stance") };
    expect(readStarRailPersonalDamage(incomplete, prepared).reason).toBe("缺少计算所需的战斗属性");
  });

  test("uses the original filtered default row for six-eidolon Fugue", () => {
    const { avatar, metadata } = breakFixtures.find(fixture => fixture.avatar.id === "1225")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const six = { ...avatar, rank: 6 };
    const damage = calculateStarRailPersonalDamage(six, prepared)!;
    expect(damage.rows).toHaveLength(4);
    expect(damage.selected).toBe(3);
    expect(damage.rows[damage.selected]?.title).toBe("持【狐祈】破韧后终结技对三伤害");
    expect(damage.buffs.some(buff => buff.startsWith("忘归人战技："))).toBe(true);
    expect(readStarRailPersonalDamage(six, prepared, 5).scenarioCount).toBe(4);
  });

  test("keeps enhanced Blade's dynamic labels and requires saved HP for HP scaling", () => {
    const { avatar, metadata } = healthFixtures.find(fixture => fixture.avatar.id === "2205")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared)!;
    expect(damage.rows[2]?.title).toBe("天赋追加攻击(群伤, 3目标)");
    expect(damage.rows[damage.selected]?.title).toBe("终结技(扩散, 90%已损失生命)");
    expect(readStarRailPersonalDamage({ ...avatar, rank: 0 }, prepared, 5).scenarioCount).toBe(4);
    const incomplete = { ...avatar, stats: avatar.stats.map(stat => stat.key === "hp" ? { ...stat, base: undefined } : stat) };
    expect(readStarRailPersonalDamage(incomplete, prepared).reason).toBe("缺少角色基础与综合属性");
  });

  test("requires the saved attributes for effect-hit conversion and for entanglement", () => {
    for (const [id, key, reason] of [
      ["1004", "effPct", "缺少套装所需的效果命中属性"],
      ["1006", "stance", "缺少计算所需的战斗属性"],
    ]) {
      const { avatar, metadata } = nihilityFixtures.find(fixture => fixture.avatar.id === id)!;
      const { setNames, ...inputs } = metadata;
      const sets = new Map(Object.entries(setNames));
      const prepared = { ...inputs, setForId: (itemId: string) => sets.get(itemId) };
      expect(readStarRailPersonalDamage({ ...avatar, stats: avatar.stats.filter(stat => stat.key !== key) }, prepared).reason).toBe(reason);
      if (id === "1006") {
        const damage = calculateStarRailPersonalDamage(avatar, prepared, 4)!;
        expect(damage.rows[damage.selected]).toMatchObject({ title: "击破纠缠伤害(10韧性怪)", metric: "damage", critical: undefined });
        expect(damage.rows[damage.selected]?.average).toBeCloseTo(48708.26289070868, 7);
      }
    }
  });

  test("keeps enhanced Jingliu's personal default and Misha's eidolon-gated sequence", () => {
    const profiles = new Map(iceFixtures.map(({ avatar, metadata }) => {
      const { setNames, ...inputs } = metadata;
      const sets = new Map(Object.entries(setNames));
      return [avatar.id, { avatar, prepared: { ...inputs, setForId: (id: string) => sets.get(id) } }] as const;
    }));
    const jingliu = profiles.get("2212")!;
    const result = calculateStarRailPersonalDamage(jingliu.avatar, jingliu.prepared)!;
    expect(result.rows[result.selected]?.title).toBe("普攻伤害");
    expect(result.rows[4]?.title).toBe("转魄·终结技(5层月色, 扩散)");
    const misha = profiles.get("1312")!;
    expect(readStarRailPersonalDamage({ ...misha.avatar, rank: 0 }, misha.prepared, 5).scenarioCount).toBe(4);
    const enhanced = calculateStarRailPersonalDamage(misha.avatar, misha.prepared, 5)!;
    expect(enhanced.rows[enhanced.selected]?.title).toBe("终结技伤害·15段");
  });

  test("requires Argenti's original energy cap for the signature cone", () => {
    const { avatar, metadata } = eruditionFixtures.find(fixture => fixture.avatar.id === "1302")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared)!;
    expect(damage.rows[damage.selected]?.title).toBe("强化终结技总伤害");
    expect(damage.buffs.some(buff => buff.includes("勇气"))).toBe(true);
    expect(readStarRailPersonalDamage(avatar, { ...prepared, character: { ...prepared.character, sp: undefined } }).reason)
      .toBe("缺少光锥所需的角色能量上限");
  });

  test("uses original memosprite eidolon increments and refuses a missing memosprite talent", () => {
    expect(starRailLegacySkillLevel("me", 6, 6, 5)).toBe(7);
    expect(starRailLegacySkillLevel("mt", 10, 6, 3)).toBe(10);
    expect(starRailLegacySkillLevel("e", 10, 6, 5)).toBe(12);
    const { avatar, metadata } = remembranceFixtures.find(fixture => fixture.avatar.id === "1402")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared, 4)!;
    expect(damage.rows[damage.selected]?.title).toBe("Q后忆灵技伤害·主目标");
    expect(damage.rows[damage.selected]?.average).toBeCloseTo(12637.421915703677, 7);
    const incomplete = { ...avatar, skills: avatar.skills.filter(skill => skill.key !== "mt") };
    expect(readStarRailPersonalDamage(incomplete, prepared).reason).toBe("缺少技能等级");
  });

  test("distinguishes Luocha's eidolon shield from healing and damage", () => {
    const { avatar, metadata } = abundanceFixtures.find(fixture => fixture.avatar.id === "1203")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared, 6)!;
    expect(damage.rows[damage.selected]).toMatchObject({ title: "2命护盾量", metric: "shield", critical: undefined });
    expect(damage.rows[1]?.metric).toBe("heal");
    expect(damage.rows[2]?.metric).toBe("damage");
    expect(readStarRailPersonalDamage({ ...avatar, rank: 0 }, prepared, 6).scenarioCount).toBe(5);
  });

  test("requires Xueyi's original break stat for her damage conversion", () => {
    const { avatar, metadata } = destructionFixtures.find(fixture => fixture.avatar.id === "1214")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const incomplete = { ...avatar, stats: avatar.stats.filter(stat => stat.key !== "stance") };
    expect(readStarRailPersonalDamage(incomplete, prepared).reason).toBe("缺少计算所需的战斗属性");
  });

  test("keeps Sushang's sword stance damage as distinct added skill hits", () => {
    const { avatar, metadata } = huntFixtures.find(fixture => fixture.avatar.id === "1206")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared)!;
    const firstSwordHit = damage.rows[2]!.average! - damage.rows[1]!.average!;
    const secondSwordHit = damage.rows[4]!.average! - damage.rows[2]!.average!;
    expect(firstSwordHit).toBeGreaterThan(0);
    expect(secondSwordHit).toBeCloseTo(firstSwordHit, 7);
  });

  test("unlocks Hysilens's ultimate detonation with its original trace", () => {
    const { avatar, metadata } = dotFixtures.find(fixture => fixture.avatar.id === "1410")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared)!;
    expect(damage.rows[3]?.critical).toBeUndefined();
    expect(damage.rows[4]?.average).toBeCloseTo(damage.rows[3]!.average! * 1.5, 7);
    const traces = avatar.traces.map(trace => trace.id.endsWith("102") ? { ...trace, active: false } : trace);
    expect(readStarRailPersonalDamage({ ...avatar, traces }, prepared, 5).scenarioCount).toBe(4);
  });

  test("separates Tingyun's flat attack bonus and percentage support from damage", () => {
    const { avatar, metadata } = harmonyFixtures.find(fixture => fixture.avatar.id === "1202")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const damage = calculateStarRailPersonalDamage(avatar, { ...inputs, setForId: id => sets.get(id) })!;
    expect(damage.rows[0]?.metric).toBe("damage");
    expect(damage.rows[1]?.metric).toBe("support");
    expect(damage.rows[1]?.percentage).toBeUndefined();
    expect(damage.rows[2]?.percentage).toBe("50.0%");
  });

  test("keeps the original Trailblazer default and unlocks the ally ratio at eidolon four", () => {
    const { avatar, metadata } = trailblazerFixtures.find(fixture => fixture.avatar.id === "8005")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared)!;
    expect(damage.rows[damage.selected]?.title).toBe("战技伤害");
    expect(readStarRailPersonalDamage({ ...avatar, rank: 3 }, prepared, 5).scenarioCount).toBe(4);
    const unlocked = calculateStarRailPersonalDamage({ ...avatar, rank: 4 }, prepared, 3)!;
    expect(unlocked.rows[unlocked.selected]).toMatchObject({ title: "4魂提高队友击破特攻", metric: "support" });
    expect(unlocked.rows[unlocked.selected]?.percentage).toMatch(/^\d+[.]\d%$/);
  });

  test("uses the actual speed label for Hanya's original duplicated percentage", () => {
    const { avatar, metadata } = trailblazerFixtures.find(fixture => fixture.avatar.id === "1215")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const damage = calculateStarRailPersonalDamage(avatar, { ...inputs, setForId: id => sets.get(id) }, 4)!;
    expect(damage.rows[damage.selected]?.title).toBe("终结技单体速度加成比例");
    expect(damage.rows[damage.selected]?.percentage).toBe(damage.rows[2]?.percentage);
  });

  test("uses the original strict effect hit threshold for Belobog's extra defense", () => {
    const { avatar, metadata } = preservationFixtures.find(fixture => fixture.avatar.id === "8003")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const stats = avatar.stats.filter(stat => stat.key !== "effPct");
    expect(readStarRailPersonalDamage({ ...avatar, stats }, prepared).reason).toBe("缺少套装所需的效果命中属性");
    const shieldAt = (value: string) => {
      const damage = calculateStarRailPersonalDamage({ ...avatar, stats: [...stats, { key: "effPct", value }] }, prepared)!;
      return damage.rows[damage.selected]!;
    };
    expect(shieldAt("50%").metric).toBe("shield");
    expect(shieldAt("50%").active.some(buff => buff.startsWith("筑城者的贝洛伯格"))).toBe(false);
    expect(shieldAt("51%").average).toBeGreaterThan(shieldAt("50%").average!);
  });

  test("retains the fixed comrade attack and the original dragon spirit shield at eidolon two", () => {
    const { avatar, metadata } = preservationFixtures.find(fixture => fixture.avatar.id === "1414")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const damage = calculateStarRailPersonalDamage(avatar, prepared)!;
    const rankOne = calculateStarRailPersonalDamage({ ...avatar, rank: 1 }, prepared)!;
    expect(damage.rows[damage.selected]?.title).toBe("普攻伤害");
    expect(damage.rows[4]?.metric).toBe("shield");
    expect(damage.rows[4]?.average).toBeCloseTo(rankOne.rows[4]!.average! * 2, 7);
    expect(damage.rows[5]?.title).toContain("同袍攻击:3000");
    expect(readStarRailPersonalDamage(avatar, prepared, 7).scenarioCount).toBe(6);
  });

  test("reads Saber's damage bonus from the fixed talent metadata", () => {
    const { avatar, metadata } = destructionStateFixtures.find(fixture => fixture.avatar.id === "1014")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const damage = calculateStarRailPersonalDamage(avatar, { ...inputs, setForId: id => sets.get(id) })!;
    expect(damage.rows[damage.selected]?.title).toBe("终结技·全体伤害");
    expect(damage.buffs).toContain("Saber天赋：我方任意目标施放终结技时，Saber造成的伤害提高60%");
  });

  test("keeps Mydei's original eidolon-one adjacent target filtering", () => {
    const { avatar, metadata } = destructionStateFixtures.find(fixture => fixture.avatar.id === "1404")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const base = calculateStarRailPersonalDamage({ ...avatar, rank: 0 }, prepared, 5)!;
    const firstEidolon = calculateStarRailPersonalDamage({ ...avatar, rank: 1 }, prepared, 5)!;
    expect(base.rows[base.selected]?.title).toBe("战技【弑神登神】伤害·相邻目标");
    expect(firstEidolon.rows[firstEidolon.selected]?.title).toBe("终结技伤害");
    expect(readStarRailPersonalDamage({ ...avatar, rank: 1 }, prepared, 6).scenarioCount).toBe(5);
  });

  test("applies Cipher's extra signature defense reduction at exactly 170 speed", () => {
    const { avatar, metadata } = critSpecialFixtures.find(fixture => fixture.avatar.id === "1406")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const atSpeed = (value: string) => calculateStarRailPersonalDamage({
      ...avatar, stats: avatar.stats.map(stat => stat.key === "speed" ? { ...stat, value } : stat),
    }, prepared)!;
    expect(atSpeed("169").buffs.some(buff => buff.includes("速度大于等于170"))).toBe(false);
    expect(atSpeed("170").buffs.some(buff => buff.includes("速度大于等于170"))).toBe(true);
    expect(atSpeed("170").rows[0]!.average).toBeGreaterThan(atSpeed("169").rows[0]!.average!);
  });

  test("keeps enhanced Seele's six-eidolon result on the original ordinary damage path", () => {
    const { avatar, metadata } = critSpecialFixtures.find(fixture => fixture.avatar.id === "2102")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    expect(readStarRailPersonalDamage({ ...avatar, rank: 5 }, prepared, 4).scenarioCount).toBe(3);
    const six = calculateStarRailPersonalDamage({ ...avatar, rank: 6 }, prepared, 4)!;
    expect(six.rows[six.selected]?.title).toBe("6命乱蝶附加伤害");
    expect(six.rows[six.selected]?.critical).toBeCloseTo(six.rows[2]!.critical! * 0.3, 7);
  });

  test("uses Hyacine's verified cone name for the original drain contribution", () => {
    const { avatar, metadata, expected } = hpSpecialFixtures.find(fixture => fixture.avatar.id === "1409")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const renamed = { ...avatar, cone: { ...avatar.cone, name: "旧面板显示名" } };
    const damage = calculateStarRailPersonalDamage(renamed, { ...inputs, setForId: id => sets.get(id) }, 8)!;
    expect(damage.rows[1]?.metric).toBe("heal");
    expect(damage.rows[damage.selected]).toMatchObject({ metric: "support", average: expected.rows[7]!.avg });
  });

  test("preserves Cyrene's original additional bounce count at the first eidolon", () => {
    const { avatar, metadata } = hpSpecialFixtures.find(fixture => fixture.avatar.id === "1415")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const title = (rank: number) => {
      const damage = calculateStarRailPersonalDamage({ ...avatar, rank }, prepared)!;
      return damage.rows[damage.selected]?.title;
    };
    expect(title(0)).toContain("3段弹射");
    expect(title(1)).toContain("15段弹射");
  });

  test("defaults to Silver Wolf's available ultimate at the fourth eidolon boundary", () => {
    const { avatar, metadata } = breakMultiFixtures.find(fixture => fixture.avatar.id === "2006")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const atThree = calculateStarRailPersonalDamage({ ...avatar, rank: 3 }, prepared)!;
    const atFour = calculateStarRailPersonalDamage({ ...avatar, rank: 4 }, prepared)!;
    expect(atThree.rows[atThree.selected]?.title).toBe("终结技伤害(3目标)");
    expect(atThree.rows[3]?.title).toContain("击破纠缠");
    expect(atFour.rows[atFour.selected]?.title).toBe("终结技+4命(3目标, 5层Buff)");
    expect(atFour.rows[4]?.critical).toBeUndefined();
  });

  test("keeps Dahlia's original rounded super break rows as damage", () => {
    const { avatar, metadata, expected } = breakMultiFixtures.find(fixture => fixture.avatar.id === "1321")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const result = calculateStarRailPersonalDamage(avatar, { ...inputs, setForId: id => sets.get(id) }, 2)!;
    expect(result.rows[result.selected]).toMatchObject({ metric: "damage", average: expected.rows[1]!.avg });
    expect(result.rows[result.selected]?.critical).toBeUndefined();
    expect(result.rows[result.selected]?.percentage).toBeUndefined();
  });

  test("rebuilds omitted Elation from verified trace, cone and set rules", () => {
    for (const { avatar, metadata } of elationFixtures) {
      const { setNames, ...inputs } = metadata;
      const sets = new Map(Object.entries(setNames));
      const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
      const direct = calculateStarRailPersonalDamage(avatar, prepared)!;
      const stats = avatar.stats.filter(stat => stat.key !== "joy");
      const rebuilt = calculateStarRailPersonalDamage({ ...avatar, stats }, prepared)!;
      expect(rebuilt).toEqual(direct);
      if (avatar.id === "1501") {
        const traces = avatar.traces.filter(trace => trace.id !== "1501201");
        expect(readStarRailPersonalDamage({ ...avatar, stats, traces }, prepared).reason)
          .toBe("缺少计算欢愉度所需的行迹或装备数据");
      }
    }
  });

  test("keeps Pearl's original defense-based healing separate from damage", () => {
    const { avatar, metadata } = elationFixtures.find(fixture => fixture.avatar.id === "1503")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const result = calculateStarRailPersonalDamage(avatar, { ...inputs, setForId: id => sets.get(id) })!;
    expect(result.rows[result.selected]?.title).toBe("强普治疗");
    expect(result.rows.every(row => row.metric === "heal" && row.critical === undefined)).toBe(true);
  });

  test("keeps Aha's original solo default and withholds the unconfigured debt scene", () => {
    const { avatar, metadata } = finalElationFixtures.find(fixture => fixture.avatar.id === "1511")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const rankSix = { ...avatar, rank: 6, traces: [...avatar.traces, { id: "1511601", active: true, name: "", icon: "" }] };
    const result = calculateStarRailPersonalDamage(rankSix, prepared)!;
    expect(result.rows[result.selected]?.title).toBe("100笑点欢愉技·自身结算·单目标");
    expect(readStarRailPersonalDamage(rankSix, prepared, 7).scenarioCount).toBe(6);
  });

  test("retains Robin's one-decimal attack support and percentage units", () => {
    const { avatar, metadata, expected } = finalElationFixtures.find(fixture => fixture.avatar.id === "1512")!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const result = calculateStarRailPersonalDamage(avatar, { ...inputs, setForId: id => sets.get(id) }, 2)!;
    expect(result.rows[result.selected]).toMatchObject({ metric: "support", display: String(expected.rows[1]!.avg) });
    expect(result.rows[2]).toMatchObject({ metric: "support", percentage: "145.0%" });
  });

  test("keeps Cerydra's note and point-valued support as selectable old scenarios", () => {
    const { avatar, metadata, expected } = cerydraFixtures[0]!;
    const { setNames, ...inputs } = metadata;
    const sets = new Map(Object.entries(setNames));
    const prepared = { ...inputs, setForId: (id: string) => sets.get(id) };
    const note = calculateStarRailPersonalDamage(avatar, prepared, 1)!;
    expect(note.rows[note.selected]).toMatchObject({ note: "本计算中,刻律德菈无【军功】buff", metric: "support" });
    expect(note.swaps).toEqual([]);
    const support = calculateStarRailPersonalDamage(avatar, prepared, 5)!;
    expect(support.rows[support.selected]).toMatchObject({ display: expected.rows[4]?.display, metric: "support" });
    expect(support.swaps[0]?.values[1]?.display).toMatch(/^\d+点$/);
  });
});


test("uses the original common scenario numbering for damage and weapon queries", () => {
  for (const type of ["伤害", "武器"]) {
    expect(parsePanelCommand(`#星铁镜流Pro${type}8 2`)).toEqual({
      type: "damage", profileId: 2, name: "镜流Pro", scenario: 8,
    });
    expect(parsePanelCommand(`*遐蝶${type}0008`)).toMatchObject({ scenario: 8 });
    expect(parsePanelCommand(`*遐蝶${type}0`)).toMatchObject({ scenario: 1 });
    expect(parsePanelCommand(`*遐蝶${type} 2`)).toMatchObject({ profileId: 2, scenario: undefined });
    expect(parsePanelCommand(`*希儿${type}99`)).toMatchObject({ scenario: 99 });
  }
  expect(parsePanelCommand("*镜流Pro光锥8")).toBeUndefined();
  expect(parsePanelCommand("*镜流Pro光锥")).toBeUndefined();
});


test("recognizes the original leading profile UID only for local detail and damage queries", () => {
  expect(parsePanelCommand("#星铁100000121希儿详情")).toEqual({ type: "detail", profileId: 1, uid: "100000121", name: "希儿" });
  expect(parsePanelCommand("#星铁 1800000123 希儿伤害2 档案2")).toEqual({
    type: "damage", profileId: 2, uid: "1800000123", name: "希儿", scenario: 2,
  });
  expect(parsePanelCommand("*100000121 1102武器8 3")).toEqual({
    type: "damage", profileId: 3, uid: "100000121", name: "1102", scenario: 8,
  });
  expect(parsePanelCommand("#星铁100000121更新面板")).toBeUndefined();
  expect(parsePanelCommand("#星铁100000121希儿遗器")).toBeUndefined();
  expect(parsePanelCommand("#星铁100000121希儿面板换六魂")).toBeUndefined();
  expect(parsePanelCommand("#星铁100000121希儿详情 档案256")).toBeUndefined();
});
