import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { CompiledAction, CompiledActor, CompiledEncounter } from "../compile/types.ts";
import { parse } from "../rules/expression.ts";
import { getRulebook, type RuleValues } from "../rules/rulebook.ts";
import { ExpressionCompiler } from "../rules/schema.ts";
import { BattleRunner, reportBattle } from "./index.ts";

const expressions = new Map();
function skill(id: string, kind: string, target: string, damageType: string,
  raw: RuleValues, scaling: readonly Record<string, number>[], scalingBlast: readonly Record<string, number>[] = []): CompiledAction {
  const labels: Record<string, string> = { basic: "轻击", skill: "扩散战技", ultimate: "爆发终结技" };
  return { id, name: labels[kind] ?? "技能", kind, target, damageType, levelKey: kind,
    expressions, raw, scaling, scalingBlast };
}
function unit(id: string, name: string, party: CompiledActor["party"],
  partial: Partial<CompiledActor["stats"]>, actions: readonly CompiledAction[]): CompiledActor {
  return {
    id, name, party, kind: party === "enemy" ? "monster" : "character", path: "", element: "imaginary",
    level: 80, rank: 0, groups: [], elationNumber: 0, systemFlags: [], raw: {}, expressions,
    stats: { hp: 120_000, atk: 1000, def_: 1000, spd: 100, max_energy: 0, max_toughness: 0, ...partial },
    damageBonus: {}, resistance: {}, weakness: ["imaginary"], toughnessBars: [],
    skillLevels: { basic: 1, skill: 1, ultimate: 1 }, actions, hooks: [], resources: {}, bindingParams: {},
    modifiers: [], summons: [], techniques: [],
  };
}
const a = unit("a", "甲", "player", { spd: 125.5, max_energy: 75, atk: 2100 }, [
  skill("a1", "basic", "single", "imaginary", { skill_point_gain: 1 }, [{ atk: .5 }]),
  skill("a2", "skill", "blast", "imaginary", { skill_point_cost: 1, instances: 2 }, [{ atk: 1.25 }], [{ atk: .51 }]),
  skill("a3", "ultimate", "aoe", "imaginary", { energy_cost: 75 }, [{ atk: 2.1 }]),
]);
const b = unit("b", "乙", "player", { spd: 103, max_energy: 80, atk: 1650 }, [
  skill("b1", "basic", "single", "imaginary", { skill_point_gain: 1 }, [{ atk: .93 }]),
  skill("b2", "skill", "bounce", "imaginary", { skill_point_cost: 1, instances: 3 }, [{ atk: .4 }]),
]);
const support = unit("b", "乙", "player", { max_energy: 80, spd: 103 }, [
  skill("b1", "basic", "single", "imaginary", { skill_point_gain: 1 }, [{ atk: .93 }]),
  skill("b2", "skill", "ally_single", "", { skill_point_cost: 1 }, []),
]);
const small = unit("small", "守卫", "enemy", { hp: 3900, max_toughness: 10, spd: 98 }, [
  skill("m1", "basic", "single", "fire", { energy_grant: 8 }, [{ atk: .2 }]),
]);
const large = unit("large", "精英假人", "enemy", { spd: 91 }, small.actions);
const far = unit("far", "后排目标", "enemy", { hp: 230_000, spd: 88 }, small.actions);
const breaker = unit("a", "甲", "player", { max_energy: 90, atk: 1600 }, [
  skill("a1", "basic", "single", "imaginary", { skill_point_gain: 1 }, [{ atk: 1 }]),
  skill("a2", "skill", "single", "imaginary", { skill_point_cost: 1, toughness_dmg: 20, instances: 3 }, [{ atk: 1 }]),
]);
const summon: CompiledActor = { ...unit("pet", "小伴侣", "player", { spd: 132, max_energy: 0 }, [
  skill("p1", "basic", "single", "imaginary", {}, [{ atk: .51 }]),
]), kind: "summon", ownerId: a.id,
  summon: { control: "auto", capabilities: {}, inheritance: "none", maxHpRatio: 0 },
};

