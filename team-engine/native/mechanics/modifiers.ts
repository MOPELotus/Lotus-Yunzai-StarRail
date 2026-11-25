import { createTranslator as createTextTranslator } from "../../../../../packages/i18n/index.ts";
import messageCatalog from "../../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
// HSR Nous modifier lifecycle and panel arithmetic, adapted from the MIT-licensed pinned engine.
import { dotSnapshot, hitChance, isEnemy, shieldValue, type ActorState, type CombatModifier,
  type EffectivePanel, type DamageOverTime, type DamageInput } from "../combat/index.ts";
import { entries, map, number, numeric, string, strings } from "../compile/library.ts";
import type { CompiledActor, Mechanic, Numbers } from "../compile/types.ts";
import type { PreparedExpression } from "../rules/expression.ts";
import type { Rulebook } from "../rules/rulebook.ts";
import type { ModifierAnchor } from "../runner/contracts.ts";
import type { EventPayload } from "./events.ts";

const pctStat: Readonly<Record<string, string>> = { atk_pct: "atk", def_pct: "def_", hp_pct: "hp", spd_pct: "spd" };
const validAnchors = new Set<ModifierAnchor>(["owner_turn_start", "owner_turn_end", "source_turn_start", "source_turn_end", "on_action"]);
const penaltyTypes = new Set(["debuff", "dot", "control"]);

export type PanelOf = NonNullable<DamageInput["panelOf"]>;
export interface EvaluationScope {
  readonly target?: ActorState;
  readonly panelOf?: PanelOf;
  readonly extra?: EventPayload;
  readonly readonlyRoll?: boolean;
}
export interface ModifierHost {
  readonly rulebook: Rulebook;
  readonly mode: "expected" | "roll";
  readonly rng: () => number;
  actors(): Iterable<ActorState>;
  template(id: string): CompiledActor | undefined;
  actor(id: string): ActorState | undefined;
  emit(event: string, payload: EventPayload): void;
  checkDeath(actor: ActorState, sourceId: string, actionId: string): void;
  speedOf(actorId: string): number | undefined;
  changeSpeed(actorId: string, value: number): void;
  evaluate(expression: PreparedExpression, actor: ActorState, payload: EventPayload, scope?: EvaluationScope): unknown;
  evaluateZone(zone: string, context: EventPayload): number;
  runModifierEffect(actor: ActorState, effect: Mechanic, payload: EventPayload): void;
  warn(message: string): void;
}
export interface RuntimeModifier extends CombatModifier {
  readonly model: Mechanic;
  readonly sourceId: string;
  readonly name: string;
  readonly preventAction: boolean;
  readonly toughnessLock: boolean;
  readonly forcedTaunt: boolean;
  readonly lockOn: boolean;
  readonly maxStacks: number;
  readonly dispellable: boolean;
  readonly anchor: ModifierAnchor;
  readonly statEffects: Numbers;
  readonly dot?: DamageOverTime;
}
interface Shield {
  readonly id: string;
  readonly sourceId: string;
  readonly pool: string;
  remaining: number;
}

export function subMechanic(parent: Mechanic, name: string): Mechanic {
  const prefix = name + ".";
  return {
    raw: map(name.split(".").reduce<unknown>((value, key) => Array.isArray(value)
      ? value[Number(key)] : map(value)[key], parent.raw)),
    expressions: new Map([...parent.expressions].filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])),
  };
}
const modRaw = (status: CombatModifier) => "model" in status ? (status as RuntimeModifier).model.raw : {};
export const dataOf = (status: CombatModifier) => modRaw(status);
function isRuntime(status: CombatModifier): status is RuntimeModifier { return "model" in status; }
export const isScoped = (status: RuntimeModifier) => status.model.expressions.has("hit_condition") ||
  Object.keys(map(status.model.raw.hit_stat_exprs)).length > 0;
const isConditional = (status: RuntimeModifier) => status.model.expressions.has("enable_if") ||
  Object.keys(map(status.model.raw.stat_exprs)).length > 0;
const shieldSum = (shields: readonly Shield[]) => shields.reduce((sum, shield) => sum + shield.remaining, 0);

