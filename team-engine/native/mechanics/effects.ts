// HSR Nous effect execution, adapted from the MIT-licensed pinned engine.
import { consumeEnergy, heal, hitChance, isEnemy, settleDamage, type ActorState } from "../combat/index.ts";
import { entries, map, number, string, strings } from "../compile/library.ts";
import type { CompiledAction, CompiledActor, Mechanic } from "../compile/types.ts";
import type { BattleRunner } from "../runner/runner.ts";
import { applyHitToughness, triggerBreak } from "../runner/action.ts";
import type { EventPayload, EventUpdate } from "./events.ts";
import type { HookContext } from "./context.ts";
import { dataOf, subMechanic, type ModifierBook, type RuntimeModifier } from "./modifiers.ts";
import type { ResourceBook } from "./resources.ts";

interface Chain {
  last: Record<string, unknown>;
  segment: number;
}
const newChain = (): Chain => ({ last: {}, segment: 0 });
const elements = new Set(["physical", "fire", "ice", "thunder", "wind", "quantum", "imaginary"]);
const readName = (actor: ActorState) => actor.actor.id;

export class HookEffects {
  #damageFrame = 0;
  #nextDamageFrame = 0;
  #cocoonFrame = -1;

  constructor(readonly runner: BattleRunner, readonly context: HookContext, readonly modifiers: ModifierBook,
    readonly resources: ResourceBook) {}

  chain(effects: readonly Mechanic[], actor: ActorState, payload: EventPayload, waterfall: boolean): EventUpdate | undefined {
    const updates: { amount?: number; cancel?: boolean } = {};
    const chain = newChain();
    for (const effect of effects) {
      if (effect.raw.effect_type === "once_per_battle") {
        const id = string(effect.raw.latch_id);
        if (this.runner.state.onceLatches.has(id)) break;
        this.runner.state.onceLatches.add(id);
      } else this.effect(effect, actor, payload, chain, waterfall ? updates : undefined);
    }
    return waterfall ? updates : undefined;
  }

