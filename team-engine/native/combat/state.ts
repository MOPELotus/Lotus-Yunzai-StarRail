// Initial and cycle state semantics follow HSR_Nous engine.py at 00185dd (MIT).
import { evaluate } from "../rules/expression.ts";
import type { CycleRule, Rulebook } from "../rules/rulebook.ts";
import type { ScheduledActor } from "./scheduler.ts";

export interface CombatActor extends ScheduledActor {
  readonly level: number;
  readonly kind: string;
  readonly stats: Readonly<Record<string, number>> & ScheduledActor["stats"];
  readonly damageBonus?: Readonly<Record<string, number>>;
  readonly resistance?: Readonly<Record<string, number>>;
  readonly weakness?: readonly string[];
  readonly toughnessBars?: readonly number[];
}

export interface CombatModifier {
  readonly id: string;
  readonly type: string;
  readonly sourceId?: string;
  readonly controlKind?: string;
  readonly fixedHpBars?: number;
  readonly overrideEffects?: Readonly<Record<string, number>>;
  duration: number;
  stacks: number;
}

export function isEnemy(actor: CombatActor): boolean {
  return actor.kind === "enemy" || actor.kind === "monster";
}

export function numericConstant(rulebook: Rulebook, key: string): number {
  const value = rulebook.constants[key];
  if (typeof value !== "number") throw new Error("Unknown numeric combat constant " + key);
  return value;
}

export class ActorState {
  currentHp: number;
  currentEnergy = 0;
  alive = true;
  banished = false;
  broken = false;
  toughness: number;
  barIndex = 0;
  readonly addedBars: number[] = [];
  readonly modifiers = new Map<string, CombatModifier>();
  readonly resources = new Map<string, number>();

  constructor(readonly actor: CombatActor) {
    this.currentHp = actor.stats.hp ?? 0;
    this.toughness = isEnemy(actor) ? actor.stats.max_toughness ?? 0 : 0;
  }

  get barsExhausted(): boolean {
    return this.barIndex > (this.actor.toughnessBars?.length ?? 0) + this.addedBars.length;
  }
}

export type CycleTransition =
  | { readonly kind: "end"; readonly index: number }
  | { readonly kind: "start"; readonly index: number; readonly budget: number };

export class BattleState {
  readonly actors = new Map<string, ActorState>();
  readonly damageByActor = new Map<string, number>();
  readonly onceLatches = new Set<string>();
  clock = 0;
  turnCount = 0;
  cycleIndex = 1;
  cycleEndClock: number;
  skillPoints: number;
  spMaxOverride = 0;
  punchline = 0;
  totalDamage = 0;
  moonCocoonUsed = false;
  truncated = false;

  constructor(readonly rulebook: Rulebook, actors: readonly CombatActor[],
    readonly cycle?: CycleRule, initialSp?: number) {
    if (cycle && (!(cycle.first_cycle_av > 0) || !(cycle.subsequent_cycle_av > 0))) {
      throw new RangeError("Cycle action budgets must be positive");
    }
    this.cycleEndClock = cycle?.first_cycle_av ?? 0;
    this.skillPoints = initialSp ?? numericConstant(rulebook, "initial_sp");
    for (const actor of actors) this.spawn(actor);
  }

  spawn(actor: CombatActor): ActorState {
    if (this.actors.has(actor.id)) throw new Error("Duplicate battle actor " + actor.id);
    const state = new ActorState(actor);
    this.actors.set(actor.id, state);
    this.damageByActor.set(actor.id, 0);
    return state;
  }

  advanceClock(time: number, emit?: (transition: CycleTransition) => void): void {
    if (!Number.isFinite(time)) throw new RangeError("Invalid combat clock");
    this.clock = time;
    const cycle = this.cycle;
    if (!cycle) return;
    while (time >= this.cycleEndClock) {
      emit?.({ kind: "end", index: this.cycleIndex });
      this.cycleIndex += 1;
      this.cycleEndClock += cycle.subsequent_cycle_av;
      emit?.({ kind: "start", index: this.cycleIndex, budget: cycle.subsequent_cycle_av });
    }
  }

  resetCycleForWave(): void {
    if (this.cycle?.reset_on_wave) this.cycleEndClock = this.clock + this.cycle.first_cycle_av;
  }

  initialEnergyGrants(actors: Iterable<ActorState>,
    ratio = numericConstant(this.rulebook, "initial_energy_ratio")): { actor: ActorState; amount: number }[] {
    const grants = [];
    for (const actor of actors) {
      const amount = (actor.actor.stats.max_energy ?? 0) * ratio;
      if (amount > 0) grants.push({ actor, amount });
    }
    return grants;
  }

  get maxSkillPoints(): number {
    return this.spMaxOverride > 0 ? this.spMaxOverride : numericConstant(this.rulebook, "sp_max_default");
  }

  recordDamage(sourceId: string, amount: number): void {
    const current = this.damageByActor.get(sourceId);
    if (current === undefined) throw new Error("Unknown damage source " + sourceId);
    this.damageByActor.set(sourceId, current + amount);
    this.totalDamage += amount;
  }
}

export interface Settlement {
  readonly value: number;
  readonly node: Readonly<Record<string, unknown>>;
}

export function gainEnergy(rulebook: Rulebook, target: ActorState, amount: number,
  energyRegen = target.actor.stats.energy_regen ?? 1): Settlement {
  const formula = rulebook.formulas.gain_energy;
  if (!formula) throw new Error("Missing gain_energy formula");
  const old = target.currentEnergy;
  const value = evaluate<number>(formula, { context: { amount, energy_regen: energyRegen }, trace: false }).value;
  target.currentEnergy = Math.min(target.actor.stats.max_energy ?? 0, old + value);
  return { value, node: { formula: "gain_energy", amount, regenMulti: energyRegen, actualAmount: target.currentEnergy - old } };
}

export function consumeEnergy(target: ActorState, amount: number): Settlement {
  const actualAmount = Math.min(amount, target.currentEnergy);
  target.currentEnergy -= actualAmount;
  return { value: actualAmount, node: { formula: "consume_energy", amount, actualAmount } };
}

export function applyToughnessDamage(target: ActorState, amount: number, element: string, canReduce = true): Settlement {
  if (!canReduce || target.barsExhausted) return { value: 0, node: { formula: "toughness", actualAmount: 0 } };
  const old = target.toughness;
  target.toughness = Math.max(0, old - amount);
  const actualAmount = old - target.toughness;
  return { value: actualAmount, node: { formula: "toughness", element, actualAmount } };
}