export class ModifierBook {
  readonly #shields = new Map<string, Shield[]>();
  #conditionalSeen = false;

  constructor(readonly host: ModifierHost) {}

  #active(target: ActorState, includeAuras: boolean): RuntimeModifier[] {
    const own = [...target.modifiers.values()].filter(isRuntime);
    if (!includeAuras || this.host.template(target.actor.id)?.systemFlags.includes("no_aura")) return own;
    return own.concat([...this.host.actors()].flatMap(actor => {
      if (actor === target || !actor.alive || actor.banished || isEnemy(actor.actor) !== isEnemy(target.actor)) return [];
      return [...actor.modifiers.values()].filter(isRuntime).filter(status => status.model.raw.effect_scope === "team");
    }));
  }

  panelOf(target: ActorState, skipConditional = false, skipAuras = false): EffectivePanel {
    return this.#panelOf(target, this.#active(target, !skipAuras), skipConditional);
  }

  gearPanel(target: ActorState): EffectivePanel {
    return this.#panelOf(target, this.#active(target, false).filter(status => status.id.startsWith("RELIC_")), true);
  }

  #panelOf(target: ActorState, held: RuntimeModifier[], skipConditional: boolean): EffectivePanel {
    const unconditional = held.filter(status => !isConditional(status));
    const conditional = held.filter(isConditional);
    const stats: Record<string, number> = { ...target.actor.stats };
    const template = this.host.template(target.actor.id);
    if (!(stats.taunt! > 0)) {
      const { taunt } = this.host.rulebook;
      stats.taunt = (template?.ownerId ? taunt.memosprite_base?.[template.name] : undefined) ??
        (template?.path ? taunt.path_base?.[template.path] : undefined) ?? 100;
    }
    const damageBonus: Record<string, number> = { ...target.actor.damageBonus };
    const pct: Record<string, number> = {};
    const add = (key: string, value: number) => {
      if (key in pctStat) pct[key] = (pct[key] ?? 0) + value;
      else if (key === "all_dmg" || key.startsWith("dmg_")) {
        const element = key === "all_dmg" ? "all" : key.slice(4);
        damageBonus[element] = element === "dmg_reduction"
          ? 1 - (1 - (damageBonus[element] ?? 0)) * (1 - value) : (damageBonus[element] ?? 0) + value;
      } else stats[key] = (stats[key] ?? 0) + value;
    };
    const enabled = [...unconditional];
    const conditionAdds: [string, number][] = [];
    if (!skipConditional && conditional.length) {
      const cache = new Map<ActorState, EffectivePanel>();
      const snapshot: PanelOf = actor => {
        const panel = cache.get(actor) ?? this.panelOf(actor, true);
        cache.set(actor, panel);
        return panel;
      };
      for (const status of conditional) {
        const holder = this.#holder(target, status);
        try {
          const gate = status.model.expressions.get("enable_if");
          if (gate && !this.host.evaluate(gate, holder, {}, { panelOf: snapshot })) continue;
          enabled.push(status);
          for (const key of Object.keys(map(status.model.raw.stat_exprs))) {
            const expression = status.model.expressions.get("stat_exprs." + key);
            if (expression) conditionAdds.push([key, Number(this.host.evaluate(expression, holder, {}, { panelOf: snapshot }))]);
          }
        } catch (error) {
          this.host.warn(status.name + $t("team-engine.native.mechanics.modifiers.text_8b599a6441") + String(error));
        }
      }
    }
    for (const status of enabled) if (!isScoped(status)) {
      for (const [key, value] of Object.entries(status.statEffects)) add(key, value);
    }
    for (const [key, value] of conditionAdds) add(key, value);
    const l1 = { ...stats };
    for (const [key, value] of Object.entries(pct)) {
      const base = pctStat[key]!;
      stats[base] = this.host.evaluateZone("stat_with_pct", { l1: stats[base] ?? 0, base: target.actor.stats[base] ?? 0, pct: value });
      stats[key] = value;
    }
    const own = enabled.filter(status => target.modifiers.get(status.id) === status);
    for (const status of own) {
      for (const [key, scaling] of Object.entries(map(status.model.raw.scaling_effects))) {
        if (Array.isArray(scaling) && typeof scaling[0] === "string" && l1[scaling[0]] !== undefined) {
          stats[key] = (stats[key] ?? 0) + l1[scaling[0]]! * number(scaling[1]);
        }
      }
    }
    for (const status of own) Object.assign(stats, status.overrideEffects);
    stats.taunt_eff = this.host.evaluateZone("taunt_eff", { taunt: stats.taunt, aggro_boost: stats.aggro_boost ?? 0 });
    const weakness = [...new Set([...(target.actor.weakness ?? []),
      ...[...target.modifiers.values()].flatMap(status => strings(modRaw(status).weakness_add))])];
    return { stats, damageBonus, weakness };
  }

  #holder(target: ActorState, status: RuntimeModifier): ActorState {
    if (target.modifiers.get(status.id) === status) return target;
    return [...this.host.actors()].find(actor => actor.modifiers.get(status.id) === status) ?? target;
  }

  enabled(actor: ActorState, status: RuntimeModifier): boolean {
    const expression = status.model.expressions.get("enable_if");
    if (!expression) return true;
    try { return Boolean(this.host.evaluate(expression, this.#holder(actor, status), {}, { panelOf: who => this.panelOf(who, true) })); }
    catch { return false; }
  }

  readonly scopedBoost: NonNullable<DamageInput["scopedBoost"]> = (actor, event, accept, target) => {
    let sum = 0;
    const payload = { ...event, target: target.actor.id };
    for (const status of actor.modifiers.values()) {
      if (!isRuntime(status) || !isScoped(status)) continue;
      const gate = status.model.expressions.get("hit_condition");
      try {
        if (gate && !this.host.evaluate(gate, actor, payload, { target })) continue;
        for (const [key, value] of Object.entries(status.statEffects)) if (accept(key)) sum += value;
        for (const key of Object.keys(map(status.model.raw.hit_stat_exprs))) {
          const expression = status.model.expressions.get("hit_stat_exprs." + key);
          if (expression && accept(key)) sum += Number(this.host.evaluate(expression, actor, payload, { target }));
        }
      } catch { /* A hit-domain expression with missing context contributes nothing to this hit. */ }
    }
    return sum;
  };

  apply(target: ActorState, model: Mechanic, source: ActorState | undefined, payload: EventPayload, chance?: number): boolean {
    const spec = model.raw;
    const id = string(spec.modifier_id), type = string(spec.modifier_type, "buff");
    const sourceId = source?.actor.id ?? "";
    const name = string(spec.name, id);
    if (!id) throw new TypeError($t("team-engine.native.mechanics.modifiers.text_dd4ccca820"));
    const controlKind = string(spec.control_kind);
    const kind = string(spec.debuff_kind, controlKind ? "control" : type);
    if (kind !== "buff") {
      for (const status of target.modifiers.values()) {
        if (!isRuntime(status) || !strings(status.model.raw.grants_immune).includes(kind) || !this.enabled(target, status)) continue;
        this.host.emit("on_immune", { modifier_id: id, target: target.actor.id });
        return false;
      }
    }
    if (chance !== undefined && penaltyTypes.has(type)) {
      const sourcePanel = source ? this.panelOf(source) : { stats: {} };
      const success = hitChance(this.host.rulebook, sourcePanel, this.panelOf(target), chance, sourcePanel.stats.effect_res_pen);
      if (this.host.mode === "expected" ? success < 0.5 : this.host.rng() >= success) {
        this.host.emit("on_resist", { chance: success, modifier_id: id, target: target.actor.id });
        return false;
      }
    }

    const durationSpec = map(spec.duration);
    const anchor = (durationSpec.tick_on === "$modifier.source" ? "source_turn_end" :
      string(spec.tick_anchor, "owner_turn_end")) as ModifierAnchor;
    if (!validAnchors.has(anchor)) throw new TypeError(name + $t("team-engine.native.mechanics.modifiers.text_ff77c8ab55"));
    const maxStacks = number(spec.max_stack, 99);
    const stackMode = string(spec.stack_mode, "refresh");
    const dotExpr = model.expressions.get("dot_ratio_expr");
    let dot: DamageOverTime | undefined;
    if (type === "dot") {
      const ratio = number(spec.dot_ratio), element = string(spec.dot_element);
      if (!source || !element || (!dotExpr && ratio <= 0)) throw new TypeError(name + $t("team-engine.native.mechanics.modifiers.text_b1ce359c35"));
      dot = { id, element, ratio, source, sourceAtk: this.panelOf(source).stats.atk, snapshot: dotSnapshot(this.host.rulebook, source, target, element,
        dotExpr ? undefined : ratio, number(spec.dot_base_chance, 1), actor => this.panelOf(actor)) };
    }
    const status: RuntimeModifier = {
      id, type, model, sourceId, name, maxStacks, dot, anchor, controlKind,
      preventAction: !!spec.prevent_action, toughnessLock: !!spec.toughness_lock,
      forcedTaunt: !!spec.forced_taunt, lockOn: !!spec.lock_on,
      overrideEffects: numeric(spec.override_effects), statEffects: numeric(spec.stat_effects),
      duration: Math.trunc(number(spec.duration, number(durationSpec.value))), fixedHpBars: number(spec.fixed_hp_bars),
      stacks: Math.max(1, Math.min(maxStacks, Math.trunc(number(spec.stacks, 1)))),
      dispellable: spec.dispellable !== false,
    };
    const group = string(spec.singleton_group);
    if (group) for (const old of [...target.modifiers.values()]) {
      if (old.id !== id && modRaw(old).singleton_group === group) this.remove(target, old.id, "replace");
    }
    const old = target.modifiers.get(id);
    if (old && stackMode !== "replace") {
      old.stacks = stackMode === "set"
        ? Math.max(1, Math.min(isRuntime(old) ? old.maxStacks : maxStacks, Math.trunc(number(spec.stacks_value))))
        : Math.min(isRuntime(old) ? old.maxStacks : maxStacks, old.stacks + status.stacks);
      old.duration = Math.max(old.duration, status.duration);
    } else {
      if (old) this.remove(target, id, "replace");
      target.modifiers.set(id, status);
    }
    this.#conditionalSeen ||= isConditional(status);
    const contributions = [
      ...Object.keys(status.statEffects), ...Object.keys(map(spec.scaling_effects)), ...Object.keys(status.overrideEffects ?? {}),
    ];
    this.host.emit("after_apply_modifier", { modifier_id: id, modifier_type: type,
      stat: [...new Set(contributions)].sort(), target: target.actor.id, source: sourceId });
    this.syncSpeed(target);
    if (spec.shield) this.#attachShield(target, status, source);
    for (const [index] of entries(spec.on_apply).entries()) {
      this.host.runModifierEffect(target, subMechanic(model, "on_apply." + index), payload);
    }
    return true;
  }

  remove(target: ActorState, id: string, reason = "expire"): void {
    const status = target.modifiers.get(id);
    if (!status) return;
    target.modifiers.delete(id);
    this.#shields.set(target.actor.id, (this.#shields.get(target.actor.id) ?? []).filter(shield => shield.id !== id));
    const payload = { modifier_id: id, reason, target: target.actor.id, source: status.sourceId ?? "" };
    if (isRuntime(status)) {
      for (const [index] of entries(status.model.raw.on_remove).entries()) {
        this.host.runModifierEffect(target, subMechanic(status.model, "on_remove." + index), payload);
      }
    }
    this.host.emit("after_remove_modifier", payload);
    this.syncSpeed(target);
  }

  tick(owner: ActorState, anchor: ModifierAnchor): void {
    const holders = anchor.startsWith("source_") ? [...this.host.actors()] : [owner];
    for (const actor of holders) for (const mod of [...actor.modifiers.values()]) {
      if (!isRuntime(mod) || mod.anchor !== anchor || mod.duration <= 0 ||
        (anchor.startsWith("source_") && mod.sourceId !== owner.actor.id)) continue;
      if (--mod.duration === 0) {
        this.remove(actor, mod.id);
        if (mod.model.raw.moon_cocoon) {
          actor.currentHp = 0;
          this.host.checkDeath(actor, mod.sourceId, "");
        }
      }
    }
  }

  cleanse(target: ActorState, kind: "buff" | "penalty", count = 1): number {
    let removed = 0;
    for (const status of [...target.modifiers.values()].reverse()) {
      if (removed >= count) break;
      if (!isRuntime(status) || !status.dispellable || (kind === "buff" ? status.type !== "buff" : !penaltyTypes.has(status.type))) continue;
      this.remove(target, status.id, kind === "buff" ? "dispel" : "purify");
      removed++;
    }
    return removed;
  }

  syncConditionalSpeed(): void {
    if (this.#conditionalSeen) this.syncSpeed();
  }

  syncSpeed(target?: ActorState): void {
    if (target && isEnemy(target.actor)) return;
    for (const actor of this.host.actors()) {
      if (!actor.alive || isEnemy(actor.actor)) continue;
      const previous = this.host.speedOf(actor.actor.id);
      if (previous === undefined) continue;
      const next = this.panelOf(actor).stats.spd ?? 100;
      if (Math.abs(previous - next) > 1e-9) this.host.changeSpeed(actor.actor.id, next);
    }
  }

  clearShields(target: ActorState): void { this.#shields.delete(target.actor.id); }

  shieldTotal(target: ActorState): number { return shieldSum(this.#shields.get(target.actor.id) ?? []); }

  shieldCount(target: ActorState, sourceId?: string): number {
    return (this.#shields.get(target.actor.id) ?? []).filter(shield => shield.remaining > 0 &&
      (!sourceId || sourceId === shield.sourceId)).length;
  }

  #attachShield(target: ActorState, status: RuntimeModifier, source?: ActorState): void {
    const spec = map(status.model.raw.shield);
    const pool = string(spec.accumulate);
    const panel = source ? this.panelOf(source) : undefined;
    const valueOf = (raw: EventPayload) => shieldValue(this.host.rulebook, panel,
      { flat: number(raw.flat), scaling: numeric(raw.scaling) });
    const shields = this.#shields.get(target.actor.id) ?? [];
    const previous = pool ? shields.find(shield => shield.pool === pool && shield.id === status.id) : undefined;
    const others = shields.filter(shield => shield.id !== status.id);
    const cap = spec.cap ? valueOf(map(spec.cap)) * number(map(spec.cap).multiplier, 1) : Infinity;
    const room = pool ? Math.max(0, cap - shieldSum(others.filter(shield => shield.pool === pool))) : Infinity;
    const remaining = Math.min(room, (previous?.remaining ?? 0) + valueOf(spec));
    this.#shields.set(target.actor.id, [...others, { id: status.id, sourceId: status.sourceId, pool, remaining }]);
    if (target.modifiers.has("MOON_COCOON")) this.remove(target, "MOON_COCOON", "cocoon_release");
  }

  absorb(target: ActorState, amount: number, sourceId: string): number {
    const shields = this.#shields.get(target.actor.id);
    if (!shields?.length || amount <= 0) return Math.max(0, amount);
    const units = new Map<string, Shield[]>();
    for (const shield of shields) {
      const key = shield.pool || "\0" + shield.id;
      const instances = units.get(key) ?? [];
      instances.push(shield);
      units.set(key, instances);
    }
    const overflow = Math.max(0, amount - Math.max(...[...units.values()].map(shieldSum)));
    const popped: Shield[] = [];
    for (const unit of units.values()) {
      let left = amount;
      for (const shield of unit) {
        const taken = Math.min(shield.remaining, left);
        shield.remaining -= taken;
        left -= taken;
        this.host.emit("shield_absorbed", { shield_id: shield.id, amount: taken, remaining: Math.max(0, shield.remaining),
          source: sourceId, target: target.actor.id });
        if (shield.remaining <= 1e-9) popped.push(shield);
        if (left <= 0) break;
      }
    }
    for (const shield of popped) {
      this.#shields.set(target.actor.id, (this.#shields.get(target.actor.id) ?? []).filter(instance => instance !== shield));
      this.host.emit("shield_broken", { shield_id: shield.id, source: sourceId, target: target.actor.id });
      this.remove(target, shield.id, "shield_broken");
    }
    return overflow;
  }
}
