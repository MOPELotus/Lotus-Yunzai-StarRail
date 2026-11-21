// Action execution and hit event order follow HSR_Nous 00185dd (MIT).
import { type ActorState, applyToughnessDamage,
  numericConstant, settleDamage, toughnessDamageAmount } from "../combat/index.ts";
import { entries, map, number, numeric, string } from "../compile/library.ts";
import type { CompiledAction, Numbers } from "../compile/types.ts";
import type { ActionOptions, ActionResult, ModifierWithDefinition } from "./contracts.ts";
import type { BattleRunner } from "./runner.ts";
import { isBlast, resolveTargets } from "./targets.ts";

interface ResolvedAction extends CompiledAction {
  readonly toughness: number;
  readonly blastToughness?: number;
}

function variant(action: ResolvedAction, definition: unknown): ResolvedAction {
  const raw = map(definition);
  return {
    ...action, target: string(raw.target_type, action.target),
    damageType: string(raw.damage_type, action.damageType),
    scaling: raw.scaling === undefined ? action.scaling : entries(raw.scaling).map(numeric),
    toughness: number(raw.toughness_dmg, action.toughness),
  };
}

function multiplyScaling(rows: readonly Numbers[], divisor: number): readonly Numbers[] {
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value / divisor])));
}

export function actionPayload(source: ActorState, action: CompiledAction, result: ActionResult) {
  return { actor: source.actor.id, actor_type: source.actor.kind, action_type: action.kind, action_id: action.id,
    target_type: action.target, target: result.target?.actor.id ?? null, sp_consumed: result.spentSkillPoints };
}

export function executeAction(runner: BattleRunner, source: ActorState, action: CompiledAction,
  options: ActionOptions): ActionResult {
  let targets = resolveTargets(runner, source, action, options.forcedTarget);
  if (!targets.members.length) return { target: undefined, spentSkillPoints: 0 };
  const sourceId = source.actor.id;
  const insert = options.insert ?? false;
  const initial = targets.primary;
  if (initial) runner.lastTargetByActor.set(sourceId, initial.actor.id);
  for (const member of targets.members) runner.emit("on_become_target", {
    target: member.actor.id, source: sourceId, action_id: action.id, action_type: action.kind, insert,
  });
  const spentSkillPoints = runner.adjustSkillPoints(
    number(action.raw.skill_point_gain) - number(action.raw.skill_point_cost), "action:" + action.id, sourceId,
  );
  const energy = number(action.raw.energy_gain, runner.encounter.rules.energy[action.kind] ?? 0);
  if (energy) runner.grantEnergy(source, energy, { source: sourceId, actionId: action.id, reason: action.kind });
  runner.applyActionEffects(source, action);
  if (action.raw.cleanse_self) {
    for (const modifier of [...source.modifiers.values()]) {
      if (modifier.type === "debuff" && (modifier as ModifierWithDefinition).dispellable !== false) {
        runner.removeModifier(source, modifier.id, "cleanse");
      }
    }
  }

  if (action.damageType && action.scaling.length) {
    const instancesResource = string(action.raw.instances_from_resource);
    let instances = Math.max(1, Math.trunc(number(action.raw.instances, 1)));
    if (instancesResource) {
      const amount = source.resources.get(instancesResource) ?? 0;
      instances = Math.max(1, number(action.raw.instances_base) + Math.trunc(amount * number(action.raw.instances_per_point, 1)));
      if (number(action.raw.instances_cap) > 0) instances = Math.min(instances, number(action.raw.instances_cap));
    }
    const scalingResource = string(action.raw.scaling_from_resource);
    const scaling = scalingResource
      ? action.scaling.map(row => Object.hasOwn(row, "atk")
        ? { ...row, atk: (row.atk ?? 0) + (source.resources.get(scalingResource) ?? 0) * number(action.raw.scaling_per_point) }
        : row) : action.scaling;
    const clearResource = string(action.raw.consume_all_resource);
    if (clearResource) runner.gainResource(source, clearResource, -(source.resources.get(clearResource) ?? 0));
    const base: ResolvedAction = { ...action, scaling, toughness: number(action.raw.toughness_dmg),
      blastToughness: typeof action.raw.toughness_dmg_blast === "number" ? action.raw.toughness_dmg_blast : undefined };
    let previousTargetType = action.target;
    const variants = Array.isArray(action.raw.instance_variants) ? action.raw.instance_variants : [];
    runner.damageEvent(() => {
      for (let segment = 0; segment < instances; ++segment) {
        const hit = variant(base, variants[action.raw.segment_choice ? 0 : segment]);
        if (segment > 0 && runner.actorTemplate(sourceId).party === "player" && runner.advanceWave()) {
          targets = resolveTargets(runner, source, hit);
        }
        if (segment > 0 && (hit.target === "bounce" || hit.target === "bounce_blast")) {
          targets = resolveTargets(runner, source, hit);
        } else if (hit.target !== previousTargetType) {
          targets = action.raw.segment_confirm || action.raw.segment_choice
            ? resolveTargets(runner, source, hit, targets.primary) : resolveTargets(runner, source, hit);
        }
        if (!targets.members.length) break;
        previousTargetType = hit.target;
        const members = targets.members;
        for (const target of members) {
          if (!target.alive) continue;
          let attack = hit;
          if (isBlast(hit.target) && target !== targets.primary) {
            attack = { ...hit, scaling: hit.scalingBlast.length ? hit.scalingBlast : hit.scaling,
              toughness: hit.blastToughness ?? hit.toughness * numericConstant(runner.encounter.rules, "blast_toughness_ratio") };
          }
          if (action.raw.split === "even") {
            attack = { ...attack, scaling: multiplyScaling(attack.scaling, Math.max(1, members.filter(t => t.alive).length)) };
          }
          resolveHit(runner, source, target, attack, segment, members.map(t => t.actor.id));
        }
      }
    });
  }
  if (!insert) runner.mechanics.tick?.(source, "on_action");
  return { target: initial, spentSkillPoints };
}

