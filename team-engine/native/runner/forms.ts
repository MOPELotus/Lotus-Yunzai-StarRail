// Form lifecycle follows HSR_Nous 00185dd (MIT).
import type { ActorState } from "../combat/index.ts";
import { entries, map, number, string, strings } from "../compile/library.ts";
import type { CompiledAction, Mechanic } from "../compile/types.ts";
import type { BattleRunner } from "./runner.ts";

function replacements(raw: unknown): readonly string[] {
  if (typeof raw === "string") return [raw];
  return strings(raw);
}

export class FormBook {
  readonly #active = new Map<string, Mechanic>();
  readonly #banished = new Map<string, string[]>();

  constructor(readonly runner: BattleRunner) {}

  current(actor: ActorState): Mechanic | undefined { return this.#active.get(actor.actor.id); }

  #config(actor: ActorState): Mechanic | undefined {
    return this.runner.actorTemplate(actor.actor.id).stateConfig;
  }

  filter(actor: ActorState, candidates: readonly CompiledAction[]): readonly CompiledAction[] {
    const active = this.current(actor);
    const config = this.#config(actor);
    if (!config) return candidates;
    const replace = map(config.raw.replaces_actions);
    if (!active) {
      const enhanced = new Set(Object.values(replace).flatMap(replacements));
      if (config.raw.final_action_id) enhanced.add(string(config.raw.final_action_id));
      return candidates.filter(action => !enhanced.has(action.id));
    }
    const locked = new Set(strings(active.raw.locked_actions));
    return candidates.filter(action => !locked.has(action.kind)
      && (!Object.hasOwn(replace, action.kind) || replacements(replace[action.kind]).includes(action.id)));
  }

  sameEntry(actor: ActorState, action: CompiledAction): boolean {
    const active = this.current(actor);
    return active !== undefined && string(active.raw.entry_action_id) === action.id;
  }

  enterFromUltimate(actor: ActorState, action: CompiledAction): "entered" | undefined {
    const config = this.#config(actor);
    if (!config || string(config.raw.entry_action_id) !== action.id) return;
    if (!this.enter(actor)) return;
    this.runner.applyActionEffects(actor, action);
    if (config.raw.entry_end_turn !== false) this.runner.endCurrentTurn(actor);
    const condition = entries(config.raw.exit_conditions)[0];
    if (condition) {
      const first = config.raw.countdown_initial_ratio === "uniform"
        ? this.runner.mode === "roll" && this.runner.rng ? this.runner.rng() : .5
        : number(config.raw.countdown_initial_ratio, 1);
      this.runner.scheduler.grantCountdown(actor.actor.id, number(condition.value, 1),
        actor.actor.stats.spd * number(config.raw.countdown_spd_ratio, 1), first);
    }
    return "entered";
  }

  enter(actor: ActorState): boolean {
    const config = this.#config(actor);
    if (!config || this.current(actor)) return false;
    const runner = this.runner;
    const id = actor.actor.id;
    const state = string(config.raw.state);
    const marker = "STATE_" + state;
    if (runner.mechanics.applyModifier) {
      runner.mechanics.applyModifier(actor, { raw: {
        modifier_id: marker, name: state, modifier_type: "buff", dispellable: false, singleton_group: "actor_state",
        stat_effects: config.raw.stat_effects, grants_immune: config.raw.grants_immune,
      }, expressions: config.expressions }, actor);
    } else {
      actor.modifiers.set(marker, { id: marker, type: "buff", duration: 0, stacks: 1 });
    }
    this.#active.set(id, config);
    actor.resources.set("_state_actions_" + state, 0);
    if (config.raw.banish_allies_on_enter) {
      const banished: string[] = [];
      for (const ally of runner.state.actors.values()) {
        const allyId = ally.actor.id;
        if (ally === actor || runner.actorTemplate(allyId).party !== "player" || !ally.alive || ally.banished) continue;
        ally.banished = true;
        runner.scheduler.freeze(allyId);
        banished.push(allyId);
        runner.emit("actor_exit", { actor: allyId, reason: "banish" });
      }
      this.#banished.set(id, banished);
    }
    runner.emit("on_state_change", { actor: id, to_state: state, from_state: null });
    return true;
  }

  exit(actor: ActorState, reason: string): void {
    const config = this.current(actor);
    if (!config) return;
    const runner = this.runner;
    const id = actor.actor.id;
    for (const marker of strings(config.raw.exit_remove_modifiers)) {
      for (const enemy of runner.actors("enemy")) runner.removeModifier(enemy, marker, "state_exit");
    }
    for (const allyId of this.#banished.get(id) ?? []) {
      const ally = runner.state.actors.get(allyId);
      if (ally?.banished) {
        ally.banished = false;
        runner.scheduler.unfreeze(allyId);
        runner.emit("actor_enter", { actor: allyId, reason: "unbanish", actor_type: ally.actor.kind });
      }
    }
    this.#banished.delete(id);
    const state = string(config.raw.state);
    runner.removeModifier(actor, "STATE_" + state, reason);
    this.#active.delete(id);
    runner.emit("on_state_change", { actor: id, from_state: state, to_state: null });
  }

  lastAction(actor: ActorState): CompiledAction | undefined {
    const config = this.current(actor);
    const final = config?.raw.final_action_id;
    if (!config || final === undefined) return;
    const state = string(config.raw.state);
    const remaining = entries(config.raw.exit_conditions).some(condition =>
      condition.trigger === "on_action_count"
      && (actor.resources.get("_state_actions_" + state) ?? 0) + 1 >= number(condition.value, 1));
    return remaining ? this.runner.actionsOf(actor).find(action => action.id === String(final)) : undefined;
  }

  countAction(actor: ActorState, prior: unknown): void {
    const active = this.current(actor);
    if (!prior || !active) return;
    const id = "_state_actions_" + string(active.raw.state);
    const count = (actor.resources.get(id) ?? 0) + 1;
    actor.resources.set(id, count);
    const done = entries(active.raw.exit_conditions).some(condition =>
      condition.trigger === "on_action_count" && count >= number(condition.value, 1)
      || condition.trigger === "on_resource_depleted" && (actor.resources.get(string(condition.value)) ?? 0) <= 0);
    if (done) this.exit(actor, "exit_condition");
  }
}
