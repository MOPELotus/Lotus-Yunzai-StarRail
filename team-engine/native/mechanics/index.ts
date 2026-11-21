import type { ActorState } from "../combat/index.ts";
import { entries, number, string } from "../compile/library.ts";
import type { Mechanic } from "../compile/types.ts";
import type { MechanicFactory } from "../runner/contracts.ts";
import { panelResidual, type PanelCalibration } from "../worker-build.ts";
import { HookContext } from "./context.ts";
import { HookEffects } from "./effects.ts";
import { HookDispatch } from "./events.ts";
import { ModifierBook, subMechanic } from "./modifiers.ts";
import { ResourceBook } from "./resources.ts";

export interface MechanicsOptions {
  readonly panelCalibration?: ReadonlyMap<string, PanelCalibration>;
  readonly diagnose?: (message: string) => void;
}

/** Installs the native hook runtime on the runner without mutating the compiled encounter. */
export function nativeMechanics({ panelCalibration, diagnose }: MechanicsOptions = {}): MechanicFactory {
  return runner => {
    const rulebook = runner.encounter.rules;
    const warn = (message: string) => diagnose?.(message);
    const model = (raw: Mechanic["raw"]): Mechanic => ({ raw, expressions: new Map() });
    const resources = new ResourceBook({
      state: runner.state, template: id => context.template(id), emit: (event, payload) => runner.emit(event, payload),
      waterfall: (event, payload) => runner.waterfall(event, { ...payload }), punchlineOverride: () => runner.poolOverride,
    });
    const modifiers: ModifierBook = new ModifierBook({
      rulebook, mode: runner.mode, rng: () => context.rng(),
      actors: () => runner.state.actors.values(), template: id => context.template(id),
      actor: id => context.actor(id), emit: (event, payload) => runner.emit(event, payload),
      checkDeath: (actor, source, action) => runner.checkDeath(actor, source, action),
      speedOf: id => runner.scheduler.speedOf(id), changeSpeed: (id, speed) => runner.scheduler.changeSpeed(id, speed),
      evaluate: (expression, actor, payload, scope) => context.evaluate(expression, actor, payload, scope),
      evaluateZone: (zone, context) => {
        const expression = rulebook.zones[zone];
        if (!expression) throw new Error("缺少战斗属性公式 " + zone);
        return runner.encounter.expr.evaluate<number>(expression, { context, trace: false });
      },
      runModifierEffect: (owner, effect, payload) => effects.effect(effect, owner, payload),
      warn,
    });
    const context: HookContext = new HookContext(runner, modifiers, resources);
    const effects: HookEffects = new HookEffects(runner, context, modifiers, resources);
    const bus = new HookDispatch<ActorState>(runner.encounter.hooks, {
      owner: id => context.actor(id), warn,
      condition(hook, actor, payload) {
        if (!hook.condition) return true;
        try { return Boolean(context.evaluate(hook.condition, actor, payload, { readonlyRoll: true })); }
        catch (error) { warn(hook.source + " 的战斗触发条件无法计算，" + String(error)); return false; }
      },
      filter(hook, actor, payload, target) {
        if (!hook.targetFilter) return true;
        try { return Boolean(context.evaluate(hook.targetFilter, actor, payload, { extra: { it: target } })); }
        catch (error) { warn(hook.source + " 的累积目标无法计算，" + String(error)); return false; }
      },
      effect(hook, actor, payload, waterfall) { return effects.chain(hook.effects, actor, payload, waterfall); },
    });
    const baseModifiers = (actor: ActorState) => {
      const template = runner.actorTemplate(actor.actor.id);
      resources.initialize(actor);
      for (const status of template.modifiers) modifiers.apply(actor, status, undefined, {});
    };
    return {
      prepareInitial() {
        for (const actor of runner.state.actors.values()) baseModifiers(actor);
        for (const [id, calibration] of panelCalibration ?? []) {
          const actor = runner.state.actors.get(id);
          if (!actor) continue;
          const panel = modifiers.panelOf(actor, true, true);
          modifiers.apply(actor, model({
            modifier_id: "LOTUS_PANEL_RESIDUAL", name: "本人面板校准", dispellable: false,
            stat_effects: panelResidual(runner.actorTemplate(id), { stats: panel.stats, damageBonus: panel.damageBonus ?? {} }, calibration),
          }), undefined, {});
        }
        modifiers.syncSpeed();
      },
      onActorSpawn: (actor) => {
        modifiers.clearShields(actor);
        baseModifiers(actor);
      },
      onActorLeave: actor => effects.sourceExit(actor.actor.id),
      onEvent(event, payload) {
        bus.emit(event, payload);
        if (event === "on_hp_decrease" || event === "on_hp_increase") modifiers.syncConditionalSpeed();
      },
      waterfall: (event, payload) => ({ ...bus.waterfall(event, payload) }),
      panelOf: actor => modifiers.panelOf(actor),
      scopedBoost: modifiers.scopedBoost,
      tick(actor, anchor) {
        modifiers.tick(actor, anchor);
        if (anchor === "owner_turn_end") resources.tickBanger(actor);
      },
      tickDots: actor => effects.tickDots(actor),
      applyActionEffects(source, action) {
        const payload = { actor: source.actor.id, action_id: action.id, action_type: action.kind };
        for (const [n, definition] of entries(action.raw.apply_modifiers).entries()) {
          const targets = context.targets(definition.target ?? "self", source, payload);
          const data = subMechanic(action, "apply_modifiers." + n);
          for (const target of targets) effects.applyModifier(target, data, source, payload, number(definition.apply_chance, 1));
        }
        if (action.raw.cleanse_self) modifiers.cleanse(source, "penalty", Infinity);
      },
      applyModifier: (target, definition, source) => { effects.applyModifier(target, definition, source); },
      removeModifier: (actor, id, reason) => modifiers.remove(actor, id, reason),
      absorbHit(target, amount, source) {
        const barrier = [...target.modifiers.values()].find(status => (status as { model?: Mechanic }).model?.raw.block_damage);
        if (barrier) {
          modifiers.remove(target, barrier.id, "consumed");
          return 0;
        }
        return modifiers.absorb(target, amount, source.actor.id);
      },
      checkDeath: (target, sourceId, actionId) => effects.checkDeath(target, sourceId, actionId),
      actionAvailability(actor, action) {
        const expression = action.expressions.get("available_if");
        if (!expression) return true;
        try { return Boolean(context.evaluate(expression, actor, {})); }
        catch (error) { warn(action.name + " 的可用条件无法计算，" + String(error)); return false; }
      },
      gainResource: (actor, id, amount, sourceId) => { resources.gain(actor, id, amount, sourceId); },
      onDamageEvent: fn => context.frame(() => effects.damageFrame(fn)),
      onBreak(source, target, element) {
        const rule = rulebook.breakEffects[element];
        if (!rule) return;
        const control = string(rule.control);
        if (control) modifiers.apply(target, model({
          modifier_id: "BRK_" + control.toUpperCase(), modifier_type: "control", debuff_kind: "control",
          name: { freeze: "冻结", entangle: "纠缠", imprison: "禁锢" }[control] ?? control,
          duration: number(rule.control_duration), control_kind: control,
        }), source, {});
        const ratio = number(rule.dot_ratio, number(rule.bleed_ratio));
        if (ratio > 0) modifiers.apply(target, model({
          modifier_id: "BRK_DOT_" + element, modifier_type: "dot", debuff_kind: "dot",
          name: { physical: "裂伤", fire: "灼烧", thunder: "触电", wind: "风化", quantum: "纠缠" }[element] ?? "持续伤害",
          duration: number(rule.dot_duration), dot_element: element, dot_ratio: ratio,
        }), source, {});
      },
    };
  };
}