function resolveHit(runner: BattleRunner, source: ActorState, target: ActorState, action: ResolvedAction,
  segment: number, hitTargets: readonly string[]): void {
  const { rules } = runner.encounter;
  const template = runner.actorTemplate(source.actor.id);
  const skillLevel = template.skillLevels[action.levelKey] ?? template.skillLevels.ultimate ?? 10;
  const element = action.damageType ?? "physical";
  const common = runner.damageInput(source, target);
  const isElation = action.scaling.some(row => Object.hasOwn(row, "elation"));
  const result = isElation
    ? settleDamage(rules, { ...common, category: "elation", element,
      parameters: { ability_multiplier: action.scaling[Math.min(Math.max(0, skillLevel - 1), action.scaling.length - 1)]?.elation ?? 0,
        punchline_source: runner.poolOverride ?? runner.state.punchline } })
    : settleDamage(rules, { ...common, category: "direct", action, skillLevel, parameters: { target_broken: target.broken } });

  const wasBroken = target.broken;
  const event = { amount: result.value, damage_type: action.damageType,
    source: source.actor.id, target: target.actor.id, action_id: action.id,
    action_type: action.kind, is_critical: Boolean(result.node.isCrit) };
  const changed = runner.waterfall("before_take_damage", event);
  if (changed.cancel) return;
  const amount = number(changed.amount, result.value);
  const overflow = runner.mechanics.absorbHit?.(target, amount, source) ?? amount;
  target.currentHp -= overflow;
  if (overflow > 0) runner.emit("on_hp_decrease", {
    amount: overflow, source: source.actor.id, reason: "hit", target: target.actor.id,
    damage_type: action.damageType ?? "", action_type: action.kind, is_critical: event.is_critical,
  });
  runner.state.recordDamage(source.actor.id, amount);
  if (runner.actorTemplate(target.actor.id).party === "enemy") {
    applyToughness(runner, source, target, action, wasBroken);
  }
  runner.checkDeath(target, source.actor.id, action.id);
  if (target.alive && number(action.raw.energy_grant) > 0) {
    const ownerId = runner.actorTemplate(target.actor.id).ownerId;
    const recipient = (ownerId ? runner.state.actors.get(ownerId) : undefined) ?? target;
    if (recipient.alive && runner.actorTemplate(recipient.actor.id).party === "player") {
      runner.grantEnergy(recipient, number(action.raw.energy_grant),
        { source: source.actor.id, actionId: action.id, reason: "being_hit" });
    }
  }
  runner.emit("after_being_hit", { ...event, amount, absorbed: amount - overflow, seg_index: segment,
    actor_type: template.kind, hit_targets: hitTargets, primary_target: hitTargets[0] ?? "" });
}