interface Fixture {
  readonly team: readonly CompiledActor[];
  readonly enemies: readonly CompiledActor[];
  readonly waves: readonly (readonly CompiledActor[])[];
  readonly limit: number;
  readonly summons?: readonly CompiledActor[];
  readonly operations?: readonly (readonly ["spawn" | "dismiss" | "step", string])[];
}
const fixtures: readonly Fixture[] = [
  { team: [a, b], enemies: [large, far], waves: [], limit: 450 },
  { team: [breaker], enemies: [small], waves: [[large]], limit: 530 },
  { team: [breaker], enemies: [small], waves: [], limit: 100 },
  { team: [a, support], enemies: [large], waves: [], limit: 200 },
  { team: [a], enemies: [large], waves: [], limit: 350, summons: [summon],
    operations: [["spawn", summon.id], ["step", ""], ["dismiss", summon.id],
      ["step", ""], ["step", ""], ["spawn", summon.id], ["step", ""], ["step", ""], ["step", ""]] },
];

async function fixtureRunner(fixture: Fixture) {
  const rules = await getRulebook();
  const encounter: CompiledEncounter = {
    team: fixture.team, systemActors: [], summons: new Map(fixture.summons?.map(actor => [actor.id, actor])),
    hooks: [], caveats: [], rules,
    expr: new ExpressionCompiler(),
    actionsByActor: new Map([...fixture.team, ...fixture.enemies, ...fixture.waves.flat(), ...fixture.summons ?? []]
      .map(actor => [actor.id, actor.actions])),
    stage: { id: "stage", mode: "forgotten_hall", terminationMode: "fixed_av",
      maxActionValue: fixture.limit, cycle: rules.modes.forgotten_hall!, enemies: fixture.enemies },
    policy: { mode: "rule_based", ultimateTiming: "after_action", enemyRules: new Map(), actionRules: [
      { action: "skill", priority: 50, condition: parse("skill_points > 0"), raw: {}, expressions },
      { action: "basic", priority: 0, raw: {}, expressions },
    ] },
  };
  return new BattleRunner(encounter, undefined, { laterWaves: fixture.waves });
}
async function result(fixture: Fixture) {
  const runner = await fixtureRunner(fixture);
  const steps = [];
  runner.setup();
  for (const [op, id] of fixture.operations ?? []) {
    if (op === "spawn") {
      const template = runner.actorTemplate(id);
      runner.spawn(template, { after: template.ownerId, reason: "summon" });
    } else if (op === "dismiss") {
      runner.dismiss(id);
    } else {
      const step = runner.step();
      if (step) steps.push([step.actorId, step.kind, step.clock, step.skipped]);
    }
  }
  for (let step; (step = runner.step());) steps.push([step.actorId, step.kind, step.clock, step.skipped]);
  const state = runner.state;
  const targets = runner.events.filter(event => event.kind === "on_action").map(({ payload }) =>
    [payload.actor, payload.action_id, payload.target]);
  return {
    steps, targets, end: [runner.terminationReason], clock: state.clock, turns: state.turnCount, sp: state.skillPoints,
    units: Object.fromEntries([...state.actors].map(([id, unit]) =>
      [id, [unit.currentHp, unit.currentEnergy, unit.toughness, unit.alive, unit.broken, unit.barIndex]])),
    report: reportBattle(runner, 4),
  };
}

test("fixed Python battle steps, health, energy, SP and public timeline match the native runner", async () => {
  const oracle = fileURLToPath(new URL("./python-oracle.py", import.meta.url));
  const python = Bun.spawnSync(["python3", "-I", "-S", "-B", oracle], {
    stdin: Buffer.from(JSON.stringify(fixtures)), stderr: "pipe",
  });
  if (python.exitCode !== 0) throw new Error(python.stderr.toString());
  const expected = JSON.parse(python.stdout.toString()) as Awaited<ReturnType<typeof result>>[];
  for (const [index, fixture] of fixtures.entries()) expect(await result(fixture)).toEqual(expected[index]!);
});
