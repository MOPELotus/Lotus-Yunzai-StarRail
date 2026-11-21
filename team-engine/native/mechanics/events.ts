// HSR Nous bus and hook dispatch, adapted from the MIT-licensed pinned engine.
import type { CompiledHook } from "../compile/types.ts";
import type { RuleValues } from "../rules/rulebook.ts";

export const waterfallEvents = new Set([
  "before_take_damage", "toughness_recovered", "on_gain_energy", "before_consume", "before_drain",
]);
export const eventFields = {
  actor_enter: "actor actor_type reason wave_index",
  actor_exit: "actor reason",
  after_apply_modifier: "modifier_id modifier_type source stat target",
  after_being_hit: "absorbed action_id action_type actor_type amount damage_type hit_targets is_critical primary_target seg_index source target",
  after_consume: "actor amount current resource_id",
  after_remove_modifier: "modifier_id reason source target",
  battle_end: "reason",
  before_actor_exit: "actor reason",
  before_battle_start: "encounter",
  before_consume: "actor amount reason resource_id",
  before_drain: "action_id amount floor reason source target",
  before_take_damage: "action_id action_type amount damage_type is_critical source target",
  on_action: "action_id action_type actor actor_type insert sp_consumed tag target target_type",
  on_action_end: "action_id action_type actor actor_type insert",
  aha_instant_end: "actors consumed extra",
  aha_instant_start: "actors consumed extra",
  on_battle_start: "encounter",
  on_banger_expire: "actor value current",
  on_become_target: "action_id action_type insert source target",
  on_break: "bar_index element source target",
  on_cycle_end: "cycle_index",
  on_cycle_start: "budget cycle_index",
  on_dot_retrigger: "modifier_id target",
  on_extra_turn: "actor",
  on_gain_energy: "action_id actor amount err_exempt reason source",
  on_hp_decrease: "action_type amount damage_type is_critical reason source target",
  on_hp_increase: "action_id amount excess reason source target",
  on_hp_lock: "action_id source target",
  on_immune: "modifier_id target",
  on_kill: "action_id source target",
  on_resist: "chance modifier_id target",
  on_resource_gain: "actor amount current overflow resource_id",
  on_revive: "hp percent source target",
  on_skill_point_change: "after before consumer reason turn",
  on_state_change: "actor from_state to_state",
  on_super_break: "action_id amount element source target",
  on_toughness_damage: "amount bar_index source target",
  on_turn_end: "actor kind",
  on_turn_start: "actor kind",
  on_ultimate: "action source target",
  on_wave_start: "wave_index",
  shield_absorbed: "amount remaining shield_id source target",
  shield_broken: "shield_id source target",
  toughness_recovered: "amount target",
} as const;
export type BattleEvent = keyof typeof eventFields;
export type EventPayload = RuleValues;
export interface EventUpdate {
  readonly amount?: number;
  readonly cancel?: boolean;
}
export type TriggerOrder = Readonly<Record<string, readonly string[]>>;

export function validateEvent(event: string, payload: EventPayload, waterfall: boolean): void {
  if (waterfallEvents.has(event) !== waterfall) {
    throw new TypeError(event + (waterfall ? " 是只读战斗事件" : " 须逐个结算事件处理者"));
  }
  if (!Object.hasOwn(eventFields, event)) return;
  const known = new Set(eventFields[event as BattleEvent].split(" "));
  if (waterfall) known.add("cancel");
  for (const key of Object.keys(payload)) if (!known.has(key)) throw new TypeError(event + " 不支持字段 " + key);
}

interface HookGroup {
  readonly ordinary: readonly CompiledHook[];
  readonly incoming: readonly CompiledHook[];
  readonly flush: readonly CompiledHook[];
}
interface HookHost<Actor extends { readonly alive: boolean }> {
  owner(id: string): Actor | undefined;
  condition(hook: CompiledHook, actor: Actor, payload: EventPayload): boolean;
  filter(hook: CompiledHook, actor: Actor, payload: EventPayload, targetId: string): boolean;
  effect(hook: CompiledHook, actor: Actor, payload: EventPayload, waterfall: boolean): EventUpdate | undefined;
  warn(message: string): void;
}