export function applyHitToughness(runner: BattleRunner, source: ActorState, target: ActorState, action: CompiledAction,
  wasBroken: boolean, sourceActionId = action.id): void {
  applyToughness(runner, source, target, { ...action, toughness: number(action.raw.toughness_dmg) }, wasBroken, sourceActionId);
}

function applyToughness(runner: BattleRunner, source: ActorState, target: ActorState, action: ResolvedAction,
  wasBroken: boolean, sourceActionId = action.id): void {
  if (action.toughness <= 0 || target.barsExhausted && !wasBroken) return;
  const { rules } = runner.encounter;
  const element = action.damageType ?? "";
  const scopes = Array.isArray(action.raw.toughness_scope) ? action.raw.toughness_scope.map(s => String(s).toLowerCase()) : [];
  const weak = runner.panelOf(target).weakness ?? target.actor.weakness ?? [];
  const canReduce = (action.raw.toughness_scope === "all" || weak.includes(element) || scopes.includes(element))
    && ![...target.modifiers.values()].some(m => (m as ModifierWithDefinition).model?.raw.toughness_lock);
  const scoped = runner.mechanics.scopedBoost?.(source, {
    action_type: action.kind, damage_type: element, target_broken: false, target_controlled: false,
  }, key => key === "break_efficiency_boost", target) ?? 0;
  const nominal = toughnessDamageAmount(rules, runner.panelOf(source), action.toughness, scoped);
  if (!target.barsExhausted) {
    const result = applyToughnessDamage(target, nominal, element, canReduce);
    if (result.value > 0) runner.emit("on_toughness_damage", {
      amount: result.value, source: source.actor.id, target: target.actor.id, bar_index: target.barIndex,
    });
    if (target.toughness <= 0 && !target.barsExhausted) triggerBreak(runner, source, target, action);
  }
  if (!wasBroken) return;
  const afterBreakScoped = runner.mechanics.scopedBoost?.(source, {
    action_type: action.kind, damage_type: element, target_broken: false, target_controlled: false,
  }, key => key === "break_efficiency_boost", target) ?? 0;
  const effectiveToughness = toughnessDamageAmount(rules, runner.panelOf(source), action.toughness, afterBreakScoped);
  const hit = settleDamage(rules, { ...runner.damageInput(source, target), category: "super_break",
    element: element || "physical", parameters: { effective_toughness: effectiveToughness } });
  if (hit.value <= 0) return;
  target.currentHp -= hit.value;
  runner.emit("on_super_break", { source: source.actor.id, target: target.actor.id, action_id: sourceActionId,
    amount: hit.value, element: element || "physical" });
  runner.emit("on_hp_decrease", { amount: hit.value, source: source.actor.id, reason: "break", target: target.actor.id });
  runner.state.recordDamage(source.actor.id, hit.value);
  runner.checkDeath(target, source.actor.id, sourceActionId);
}

export function triggerBreak(runner: BattleRunner, source: ActorState, target: ActorState, action: CompiledAction): void {
  const { rules } = runner.encounter;
  const element = action.damageType ?? "physical";
  const declared = target.actor.toughnessBars ?? [];
  const index = target.barIndex;
  const stateBreak = index === declared.length;
  if (stateBreak) target.broken = true;
  runner.emit("on_break", { source: source.actor.id, target: target.actor.id, element, bar_index: index });
  const result = settleDamage(rules, { ...runner.damageInput(source, target), category: "break", element });
  target.currentHp -= result.value;
  if (result.value > 0) runner.emit("on_hp_decrease", {
    amount: result.value, source: source.actor.id, reason: "break", target: target.actor.id,
  });
  runner.state.recordDamage(source.actor.id, result.value);
  runner.checkDeath(target, source.actor.id, action.id);
  if (stateBreak) {
    runner.mechanics.onBreak?.(source, target, element);
    runner.scheduler.delayAction(target.actor.id, number(rules.breakEffects[element]?.delay));
  }
  const following = [...declared, ...target.addedBars][index];
  target.barIndex = index + 1;
  if (following !== undefined) target.toughness = following;
}