  effect(model: Mechanic, source: ActorState, payload: EventPayload, chain = newChain(),
    updates?: { amount?: number; cancel?: boolean }): void {
    const { runner, context, resources, modifiers } = this;
    const raw = model.raw;
    const id = source.actor.id;
    const actionId = string(payload.action_id ?? payload.action);
    const extra = { last: chain.last, prev: chain.last };
    const amount = (key: string, fallback = 0, target?: ActorState) =>
      context.amount(model, key, source, payload, { target, extra }, fallback);
    const targeter = (key = "target", fallback = "self") => context.targets(raw[key] ?? fallback, source, payload);
    const type = string(raw.effect_type);
    const resourceId = string(raw.resource_id);
    if (raw.condition != null && !amount("condition")) return;
    switch (type) {
      case "cancel_event":
        if (updates) updates.cancel = true;
        return;
      case "modify_amount":
        if (updates) updates.amount = amount("amount");
        return;
      case "gain_resource":
      case "set_resource": {
        const inputSource = this.#resolveRef(raw.source, source, payload)?.actor.id || id;
        for (const target of targeter()) {
          const value = amount("amount", 0, target);
          if (type === "set_resource") resources.set(target, resourceId, value, inputSource);
          else resources.gain(target, resourceId, value, inputSource);
        }
        return;
      }
      case "refund_bank":
        resources.refund(source, resourceId);
        return;
      case "gain_energy":
      case "consume_energy":
        for (const target of targeter()) {
          if (target.banished) continue;
          const value = amount("amount", 0, target);
          if (type === "gain_energy") runner.grantEnergy(target, value, { source: id, reason: "effect", errExempt: !!raw.err_exempt });
          else consumeEnergy(target, Math.max(0, value));
        }
        return;
      case "gain_skill_point": {
        const value = Math.trunc(amount("amount"));
        const overflow = Math.max(0, runner.state.skillPoints + value - runner.state.maxSkillPoints);
        runner.adjustSkillPoints(value, "hook", id);
        if (overflow && raw.overflow_to) resources.gain(source, string(raw.overflow_to), overflow, id);
        return;
      }
      case "set_sp_max":
        runner.state.spMaxOverride = Math.trunc(amount("amount"));
        runner.state.skillPoints = Math.min(runner.state.skillPoints, runner.state.maxSkillPoints);
        return;
      case "refill_skill_point": {
        const rid = string(raw.from_resource);
        const value = Math.min(runner.state.maxSkillPoints - runner.state.skillPoints, resources.value(source, rid));
        if (value > 0) {
          runner.adjustSkillPoints(value, "hook", id);
          resources.gain(source, rid, -value, id);
        }
        return;
      }
      case "grant_extra_turn":
      case "immediate_action":
      case "delay_action":
      case "advance_action":
        for (const target of targeter()) {
          if (!target.alive || runner.scheduler.speedOf(target.actor.id) === undefined) continue;
          if (type === "grant_extra_turn") runner.scheduler.grantExtraTurn(target.actor.id);
          else if (type === "immediate_action") runner.scheduler.actNow(target.actor.id);
          else if (type === "advance_action") runner.scheduler.advanceAction(target.actor.id, amount("amount") / 100);
          else {
            const panel = modifiers.panelOf(source);
            const chance = hitChance(runner.encounter.rules, panel, modifiers.panelOf(target), number(raw.apply_chance, 1), panel.stats.effect_res_pen);
            if (runner.mode === "expected" ? chance >= 0.5 : context.rng() < chance) {
              runner.scheduler.delayAction(target.actor.id, amount("amount") / 100);
            } else runner.emit("on_resist", { modifier_id: actionId || "delay_action", target: target.actor.id, chance });
          }
        }
        return;
      case "heal_self":
        this.#heal(source, source, amount("ratio"), 0, actionId);
        return;
      case "heal":
        chain.last.actual_amount = targeter().reduce((acc, target) =>
          acc + this.#heal(source, target, amount("ratio", 0, target), amount("amount", 0, target), actionId), 0);
        return;
      case "drain_hp": {
        let total = 0;
        const floor = amount("floor");
        for (const target of targeter()) {
          const event = runner.waterfall("before_drain", { source: id, target: target.actor.id,
            amount: amount("amount", 0, target), floor, reason: "drain", action_id: actionId });
          if (event.cancel) continue;
          const actual = Math.min(number(event.amount), Math.max(0, target.currentHp - floor));
          if (actual <= 0) continue;
          target.currentHp -= actual;
          total += actual;
          runner.emit("on_hp_decrease", { amount: actual, source: id, reason: "drain", target: target.actor.id });
          runner.checkDeath(target, id);
        }
        const ratio = amount("drain_ratio", 1);
        if (total > 0 && ratio > 0) for (const target of targeter("heal_target")) this.#heal(source, target, 0, total * ratio, actionId);
        if (total > 0 && raw.into_resource) resources.gain(source, string(raw.into_resource), total, id);
        return;
      }
      case "set_hp_to_percent": {
        const pct = raw.percent !== undefined ? amount("percent") : amount("amount");
        for (const target of targeter()) {
          const old = target.currentHp, max = modifiers.panelOf(target).stats.hp ?? 0;
          target.currentHp = Math.max(0, Math.min(max, max * pct));
          if (old > target.currentHp) runner.emit("on_hp_decrease", { amount: old - target.currentHp, source: id,
            reason: "set_hp", target: target.actor.id });
          runner.checkDeath(target);
        }
        return;
      }
      case "apply_modifier": {
        const modifier = subMechanic(model, "modifier");
        const caster = this.#resolveRef(raw.source, source, payload);
        if (!caster) throw new Error("无法读取状态施加者 " + string(raw.source));
        const targets = targeter();
        const baked = this.#bakeModifier(modifier, source, payload);
        for (const target of targets) this.#applyBakedModifier(target, baked, caster, payload, number(raw.apply_chance, 1), source);
        return;
      }
      case "remove_modifier": {
        const wanted = string(raw.modifier_id);
        let count = 0;
        for (const target of targeter()) {
          if (!raw.filter) {
            if (target.modifiers.has(wanted)) count++;
            modifiers.remove(target, wanted, string(raw.reason, "remove"));
            continue;
          }
          const expression = model.expressions.get("filter") ?? context.expression(raw.filter, source);
          const matching = [...target.modifiers.values()].reverse().filter(status => {
            const meta = dataOf(status);
            if (meta.dispellable === false || (wanted && wanted !== status.id)) return false;
            const mod = { modifier_id: status.id, modifier_type: status.type, kind: meta.debuff_kind ||
              (status.controlKind ? "control" : status.type), control_kind: status.controlKind ?? "",
              debuff_kind: meta.debuff_kind ?? "", dot_element: meta.dot_element ?? "", dispellable: true,
              prevent_action: meta.prevent_action ?? false, name: meta.name ?? status.id, source: status.sourceId ?? "" };
            return context.evaluate(expression, source, payload, { extra: { mod } });
          }).slice(0, number(raw.max_count, target.modifiers.size));
          for (const status of matching) modifiers.remove(target, status.id, string(raw.reason, "remove"));
          count += matching.length;
        }
        chain.last.removed_count = count;
        return;
      }
      case "absorb_modifier": {
        let absorbed = 0;
        for (const target of targeter()) for (const status of [...target.modifiers.values()]) {
          const meta = dataOf(status);
          if (meta.dispellable === false || meta.name !== raw.modifier_name) continue;
          absorbed += Math.max(1, status.stacks);
          modifiers.remove(target, status.id, "absorb");
        }
        if (absorbed > 0) resources.gain(source, resourceId, absorbed, id);
        return;
      }
      case "adjust_stacks":
      case "adjust_duration":
        for (const target of targeter()) {
          const status = target.modifiers.get(string(raw.modifier_id));
          if (!status) continue;
          if (type === "adjust_stacks") status.stacks = Math.max(0,
            Math.min(number(dataOf(status).max_stack, 99), Math.trunc(status.stacks + amount("delta", 0, target))));
          else {
            status.duration = Math.max(0, status.duration + Math.trunc(amount("delta")));
            if (status.duration === 0) modifiers.remove(target, status.id);
          }
        }
        return;
      case "trigger_action": {
        const dynamic = raw.action_id === "$event.action_id";
        const casters = dynamic ? context.targets("$event.actor", source, payload) : targeter("caster");
        if (dynamic && !casters.length) return;
        if (casters.length !== 1) throw new Error("代放行动须指定一个施放者");
        const caster = casters[0]!;
        const possible = runner.actionsOf(caster).filter(action => raw.action_type !== undefined
          ? action.kind === raw.action_type : action.id === (dynamic ? payload.action_id : raw.action_id));
        if (raw.action_type !== undefined && possible.length !== 1) throw new Error("代放行动类型须匹配一项行动");
        const found = possible[0];
        if (!found) return;
        const forced = !dynamic && raw.target !== undefined ? targeter() : undefined;
        if (forced?.length === 0) return;
        if (forced && forced.length !== 1) throw new Error("代放行动须指定一个目标");
        const action = raw.scaling_atk !== undefined ? { ...found, scaling: [{ atk: amount("scaling_atk") }] } : found;
        runner.execute(caster, action, { insert: true, tag: "hook", forcedTarget: forced?.[0],
          poolOverride: raw.pool_override !== undefined ? amount("pool_override") : undefined });
        return;
      }
      case "summon":
        this.#summon(source, string(raw.summon_id), string(raw.position, "after_owner"));
        return;
      case "dismiss_summon":
        runner.dismiss(string(raw.summon_id));
        return;
      case "leave_battle":
        for (const target of targeter()) runner.leave(target.actor.id, string(raw.reason, "flee"));
        return;
      case "remove_shield":
        for (const target of targeter()) modifiers.clearShields(target);
        return;
      case "aha_instant":
        runner.runAhaTurn(amount("amount"));
        return;
      case "activate_ultimate":
        for (const target of targeter("target", "other_allies")) runner.activateUltimate(target);
        return;
      case "exit_state":
        for (const target of targeter()) runner.exitState(target, string(raw.reason, "hook"));
        return;
      case "bind_roll":
        context.bindRoll(string(raw.roll_key), amount("scale", 1));
        return;
      case "set_dynamic_value":
        for (const target of targeter()) context.setDynamic(target, string(raw.dynamic_key), amount("amount", 0, target));
        return;
      case "add_toughness_bar":
        for (const target of targeter("target", "enemy_first")) target.addedBars.push(amount("amount", 0, target));
        return;
      case "restore_toughness":
        for (const target of targeter("target", "enemy_first")) {
          target.broken = false;
          target.barIndex = 0;
          target.toughness = target.actor.stats.max_toughness ?? 0;
        }
        return;
      case "reduce_toughness":
        for (const target of targeter("target", "enemy_first")) {
          if (target.barsExhausted || !isEnemy(target.actor) || [...target.modifiers.values()].some(mod => dataOf(mod).toughness_lock)) continue;
          const value = amount("amount", 0, target), floor = amount("floor", 0, target);
          if (value < 0 || floor < 0) throw new RangeError("固定削韧量与下限须为非负数");
          const actual = Math.min(value, Math.max(0, target.toughness - floor));
          const element = string(raw.damage_type, "physical");
          if (actual > 0) {
            target.toughness -= actual;
            runner.emit("on_toughness_damage", { amount: actual, bar_index: target.barIndex, source: id, target: target.actor.id });
          }
          if (target.toughness <= 0) triggerBreak(runner, source, target, this.#attack(model, "skill", element, []));
        }
        return;
      case "trigger_dot":
        for (const target of targeter("target", "enemy_first")) {
          this.tickDots(target, amount("ratio", 1), string(raw.scope, "all"), string(raw.dot_element), id);
        }
        return;
      case "deal_damage":
        this.#dealDamage(model, source, targeter("target", "enemy_first"), payload, chain);
        return;
      case "break_damage":
        for (const target of targeter("target", "enemy_first")) this.damageFrame(() => {
          const element = string(raw.element, "physical");
          const result = settleDamage(runner.encounter.rules, { ...runner.damageInput(source, target), category: "break", element });
          const value = result.value * amount("ratio", 1);
          target.currentHp -= value;
          if (value > 0) runner.emit("on_hp_decrease", { amount: value, reason: "break", source: id, target: target.actor.id });
          runner.state.recordDamage(id, value);
          runner.checkDeath(target, id, actionId);
        });
        return;
      case "random_choice": {
        const choices = entries(raw.options);
        if (!choices.length) throw new Error("随机效果未包含选项");
        let selection = 0;
        if (runner.mode === "roll") {
          const weights = choices.map(item => number(item.weight, 1));
          let left = context.rng() * weights.reduce((sum, weight) => sum + weight, 0);
          while (selection < choices.length - 1 && (left -= weights[selection]!) >= 0) selection++;
        }
        this.effect(subMechanic(model, "options." + selection), source, payload, chain, updates);
        return;
      }
      case "barrage_damage":
        this.#barrage(model, source, payload, chain);
        return;
      default: throw new Error("未知战斗效果 " + type);
    }
  }

  applyModifier(target: ActorState, model: Mechanic, source: ActorState, payload: EventPayload = {}, chance?: number,
    evaluator = source): boolean {
    return this.#applyBakedModifier(target, this.#bakeModifier(model, evaluator, payload), source, payload, chance, evaluator);
  }

  #bakeModifier(model: Mechanic, evaluator: ActorState, payload: EventPayload): Mechanic {
    const { raw } = model;
    const stats = map(raw.stat_effects);
    const effects = Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, typeof value === "string"
      ? Number(this.context.evaluate(model.expressions.get("stat_effects." + key) ?? this.context.expression(value, evaluator),
        evaluator, payload)) : value]));
    const attached = new Map(model.expressions);
    const liveDot = typeof raw.dot_ratio === "string" && /\$(snapshot|modifier)\b/.test(raw.dot_ratio);
    if (liveDot) attached.set("dot_ratio_expr", model.expressions.get("dot_ratio") ?? this.context.expression(raw.dot_ratio, evaluator));
    const bake = (key: string) => typeof raw[key] === "string"
      ? this.context.amount(model, key, evaluator, payload) : raw[key];
    const bakeShield = (name: string): EventPayload => {
      const shield = subMechanic(model, name);
      const sourceStats = map(shield.raw.scaling);
      return { ...shield.raw,
        flat: typeof shield.raw.flat === "string" ? this.context.amount(shield, "flat", evaluator, payload) : shield.raw.flat,
        scaling: Object.fromEntries(Object.entries(sourceStats).map(([key, value]) => [key, typeof value === "string" ?
          Number(this.context.evaluate(shield.expressions.get("scaling." + key) ?? this.context.expression(value, evaluator),
            evaluator, payload)) : value])),
      };
    };
    const shield = raw.shield ? { ...bakeShield("shield"),
      cap: map(raw.shield).cap ? bakeShield("shield.cap") : undefined } : undefined;
    return { expressions: attached, raw: { ...raw, shield, stat_effects: effects,
      dot_ratio: liveDot ? undefined : bake("dot_ratio"), dot_base_chance: bake("dot_base_chance") } };
  }

  #applyBakedModifier(target: ActorState, model: Mechanic, source: ActorState, payload: EventPayload,
    chance: number | undefined, evaluator: ActorState): boolean {
    // Shared modifier amounts use the cast snapshot. Only stacks may refer to
    // the receiving target and are evaluated separately for each application.
    const stacks = typeof model.raw.stacks === "string"
      ? this.context.amount(model, "stacks", evaluator, payload, { target }) : model.raw.stacks;
    return this.modifiers.apply(target, { ...model, raw: { ...model.raw, stacks } }, source, payload, chance);
  }

  #resolveRef(ref: unknown, source: ActorState, payload: EventPayload): ActorState | undefined {
    if (!ref) return source;
    const key = string(ref);
    if (key.startsWith("$event.")) return this.context.actor(payload[key.slice(7)]);
    if (key.startsWith("modifier:")) {
      const owner = payload.actor ? this.context.actor(payload.actor) : source;
      return this.context.actor(owner?.modifiers.get(key.slice(9))?.sourceId);
    }
    return this.context.actor(ref);
  }

  #heal(source: ActorState, target: ActorState, hpScaling: number, flat: number, actionId: string): number {
    const { runner, modifiers } = this;
    const healSource = this.context.actor(this.context.template(source.actor.id)?.ownerId) ?? source;
    const result = heal(runner.encounter.rules, source, target, { hpScaling, flat, healBonusSource: healSource,
      panelOf: actor => modifiers.panelOf(actor), scopedHealBonus: (who, ratio, target) => modifiers.scopedBoost(who,
        { target_hp_ratio: ratio }, stat => stat === "heal_bonus", target) });
    const actual = number(result.node.actualAmount), excess = Math.max(0, result.value - actual);
    if (actual > 0 || excess > 0) runner.emit("on_hp_increase", {
      amount: actual, excess, source: source.actor.id, reason: "heal", target: target.actor.id, action_id: actionId,
    });
    if (actual > 0 && target.modifiers.has("MOON_COCOON")) modifiers.remove(target, "MOON_COCOON", "cocoon_release");
    return actual;
  }

  #summon(owner: ActorState, id: string, position: string): void {
    if (this.runner.state.actors.get(id)?.alive) return;
    const template = this.runner.encounter.summons.get(id);
    if (!template?.summon) throw new Error("未登记召唤物 " + id);
    const { inheritance, maxHpRatio, capabilities } = template.summon;
    const gear = this.modifiers.gearPanel(owner);
    const stats = { ...template.stats };
    let damageBonus = template.damageBonus, resistance = template.resistance, weakness = template.weakness;
    if (inheritance === "full") {
      for (const key of Object.keys(stats)) if (gear.stats[key] !== undefined) (stats as Record<string, number>)[key] = gear.stats[key];
      damageBonus = gear.damageBonus ?? {};
      resistance = this.context.template(owner.actor.id)?.resistance ?? {};
      weakness = gear.weakness ?? [];
    } else if (Array.isArray(inheritance)) {
      for (const raw of inheritance) {
        const key = raw === "def" ? "def_" : raw;
        if (key === "dmg_bonus") damageBonus = gear.damageBonus ?? {};
        else if (key === "resistance") resistance = this.context.template(owner.actor.id)?.resistance ?? {};
        else if (key === "weakness") weakness = gear.weakness ?? [];
        else (stats as Record<string, number>)[key] = gear.stats[key] ?? owner.actor.stats[key] ?? 0;
      }
    }
    if (maxHpRatio > 0) stats.hp = (this.modifiers.panelOf(owner).stats.hp ?? 0) * maxHpRatio;
    stats.max_energy = 0;
    const deployed: CompiledActor = { ...template, stats, damageBonus, resistance, weakness };
    const actor = this.runner.spawn(deployed, position === "before_owner" ? { before: owner.actor.id }
      : position === "after_owner" ? { after: owner.actor.id } : {});
    actor.currentHp = stats.hp;
    if (capabilities.av === false) this.runner.scheduler.freeze(id);
    this.runner.emit("actor_enter", { actor: id, reason: "summon", actor_type: deployed.kind, wave_index: this.runner.wave });
  }

  #attack(model: Mechanic, kind: string, damageType: string, scaling: CompiledAction["scaling"]): CompiledAction {
    return { ...model, id: "hook_" + string(model.raw.name, "dmg"), name: string(model.raw.name, "效果伤害"),
      kind, damageType, levelKey: kind, target: "single", scaling, scalingBlast: [] };
  }

  #dealDamage(model: Mechanic, source: ActorState, targets: readonly ActorState[], payload: EventPayload, chain: Chain): void {
    const { runner, context, modifiers } = this;
    const raw = model.raw, id = source.actor.id;
    const actionId = string(payload.action_id);
    const amount = (key: string, target?: ActorState, fallback = 0) => context.amount(model, key, source,
      payload, { target, extra: { last: chain.last, prev: chain.last } }, fallback);
    const category = string(raw.category, "direct");
    const trueDamage = category === "true" || category === "atrophy";
    const elation = category === "elation";
    const kind = string(raw.action_type, category === "additional" ? "additional" : "follow_up");
    let damageType = string(raw.damage_type, "physical").toLowerCase();
    if (!elements.has(damageType) && !(trueDamage && damageType === "true")) {
      damageType = string(context.evaluate(context.expression(raw.damage_type, source), source, payload)).toLowerCase();
      if (!elements.has(damageType)) throw new TypeError("伤害属性求值结果无效 " + damageType);
    }
    const scaling = { ...(raw.scaling_atk == null ? {} : { atk: amount("scaling_atk") }),
      ...(raw.scaling_hp == null ? {} : { hp: amount("scaling_hp") }) };
    const toughness = amount("toughness_dmg");
    const action = this.#attack({ ...model, raw: { ...raw, toughness_dmg: toughness } }, kind, damageType, [scaling]);
    const hitTargets = targets.map(readName);
    let total = 0;
    let elationInput: Record<string, unknown> | undefined;
    if (elation) {
      elationInput = { punchline_source: raw.punchline_source === undefined
        ? this.resources.value(source, "certified_banger") : amount("punchline_source") };
      if (raw.elation !== undefined) elationInput.elation = amount("elation");
    }
    for (const target of targets) if (target.alive) this.damageFrame(() => {
      const wasBroken = target.broken;
      const base = raw.amount === undefined ? undefined : amount("amount", target);
      const result = settleDamage(runner.encounter.rules, { ...runner.damageInput(source, target), action,
        category: trueDamage ? "true" : elation ? "elation" : "direct", element: damageType,
        parameters: trueDamage ? { fixed_value: base } : elation ? { ...elationInput, ability_multiplier: base }
          : { target_broken: wasBroken, base_override: base } });
      const amountDealt = result.value, critical = !!result.node.isCrit;
      total += amountDealt;
      const overflow = raw.ignore_shield ? amountDealt : modifiers.absorb(target, amountDealt, id);
      target.currentHp -= overflow;
      if (overflow > 0) runner.emit("on_hp_decrease", { amount: overflow, source: id, reason: "hit",
        target: target.actor.id, damage_type: category === "true" ? "true" : damageType,
        action_type: category === "atrophy" ? string(payload.action_type, "skill") : kind, is_critical: critical });
      runner.state.recordDamage(id, amountDealt);
      if (isEnemy(target.actor) && toughness > 0) applyHitToughness(runner, source, target, action, wasBroken, actionId);
      runner.checkDeath(target, id, actionId);
      const energy = number(raw.energy_grant);
      if (energy > 0 && target.alive) runner.grantEnergy(target, energy, { source: id, actionId: action.id, reason: "hit" });
      if (!trueDamage && kind !== "additional" && amountDealt > 0) {
        runner.emit("after_being_hit", { amount: amountDealt, absorbed: amountDealt - overflow, damage_type: damageType,
          source: id, target: target.actor.id, is_critical: critical, seg_index: chain.segment, actor_type: source.actor.kind,
          action_type: kind, hit_targets: hitTargets, action_id: action.id, primary_target: hitTargets[0] });
      }
    });
    if (!trueDamage && kind !== "additional" && total > 0) chain.segment++;
    chain.last.actual_amount = total;
  }

  #barrage(model: Mechanic, source: ActorState, payload: EventPayload, chain: Chain): void {
    const raw = model.raw;
    const count = Math.trunc(this.context.amount(model, "instances_expr", source, payload, {}, 1));
    const seen = new Set<string>();
    for (let index = 0; index < count; index++) {
      const allies = this.runner.actors("player");
      if (!allies.length) break;
      const remaining = allies.filter(unit => !seen.has(unit.actor.id));
      const target = remaining.at(-1) ?? allies[this.runner.mode === "roll" ? Math.floor(this.context.rng() * allies.length) : 0]!;
      const nested = { ...payload, barrage_target: target.actor.id };
      this.#dealDamage(model, source, [target], nested, chain);
      if (seen.has(target.actor.id)) {
        const expressions = new Map(model.expressions);
        expressions.delete("scaling_atk");
        const repeat = model.expressions.get("repeat_scaling_atk");
        if (repeat) expressions.set("scaling_atk", repeat);
        this.#dealDamage({ raw: { ...raw, scaling_atk: raw.repeat_scaling_atk ?? 0 }, expressions }, source, [target], nested, chain);
      }
      seen.add(target.actor.id);
    }
  }

  tickDots(actor: ActorState, ratio = 1, scope = "all", element = "", ownerId = ""): void {
    for (const modifier of [...actor.modifiers.values()]) {
      if (!actor.alive) break;
      const status = modifier as RuntimeModifier;
      const dot = status.dot;
      if (!dot || (element && dot.element !== element) ||
        (scope !== "all" && (scope === "self" ? status.sourceId !== ownerId : scope !== status.id))) continue;
      const expr = status.model.expressions.get("dot_ratio_expr");
      const elementCategory = dot.element === "physical" && status.id.startsWith("BRK_DOT_") ? "bleed" : "dot";
      const oldHp = actor.currentHp;
      const source = dot.source ?? actor;
      const result = settleDamage(this.runner.encounter.rules, { ...this.runner.damageInput(actor, actor),
        element: dot.element, category: elementCategory, modifier: { ...dot, stacks: status.stacks,
          liveRatio: expr ? { source: expr.source, value: () => Number(this.context.evaluate(expr, actor, {},
            { extra: { snapshot: { ...dot.snapshot, atk: dot.sourceAtk ?? 0 }, modifier: { stacks: status.stacks, duration: status.duration, max_stack: status.maxStacks, modifier_id: status.id, dot_element: dot.element } } })) } : undefined,
        } });
      const value = result.value * ratio;
      const overflow = this.modifiers.absorb(actor, value, status.sourceId);
      actor.currentHp = oldHp - overflow;
      if (overflow > 0) this.runner.emit("on_hp_decrease", { amount: overflow, source: status.sourceId, reason: "dot",
        target: actor.actor.id, damage_type: dot.element });
      this.runner.state.recordDamage(source.actor.id, value);
      this.runner.emit("on_dot_retrigger", { modifier_id: status.id, target: actor.actor.id });
      this.runner.checkDeath(actor, status.sourceId);
    }
  }

  damageFrame<T>(run: () => T): T {
    const frame = this.#damageFrame;
    this.#damageFrame = ++this.#nextDamageFrame;
    try { return run(); } finally { this.#damageFrame = frame; }
  }

  sourceExit(id: string, death = false): void {
    for (const actor of this.runner.state.actors.values()) for (const mod of [...actor.modifiers.values()]) {
      if (mod.sourceId !== id) continue;
      if (death && dataOf(mod).remove_on_source_death) this.modifiers.remove(actor, mod.id, "source_death");
      else if (dataOf(mod).remove_on_source_exit) this.modifiers.remove(actor, mod.id, "source_exit");
    }
  }

  checkDeath(target: ActorState, sourceId: string, actionId: string): void {
    if (!target.alive || target.currentHp > 0) return;
    const { runner, modifiers } = this;
    const targetId = target.actor.id;
    const active = [...target.modifiers.values()];
    if (active.some(mod => dataOf(mod).hp_lock)) {
      target.currentHp = 1;
      runner.emit("on_hp_lock", { source: sourceId, target: targetId, action_id: actionId });
      return;
    }
    const cocoon = active.find(mod => mod.id !== "MOON_COCOON" && dataOf(mod).moon_cocoon);
    if (cocoon && (!runner.state.moonCocoonUsed || this.#damageFrame && this.#cocoonFrame === this.#damageFrame)) {
      modifiers.remove(target, cocoon.id, "moon_cocoon");
      runner.state.moonCocoonUsed = true;
      this.#cocoonFrame = this.#damageFrame;
      target.currentHp = 1;
      modifiers.apply(target, { raw: { modifier_id: "MOON_COCOON", name: "月茧", modifier_type: "buff",
        duration: 1, dispellable: false, tick_anchor: "owner_turn_start", moon_cocoon: true },
      expressions: new Map() }, this.context.actor(sourceId), {});
      return;
    }
    const revive = active.find(mod => number(dataOf(mod).revive_percent) > 0);
    if (revive) {
      modifiers.remove(target, revive.id, "revive");
      modifiers.remove(target, "MOON_COCOON", "cocoon_release");
      const percent = number(dataOf(revive).revive_percent);
      target.currentHp = (modifiers.panelOf(target).stats.hp ?? 0) * percent;
      runner.emit("on_revive", { target: targetId, percent, hp: target.currentHp, source: revive.sourceId || sourceId });
      return;
    }
    runner.emit("before_actor_exit", { actor: targetId, reason: "death" });
    target.alive = false;
    this.sourceExit(targetId, true);
    runner.exitState(target, "death");
    runner.emit("actor_exit", { actor: targetId, reason: "death" });
    if (sourceId) runner.emit("on_kill", { source: sourceId, target: targetId, action_id: actionId });
    for (const summon of runner.encounter.summons.values()) if (summon.ownerId === targetId) runner.dismiss(summon.id);
  }
}