/** Emits condition snapshots followed by effects. Waterfalls instead let each hook see prior updates. */
export class HookDispatch<Actor extends { readonly alive: boolean }> {
  readonly #subscriptions = new Map<string, HookGroup>();
  readonly #pending = new Map<CompiledHook, EventPayload[]>();
  #depth = 0;
  #warned = false;

  constructor(hooks: readonly CompiledHook[], readonly host: HookHost<Actor>, order: TriggerOrder = {}) {
    const priority = (hook: CompiledHook) => {
      const ids = order[hook.event] ?? [];
      const index = ids.indexOf(hook.ownerId);
      return index < 0 ? ids.length : index;
    };
    const sorted = [...hooks].sort((a, b) => priority(a) - priority(b));
    const events = new Set(sorted.flatMap(hook => [hook.event, ...hook.flushTriggers]));
    for (const event of events) {
      this.#subscriptions.set(event, {
        ordinary: sorted.filter(hook => hook.event === event && !hook.accumulated),
        incoming: sorted.filter(hook => hook.event === event && hook.accumulated),
        flush: sorted.filter(hook => hook.accumulated && hook.flushTriggers.includes(event)),
      });
    }
  }

  emit(event: string, payload: EventPayload): void {
    validateEvent(event, payload, false);
    const group = this.#subscriptions.get(event);
    if (!group) return;
    this.#dispatch(event, () => {
      const passed = group.ordinary.flatMap(hook => {
        const actor = this.host.owner(hook.ownerId);
        return actor && this.host.condition(hook, actor, payload) ? [{ hook, actor }] : [];
      });
      for (const { hook, actor } of passed) {
        if (actor.alive || event === "on_kill") this.host.effect(hook, actor, payload, false);
      }
      for (const hook of group.incoming) {
        const actor = this.host.owner(hook.ownerId);
        if (!actor || !this.host.condition(hook, actor, payload)) continue;
        const queue = this.#pending.get(hook) ?? [];
        queue.push({ ...payload });
        this.#pending.set(hook, queue);
      }
      for (const hook of group.flush) this.#flush(hook);
    });
  }

  waterfall(event: string, payload: EventPayload): EventPayload {
    validateEvent(event, payload, true);
    const group = this.#subscriptions.get(event);
    const current = { ...payload };
    if (!group) return current;
    return this.#dispatch(event, () => {
      for (const hook of group.ordinary) {
        const actor = this.host.owner(hook.ownerId);
        if (!actor?.alive || !this.host.condition(hook, actor, current)) continue;
        const update = this.host.effect(hook, actor, current, true);
        if (!update) continue;
        for (const key of Object.keys(update)) {
          if (key !== "amount" && key !== "cancel") throw new TypeError(event + " 不能修改字段 " + key);
        }
        Object.assign(current, update);
        if (current.cancel) break;
      }
      return current;
    });
  }

  #flush(hook: CompiledHook): void {
    const queue = this.#pending.get(hook);
    const actor = this.host.owner(hook.ownerId);
    if (!queue?.length || !actor?.alive) return;
    this.#pending.delete(hook);
    const targets = [...new Set(queue.flatMap(row => row.target == null ? [] : [String(row.target)]))];
    const payload = { ...queue.at(-1), targets };
    const filtered = hook.targetFilter ? targets.filter(id => this.host.filter(hook, actor, payload, id)) : targets;
    if (filtered.length) this.host.effect(hook, actor, { ...payload, targets: filtered }, false);
  }

  #dispatch<Result>(event: string, run: () => Result): Result {
    if (this.#depth >= 128) throw new Error(event + " 的事件重入超过 128 层");
    ++this.#depth;
    try {
      if (this.#depth > 20 && !this.#warned) {
        this.#warned = true;
        this.host.warn(event + " 的事件重入超过 20 层");
      }
      return run();
    } finally {
      if (--this.#depth === 0) this.#warned = false;
    }
  }
}
