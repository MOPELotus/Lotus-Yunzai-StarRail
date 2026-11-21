import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { getRulebook } from "../rules/rulebook.ts";
import {
  ActionScheduler, ActorState, BattleState, applyToughnessDamage, basePanel, consumeEnergy, dotSnapshot, gainEnergy,
  heal, hitChance, settleDamage, shieldValue, toughnessDamageAmount,
  type CombatAction, type CombatActor, type DamageInput, type ScheduledTurn,
} from "./index.ts";

const actors: [CombatActor, CombatActor] = [
  {
    id: "ally", level: 80, kind: "character",
    stats: { spd: 100, hp: 3000, atk: 2000, def_: 700, max_energy: 120, energy_regen: 1.25, crit_rate: .6,
      crit_dmg: 1.5, def_pen: .2, res_pen: .05, break_effect: .8, elation: 1.3, effect_hit: .46,
      break_efficiency_boost: .25, weakness_break_efficiency_boost: .5, shield_bonus: .22, heal_bonus: .15 },
    damageBonus: { all: .21, wind: .16, skill_dmg_boost: .08, final_dmg_boost: .3,
      ind_dmg_boost: .08, break_dmg_boost: .52, true_dmg_boost: .11 },
  },
  {
    id: "enemy", level: 95, kind: "monster",
    stats: { spd: 100, hp: 100_000, def_: 1150, max_toughness: 80, vulnerability: .15, effect_res: .31 },
    resistance: { fire: .35 }, weakness: ["wind"], toughnessBars: [30],
    damageBonus: { dmg_reduction: .2, weaken: .01 },
  },
];

const newcomer: CombatActor = { id: "next", level: 90, kind: "monster",
  stats: { spd: 140.2, hp: 130_000, max_toughness: 70 } };
const ticks = [149.99, 150, 349.2, 450];
const scheduler = [
  ["preview"], ["pop"], ["pop"], ["extra", "enemy"], ["extra", "ally", "countdown"],
  ["preview"], ["pop"], ["pop"], ["countdown", "ally", 2, 60, .45], ["eta", "ally"],
  ["speed", "ally", 171.3], ["eta", "ally"], ["shift", "enemy", .39], ["pop"], ["delay", "enemy", .45],
  ["exempt", "enemy"], ["add", newcomer], ["reset", true], ["preview"], ["pop"], ["freeze", "ally"],
  ["extra", "ally"], ["preview"], ["pop"], ["pop"], ["unfreeze", "ally"], ["eta", "ally"],
  ["now", "enemy"], ["shift", "enemy", .15], ["pop"], ["delay", "enemy", .35], ["undo", "enemy"],
  ["undo", "next"], ["preview"], ["pop"], ["pop"], ["pop"], ["pop"], ["pop"], ["preview"],
] as const;

const action: CombatAction = { kind: "skill", damageType: "wind", scaling: [{ atk: .4 }, { atk: 1.3, hp: .12, def: .22 }] };
const modifier = { id: "weathering", element: "wind", ratio: .5, stacks: 3, sourceAtk: 1600,
  snapshot: { ability_multiplier: 850, source_level: 70, def_pen: .3, res_pen: .04,
    dmg_boost_multi: 1.31, ind_dmg_boost_multi: 1.25, final_dmg_multi: 1.1, weaken_multi: .9,
    ehr_multi: .89, be_multi: 1.15 } };
type Case = Omit<DamageInput, "source" | "target" | "rng"> & {
  roll?: number; broken?: boolean; fixedHpBars?: number; defenseOverride?: boolean;
  sourceEffects?: Record<string, number>;
  scoped?: Record<"source" | "target", Record<string, number>>;
};
const settlement: Case[] = [
  { category: "direct", action, skillLevel: 100, mode: "expected" },
  { category: "direct", action, skillLevel: 0, mode: "roll", roll: .59 },
  { category: "direct", action, skillLevel: 2, mode: "roll", roll: .6, defenseOverride: true,
    parameters: { target_broken: true, base_override: 533 } },
  { category: "direct", action: { ...action, damageType: "fire" }, broken: true },
  { category: "direct", action: { ...action, damageType: "thunder" } },
  { category: "direct", action, skillLevel: 2,
    scoped: { source: { dmg_wind: .32, def_pen: .15, crit_dmg: .5, base_dmg_add: 50 },
      target: { vulnerability: .25, def_pen: .9 } } },
  { category: "break", element: "fire" },
  { category: "super_break", element: "wind", parameters: { effective_toughness: 19 } },
  { category: "super_break", element: "wind", sourceEffects: { super_break_modifier: 1.2, super_break_dmg_boost: .35 },
    parameters: { effective_toughness: 19 } },
  { category: "super_break", element: "wind", fixedHpBars: 4, parameters: { effective_toughness: 0 } },
  { category: "elation", action, element: "wind", mode: "roll",
    parameters: { punchline_source: 433, ability_multiplier: 1.3, elation: .91 } },
  { category: "elation", element: "wind", mode: "roll", parameters: { ability_multiplier: 0 } },
  { category: "dot", modifier },
  { category: "dot", modifier, fixedHpBars: 5, broken: true },
  { category: "dot", modifier: { id: "burn", element: "fire", ratio: .6, sourceAtk: 1500 } },
  { category: "bleed", modifier: { ...modifier, id: "BRK_DOT_PHYSICAL", element: "physical", ratio: 1 } },
  { category: "true", parameters: { fixed_value: 628.45 } },
  { category: "true", fixedHpBars: 7, parameters: { fixed_value: 628.45, true_dmg_rate: .73 } },
];

function tuple(turn: ScheduledTurn | undefined) {
  if (!turn) throw new Error("Expected a scheduled turn");
  return [turn.actor.id, turn.kind, turn.time];
}

