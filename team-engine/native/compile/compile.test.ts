import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import type { TeamOwnedPanel } from "../../../team-owned-panel.ts";
import { compileWorkerBuild, panelResidual } from "../worker-build.ts";
import { libraryUrl } from "./library.ts";

test("the pinned worker's four representative teams compile the same actors, enemy actions and hook counts", async () => {
  const cases = [
    { ids: ["1220", "1112", "1303", "8005"], hooks: 49, summons: ["1112_numby"] },
    { ids: ["1005", "1307", "1218", "1217"], hooks: 41, summons: [] },
    { ids: ["1310", "1225", "1303", "1222"], hooks: 49, summons: ["1222_fuyuan"] },
    { ids: ["1501", "1504", "1506", "1502"], hooks: 61, summons: [], system: ["aha_instant"] },
  ];
  for (const { ids, hooks, summons, system = [] } of cases) {
    const { encounter, notices } = await compileWorkerBuild({ roles: ids.map(id => ({ id })), cycle: 3, enemies: 5 });
    expect(notices).toEqual([]);
    expect(encounter.team.map(actor => actor.id)).toEqual(ids);
    expect(encounter.stage.maxActionValue).toBe(350);
    expect(encounter.stage.cycle.reset_on_wave).toBe(true);
    expect(encounter.stage.enemies).toHaveLength(5);
    for (const enemy of encounter.stage.enemies) {
      expect(enemy.stats).toMatchObject({ hp: 1e9, atk: 200, def_: 1000, spd: 100, max_toughness: 240 });
      expect(enemy.weakness).toEqual(["physical"]);
      expect(enemy.actions[0]).toMatchObject({ id: "sandbag_basic", target: "single", scaling: [{ atk: 1 }] });
    }
    expect([...encounter.summons.keys()]).toEqual(summons);
    expect(encounter.systemActors.map(actor => actor.id)).toEqual(system);
    expect(encounter.hooks).toHaveLength(hooks);
    for (const actor of encounter.team) {
      expect(actor.modifiers[0]?.statEffects.dmg_crit).toBeUndefined();
    }
    if (ids.includes("8005")) expect(encounter.team[3]?.modifiers[0]?.statEffects.crit_dmg).toBeCloseTo(0.648);
    for (const actor of encounter.systemActors) expect(encounter.hooks[0]?.ownerId).toBe(actor.id);
  }
});

