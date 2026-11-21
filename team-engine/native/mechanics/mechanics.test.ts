import { expect, test } from "bun:test";
import type { TeamOwnedPanel } from "../../../team-owned-panel.ts";
import { BattleRunner } from "../runner/runner.ts";
import { compileWorkerBuild, type WorkerBuildRequest } from "../worker-build.ts";
import { nativeMechanics } from "./index.ts";

// Recorded from the vendored HSR Nous engine in expected mode, three cycles against five sandbags.
const teams = [
  [["1220", "1112", "1303", "8005"], [244097.96313966266, 33406.69562959929, 2002.53005568, 10350.250561111186]],
  [["1005", "1307", "1218", "1217"], [413701.1099161273, 157520.65940974464, 200810.37794604336, 0]],
  [["1310", "1225", "1303", "1222"], [30475.764302029478, 25401.437236988048, 2389.3824528, 53115.8196114]],
  [["1501", "1504", "1506", "1502"], [737237.4176339031, 155427.8478013315, 580192.0359150956, 965517.5838644574]],
] as const;
async function run(request: WorkerBuildRequest) {
  const { encounter, panelCalibration } = await compileWorkerBuild(request);
  const runner = new BattleRunner(encounter, nativeMechanics({ panelCalibration }));
  runner.run();
  return runner;
}

test("settles four different team mechanics against the original runner's per-character totals", async () => {
  for (const [ids, values] of teams) {
    const runner = await run({ roles: ids.map(id => ({ id })), cycle: 3, enemies: 5 });
    for (const [index, id] of ids.entries()) {
      const companions = [...runner.encounter.summons.values()].filter(actor => actor.ownerId === id);
      const total = (runner.state.damageByActor.get(id) ?? 0) +
        companions.reduce((sum, actor) => sum + (runner.state.damageByActor.get(actor.id) ?? 0), 0);
      expect(total).toBeCloseTo(values[index]!, 6);
    }
  }
});

test("keeps original shield, delayed DoT, named selector, summon and shared-resource paths", async () => {
  const cases = [
    ["1405", 67248.87832550905], ["8004", 7834.816306699199],
    ["1409", 6931.533454235214], ["1413", 73888.82728140496],
    ["8009", 151059.6307238525], ["8010", 106476.46274882842],
  ] as const;
  for (const [id, damage] of cases) {
    const runner = await run({ roles: [{ id }], cycle: 3, enemies: 3 });
    const total = [...runner.state.damageByActor].filter(([owner]) => !owner.startsWith("enemy_"))
      .reduce((sum, [, value]) => sum + value, 0);
    expect(total).toBeCloseTo(damage, 6);
    if (id === "8004") expect(runner.events.some(event => event.kind === "shield_absorbed" &&
      event.payload.shield_id === "TB_FIRE_TALENT_SHIELD" && Number(event.payload.amount) > 0)).toBe(true);
  }
});

test("uses the real settlement panel for owned white stats and local passives", async () => {
  const panel: TeamOwnedPanel = {
    level: 80, rank: 3, cone: { id: "23031", rank: 1, level: 80 }, warnings: [],
    base: { hp: 1900, atk: 1440, def: 500, spd: 112 },
    stats: { hp: 3600, atk: 2700, def: 970, spd: 143, critRate: 0.65, critDmg: 1.6,
      energyRegen: 0.12, breakEffect: 0.25, outgoingHeal: 0, effectHitRate: 0.32, effectRes: 0.08, dmgBonus_Wind: 0.38 },
    conePanelEffects: { critRate: 0.15 },
    skills: { basic: { level: 7, effective: true }, ult: { level: 12, effective: true } },
    relics: [
      { slot: 1, set: "120", main: { key: "hp", value: 705.6 }, subs: { critRate: 0.081, atkPct: 0.07776 } },
      { slot: 2, set: "120", main: { key: "atk", value: 352.8 }, subs: { critDmg: 0.112 } },
      { slot: 3, set: "120", main: { key: "critRate", value: 0.324 }, subs: { spd: 4.6 } },
      { slot: 4, set: "120", main: { key: "spd", value: 25.032 }, subs: { critDmg: 0.05832 } },
      { slot: 5, set: "315", main: { key: "dmgBonus_Wind", value: 0.3888 }, subs: { atk: 19.051 } },
      { slot: 6, set: "315", main: { key: "atkPct", value: 0.432 }, subs: { critRate: 0.02916 } },
    ],
  };
  const roles = [{ id: "1220", panel }, { id: "1112" }, { id: "1303" }, { id: "8005" }];
  const runner = await run({ roles, cycle: 3, enemies: 5 });
  expect(runner.state.damageByActor.get("1220")).toBeCloseTo(628537.7862323, 6);
  const owned = runner.state.actors.get("1220")!;
  expect(owned.actor.stats.atk).toBe(1440);
  expect(owned.modifiers.has("LOTUS_PANEL_RESIDUAL")).toBe(true);
});

test("uses the triggering summon action's element for an allied follow-up", async () => {
  const roles = ["8002", "1222", "1502", "1409"].map(id => ({ id }));
  const runner = await run({ roles, cycle: 4, enemies: 3 });
  for (const [id, action, element] of [["1222_fuyuan", "122204", "fire"], ["1409_ika", "1140901", "wind"]]) {
    const triggering = runner.events.findIndex(event => event.kind === "on_action" &&
      event.payload.actor === id && event.payload.action_id === action);
    expect(triggering).toBeGreaterThan(-1);
    const nextAction = runner.events.findIndex((event, index) => index > triggering && event.kind === "on_action");
    expect(runner.events.slice(triggering, nextAction < 0 ? undefined : nextAction).some(event =>
      event.kind === "after_being_hit" && event.payload.action_id === "hook_大吉大利" &&
      event.payload.damage_type === element && Number(event.payload.amount) > 0)).toBe(true);
  }
});

test("snapshots the buff caster's panel before applying a modifier to the whole team", async () => {
  const roles = ["8005", "1101", "1305", "8003"].map(id => ({ id }));
  const runner = await run({ roles, cycle: 6, enemies: 1 });
  const firstBuff = runner.events.find(event => event.kind === "after_apply_modifier" &&
    event.payload.modifier_id === "BRONYA_ULT_BUFF");
  expect(firstBuff).toBeDefined();
  const action = runner.events.find(event => event.kind === "after_being_hit" &&
    event.time === firstBuff?.time && event.payload.action_id === "130501");
  expect(Number(action?.payload.amount)).toBeCloseTo(3323.274704904837, 6);
  expect(runner.state.damageByActor.get("1305")).toBeCloseTo(83659.73105424874, 6);
});