function schedulerTrace() {
  const queue = new ActionScheduler(actors);
  const output: unknown[] = [];
  for (const op of scheduler) {
    switch (op[0]) {
      case "pop": output.push(tuple(queue.nextActor())); break;
      case "preview": output.push(queue.preview().map(tuple)); break;
      case "countdown": queue.grantCountdown(op[1], op[2], op[3], op[4]); break;
      case "extra": queue.grantExtraTurn(op[1], op[2]); break;
      case "shift": queue.advanceAction(op[1], op[2]); break;
      case "delay": queue.delayAction(op[1], op[2]); break;
      case "now": queue.actNow(op[1]); break;
      case "undo": queue.undoGaugeReset(op[1]); break;
      case "speed": queue.changeSpeed(op[1], op[2]); break;
      case "eta": output.push(queue.formExitEta(op[1]) ?? null); break;
      case "add": queue.addActor(op[1]); break;
      case "reset": queue.resetActionGauge(op[1]); break;
      case "exempt": queue.exemptFromWaveReset(op[1]); break;
      case "freeze": queue.freeze(op[1]); break;
      case "unfreeze": queue.unfreeze(op[1]); break;
    }
  }
  return output;
}

async function stateTrace() {
  const book = await getRulebook();
  const state = new BattleState(book, actors, book.modes.forgotten_hall);
  const a = state.actors.get("ally")!;
  const t = state.actors.get("enemy")!;
  const output: unknown[] = [state.skillPoints, state.cycleEndClock, a.currentHp, a.currentEnergy, t.toughness];
  for (const grant of state.initialEnergyGrants(state.actors.values())) gainEnergy(book, grant.actor, grant.amount, 1);
  output.push(a.currentEnergy);
  for (const time of ticks) {
    state.advanceClock(time);
    output.push([state.cycleIndex, state.cycleEndClock]);
  }
  const spawned = state.spawn(newcomer);
  state.resetCycleForWave();
  output.push([state.cycleIndex, state.cycleEndClock], [spawned.toughness, spawned.currentEnergy]);
  output.push(gainEnergy(book, a, 100), consumeEnergy(a, 250));
  output.push(applyToughnessDamage(t, 11, "wind", false), applyToughnessDamage(t, 11, "wind"));
  t.barIndex = 2;
  output.push(applyToughnessDamage(t, 11, "wind"));
  return output;
}

async function settlementTrace() {
  const book = await getRulebook();
  return settlement.map(c => {
    const source = new ActorState(actors[0]);
    const target = new ActorState(actors[1]);
    const { broken, fixedHpBars, defenseOverride, roll, scoped, sourceEffects, ...input } = c;
    target.broken = broken ?? false;
    if (fixedHpBars || defenseOverride) target.modifiers.set("fixed", {
      id: "fixed", type: "buff", stacks: 1, duration: 0, fixedHpBars,
      overrideEffects: defenseOverride ? { def_: 0 } : {},
    });
    let rolls = 0;
    const result = settleDamage(book, {
      ...input, source, target, rng() { rolls += 1; return roll ?? .1; },
      panelOf(actor) {
        const panel = basePanel(actor);
        if (actor === source && sourceEffects) return { ...panel, stats: { ...panel.stats, ...sourceEffects } };
        return actor === target && defenseOverride ? { ...panel, stats: { ...panel.stats, def_: 0 } } : panel;
      },
      scopedBoost(actor, event, accept) {
        if (event.action_type !== "skill" || event.damage_type !== "wind") return 0;
        const boost = scoped?.[actor === source ? "source" : "target"] ?? {};
        return Object.entries(boost).reduce((sum, [key, value]) => sum + (accept(key) ? value : 0), 0);
      },
    });
    return { ...result, hp: target.currentHp, rolls };
  });
}

async function supportTrace() {
  const book = await getRulebook();
  const source = new ActorState(actors[0]);
  const target = new ActorState(actors[1]);
  const attacker = basePanel(source);
  const recipient = basePanel(target);
  const readTarget = (actor: ActorState) => actor === source ? attacker
    : { ...recipient, stats: { ...recipient.stats, recoverable_hp_reduction: .4, incoming_heal: .1 } };
  target.currentHp = 59_800;
  const healOptions = { flat: 85, attackScaling: .3, hpScaling: .25, panelOf: readTarget };
  const capped = heal(book, source, target, healOptions);
  const hpAfterCap = target.currentHp;
  target.currentHp = 75_000;
  const aboveCap = heal(book, source, target, healOptions);
  return [
    hitChance(book, attacker, recipient, .82, .05),
    toughnessDamageAmount(book, attacker, 15),
    shieldValue(book, attacker, { flat: 19, scaling: { hp: .3, def_: 1.3, atk: .15 } }),
    dotSnapshot(book, source, target, "wind", .55, .82),
    dotSnapshot(book, source, target, "", undefined),
    capped, hpAfterCap, aboveCap, target.currentHp,
  ];
}

test("fixed Python scheduler, initial battle state and damage settlement agree with native combat", async () => {
  const oracle = fileURLToPath(new URL("./python-oracle.py", import.meta.url));
  const python = Bun.spawnSync(["python3", "-I", "-S", "-B", oracle], {
    stdin: Buffer.from(JSON.stringify({ actors, newcomer, ticks, scheduler, settlement })), stderr: "pipe",
  });
  if (python.exitCode !== 0) throw new Error(python.stderr.toString());
  const expected = JSON.parse(python.stdout.toString());
  expect(schedulerTrace()).toEqual(expected.scheduler);
  expect(await stateTrace()).toEqual(expected.state);
  expect(await settlementTrace()).toEqual(expected.settlement);
  expect(await supportTrace()).toEqual(expected.support);
});