const owned: TeamOwnedPanel = {
  level: 80, rank: 3, base: { hp: 1900, atk: 1440, def: 500, spd: 112 },
  stats: { hp: 3600, atk: 2700, def: 970, spd: 143, critRate: 0.65, critDmg: 1.6,
    energyRegen: 0.12, breakEffect: 0.25, outgoingHeal: 0, effectHitRate: 0.32, effectRes: 0.08, dmgBonus_Wind: 0.38 },
  conePanelEffects: { critRate: 0.15 },
  skills: { basic: { level: 7, effective: true }, ult: { level: 12, effective: true } },
  cone: { id: "23031", level: 80, rank: 1 },
  relics: [
    { slot: 1, set: "120", main: { key: "hp", value: 705.6 }, subs: { critRate: 0.081, atkPct: 0.07776 } },
    { slot: 2, set: "120", main: { key: "atk", value: 352.8 }, subs: { critDmg: 0.112 } },
    { slot: 3, set: "120", main: { key: "critRate", value: 0.324 }, subs: { spd: 4.6 } },
    { slot: 4, set: "120", main: { key: "spd", value: 25.032 }, subs: { critDmg: 0.05832 } },
    { slot: 5, set: "315", main: { key: "dmgBonus_Wind", value: 0.3888 }, subs: { atk: 19.051 } },
    { slot: 6, set: "315", main: { key: "atkPct", value: 0.432 }, subs: { critRate: 0.02916 } },
  ],
  warnings: [],
};
test("compiles the actual equipment and calibrates the saved panel against a fixed original effective-stats snapshot", async () => {
  const result = await compileWorkerBuild({ roles: [{ id: "1220", panel: owned }], cycle: 3, enemies: 5 });
  const actor = result.encounter.team[0]!;
  expect(actor.stats).toMatchObject({ hp: 1900, atk: 1440, def_: 500, spd: 112 });
  expect(actor.skillLevels).toMatchObject({ basic: 7, ultimate: 12, skill: 10, talent: 10 });
  expect(actor.bindingParams).toEqual({ crit_rate_param: 0.15, param_2: 0.27, param_3: 2 });
  expect(actor.modifiers.map(modifier => modifier.id)).toEqual(["RELIC_1220", "RELIC_120_2PC", "RELIC_120_4PC", "TRACE_1220"]);
  expect(actor.modifiers[0]?.statEffects.atk).toBeCloseTo(371.851);
  expect(actor.modifiers[0]?.statEffects.dmg_wind).toBeCloseTo(0.3888);
  expect(actor.hooks.some(hook => hook.source === "relics/120/4pc")).toBe(true);
  expect(actor.hooks.some(hook => hook.source === "light_cones/23031")).toBe(true);
  expect(actor.hooks.some(hook => hook.source === "characters/1220/E2")).toBe(true);
  const stats = { hp: 2605.6, atk: 3121.9054, def_: 562.5, spd: 141.632, crit_rate: 0.66416,
    crit_dmg: 0.67032, energy_regen: 1, break_effect: 0, heal_bonus: 0, effect_hit: 0, effect_res: 0 };
  const residual = panelResidual(actor, { stats, damageBonus: { wind: 0.3888 } }, result.panelCalibration.get(actor.id)!);
  expect(residual.atk).toBeCloseTo(-421.9054);
  expect(residual.crit_rate).toBeCloseTo(-0.16416);
  expect(residual.energy_regen).toBeCloseTo(0.12);
  expect(residual.dmg_wind).toBeCloseTo(-0.0088);

  const unknown = { ...owned, cone: { id: "29999", rank: 1 }, conePanelEffects: undefined };
  const missing = await compileWorkerBuild({ roles: [{ id: "1220", panel: unknown }], cycle: 1, enemies: 1 });
  expect(missing.panelCalibration.has(actor.id)).toBe(false);
  expect(missing.encounter.team[0]?.stats.atk).toBe(1440);
  expect(missing.notices).toHaveLength(2);
  const offPath = { ...owned, base: {}, cone: { id: "23019", rank: 5, base: { hp: 30, atk: 20, def: 10 } } };
  const inactive = await compileWorkerBuild({ roles: [{ id: "1220", panel: offPath }], cycle: 1, enemies: 1 });
  expect(inactive.encounter.team[0]?.stats.atk).toBeCloseTo(621.524);
  expect(inactive.encounter.team[0]?.bindingParams).toEqual({});
});

test("keeps resource-limited hooks, legacy tracks and summons that act outside the turn queue", async () => {
  const roles = [{ id: "1212", version: "legacy" as const }, { id: "1415" }, { id: "1413" }];
  const { encounter } = await compileWorkerBuild({ roles, cycle: 20, enemies: 3 });
  expect(encounter.stage.maxActionValue).toBe(2050);
  expect(encounter.summons.get("1415_dem")?.stats.spd).toBe(0);
  expect(encounter.summons.get("1415_dem")?.summon?.capabilities.av).toBe(false);
  const longNight = encounter.team[2]!;
  const triggerIds = Object.keys(longNight.resources).filter(id => id.startsWith("_tl_"));
  expect(triggerIds).toHaveLength(2);
  for (const id of triggerIds) {
    expect(longNight.hooks.some(hook => hook.event === "on_battle_start" &&
      hook.effects.some(effect => effect.raw.resource_id === id && effect.raw.effect_type === "set_resource"))).toBe(true);
    expect(longNight.hooks.some(hook => hook.condition?.source.includes(id) &&
      hook.effects.some(effect => effect.raw.resource_id === id && effect.raw.amount === -1))).toBe(true);
  }
});

test("compiles every pinned playable template with its defaults and an E6 owned build", async () => {
  const files = await readdir(new URL("characters/", libraryUrl));
  expect(files).toHaveLength(97);
  const panel: TeamOwnedPanel = { level: 80, rank: 6, base: {}, stats: {},
    skills: {}, relics: [], warnings: [], cone: null };
  for (const file of files) {
    const id = file.slice(0, 4);
    const version = file.endsWith("_legacy.yaml") ? "legacy" : "enhanced";
    for (const current of [undefined, panel]) {
      const result = await compileWorkerBuild({ roles: [{ id, version, panel: current }], cycle: 1, enemies: 1 });
      expect(result.encounter.team[0]?.raw.actor_id).toBe(id);
    }
  }
});
