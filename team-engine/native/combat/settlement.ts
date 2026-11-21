// Settlement follows HSR_Nous pipeline.py and rulebook.yaml at 00185dd (MIT).
import { evaluate, type EvaluateOptions } from "../rules/expression.ts";
import type { Rulebook, RuleValues } from "../rules/rulebook.ts";
import { type ActorState, type Settlement, isEnemy, numericConstant } from "./state.ts";

type Values = Readonly<Record<string, unknown>>;
type StatValues = Readonly<Record<string, number>>;
type Rng = NonNullable<EvaluateOptions["rng"]>;

export interface EffectivePanel {
  readonly stats: StatValues;
  readonly damageBonus?: StatValues;
  readonly weakness?: readonly string[];
}

export interface CombatAction {
  readonly kind: string;
  readonly damageType?: string;
  readonly scaling?: readonly StatValues[];
}

export interface DamageOverTime {
  readonly id: string;
  readonly element: string;
  readonly ratio: number;
  readonly sourceAtk?: number;
  readonly source?: ActorState;
  readonly stacks?: number;
  readonly snapshot?: StatValues;
  readonly liveRatio?: { source: string; value: () => number };
}

export interface DamageInput {
  readonly category: string;
  readonly source: ActorState;
  readonly target: ActorState;
  readonly mode?: "roll" | "expected";
  readonly action?: CombatAction;
  readonly skillLevel?: number;
  readonly element?: string;
  readonly modifier?: DamageOverTime;
  readonly parameters?: Values;
  readonly rng?: Rng;
  readonly panelOf?: (actor: ActorState) => EffectivePanel;
  readonly scopedBoost?: (
    actor: ActorState, event: Values, accept: (stat: string) => boolean, target: ActorState,
  ) => number;
}

const OMIT = Symbol("omitted settlement field");

function record(value: unknown): Values {
  return value as Values ?? {};
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid settlement text field " + String(value));
  return value;
}

function number(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  throw new Error("Invalid settlement numeric field " + String(value));
}

function strings(value: unknown): readonly string[] {
  return value as readonly string[] ?? [];
}

export function basePanel(actor: ActorState): EffectivePanel {
  return {
    stats: { crit_rate: 0.05, crit_dmg: 0.5, energy_regen: 1, ...actor.actor.stats },
    damageBonus: actor.actor.damageBonus,
    weakness: actor.actor.weakness,
  };
}

export function settleDamage(book: Rulebook, input: DamageInput): Settlement {
  const route = book.route[input.category];
  const spec = route?.settle;
  if (!spec) throw new Error("Unsupported damage category " + input.category);
  const formulaName = route[input.mode ?? "expected"];
  const formula = book.formulas[formulaName];
  const idents = book.formulaIdents[formulaName];
  if (!formula || !idents) throw new Error("Missing combat formula " + formulaName);
  const deductsHp = Boolean(spec.hp_deduct);
  const output: Record<string, unknown> = { formula: spec.node_formula };
  const { action, source, target, modifier } = input;
  const panelOf = input.panelOf ?? basePanel;
  let attackerPanel: EffectivePanel | undefined;
  let targetPanel: EffectivePanel | undefined;
  const panel = (side: string) => side === "attacker"
    ? attackerPanel ??= panelOf(source) : targetPanel ??= panelOf(target);
  const parameters = input.parameters ?? {};
  const scopedZones = new Set(strings(spec.scoped));
  const snapshot = modifier?.snapshot ?? {};
  const dotFamily = spec.family === "dot";
  const level = input.skillLevel ?? 1;
  const scaling = action?.scaling;
  const row = scaling?.[Math.min(Math.max(level - 1, 0), scaling.length - 1)] ?? {};
  const bleedRank = isEnemy(target.actor) ? "elite" : "normal";
  let value = 0;
  let isCrit = false;

  let event: Values | undefined;
  const hitEvent = (): Values => {
    if (event) return event;
    const desc = record(spec.event);
    event = Object.fromEntries(strings(desc.fields).map(field => {
      const token = desc[field];
      switch (field) {
        case "action_type": return [field, token === "action" ? action?.kind : token];
        case "decl_action_type": return [field, action?.kind ?? null];
        case "damage_type": {
          const element = token === "action" ? action?.damageType
            : token === "element" ? input.element
            : token === "dot_element" ? modifier?.element : token;
          return [field, element ?? ""];
        }
        case "target_broken": return [field, token === "const" || target.broken];
        case "target_controlled": return [field, [...target.modifiers.values()].some(mod => mod.controlKind)];
        case "target_control_kinds": return [field, [...target.modifiers.values()].flatMap(mod => mod.controlKind ? [mod.controlKind] : [])];
        case "target_hp_ratio": {
          const maximum = panel("target").stats.hp ?? 0;
          return [field, maximum ? target.currentHp / maximum : 0];
        }
        default: throw new Error("Unknown combat event field " + field);
      }
    }));
    return event;
  };

  function scoped(desc: Values): number {
    const carrier = desc.from === "target" ? target : dotFamily ? modifier?.source : source;
    if (!carrier || !input.scopedBoost) return 0;
    const stats = strings(desc.stats);
    const extras = strings(desc.extras);
    const accept = desc.stats !== undefined ? (key: string) => stats.includes(key)
      : (key: string) => key.startsWith(text(desc.prefix ?? "")) || extras.includes(key);
    return input.scopedBoost(carrier, hitEvent(), accept, target);
  }

  function read(desc: Values): unknown {
    if (typeof desc.override_param === "string") {
      const override = parameters[desc.override_param];
      if (override !== undefined && override !== null) return number(override);
    }
    if (desc.from === "attacker" || desc.from === "target") {
      const effective = panel(desc.from);
      const stats = effective.stats;
      const bonus = effective.damageBonus ?? {};
      if (desc.resolve === "target_def") {
        const defense = stats.def_ ?? 0;
        const overridden = [...target.modifiers.values()].some(mod => Object.hasOwn(mod.overrideEffects ?? {}, "def_"));
        return defense > 0 || overridden ? defense : numericConstant(book, "default_target_def");
      }
      if (desc.resolve === "base_res") {
        const element = text(hitEvent().damage_type);
        const weak = element && (effective.weakness ?? target.actor.weakness)?.includes(element);
        const resistance = weak ? 0 : target.actor.resistance?.[element] ?? numericConstant(book, "non_weakness_res");
        return element ? resistance + (stats["res_" + element] ?? 0) : resistance;
      }
      if (desc.resolve !== undefined) throw new Error("Unknown combat resolver " + String(desc.resolve));
      if (desc.bucket !== undefined) return bonus[text(desc.bucket)] ?? 0;
      if (desc.bucket_element) return bonus[text(hitEvent().damage_type)] ?? 0;
      if (desc.bucket_action_type) return bonus[text(hitEvent().action_type ?? "") + "_dmg_boost"] ?? 0;
      return stats[text(desc.stat)] ?? 0;
    }
    switch (desc.from) {
      case "attacker_side": {
        const key = text(desc.key);
        if (key === "level") return dotFamily ? snapshot.source_level ?? target.actor.level : source.actor.level;
        return dotFamily ? snapshot[key] ?? 0 : panel("attacker").stats[key] ?? 0;
      }
      case "snapshot": return snapshot[text(desc.key)] ?? desc.default ?? 1;
      case "parameter": {
        const key = text(desc.key);
        const parameter = Object.hasOwn(parameters, key) ? parameters[key] : desc.default;
        return desc.coerce === "float" ? number(parameter) : parameter;
      }
      case "constant": return numericConstant(book, text(desc.key));
      case "literal": return desc.value;
      case "modifier": {
        if (!modifier) throw new Error("Damage category needs a DoT modifier");
        if (desc.field === "dot_element") return modifier.element;
        if (desc.field === "dot_ratio") return modifier.ratio;
        throw new Error("Unknown DoT modifier field " + String(desc.field));
      }
      case "action_scaling": {
        const key = text(desc.key);
        return key === "def_" ? row.def_ ?? row.def ?? 0 : row[key] ?? 0;
      }
      case "break_effect_table": {
        const effect = book.breakEffects[input.element ?? ""];
        if (!effect) throw new Error("Unknown break element " + String(input.element));
        return effect[text(desc.key)];
      }
      case "bleed_coeff": return record(book.breakEffects.physical?.bleed_coeff)[bleedRank] ?? 0;
      case "target_raw": return target.actor.stats[text(desc.key)] ?? 0;
      case "broken_state": return Number(desc.mode === "const" || target.broken
        || (desc.mode === "or_param" && Boolean(parameters.target_broken)));
      case "value": return value;
      case "bleed_rank": return bleedRank;
      case "dot_tick_base": {
        if (!modifier) throw new Error("Damage category needs a DoT modifier");
        if (modifier.liveRatio) return modifier.liveRatio.value();
        if (modifier.element === "physical" && modifier.id.startsWith("BRK_DOT_")) {
          return zone("bleed_base_multi") * modifier.ratio;
        }
        const attack = snapshot.ability_multiplier ?? (modifier.sourceAtk ?? 0) * modifier.ratio;
        return attack * Math.max(1, Math.trunc(modifier.stacks ?? 1));
      }
      case "dot_ratio_expr_source": return modifier?.liveRatio?.source ?? OMIT;
      default: throw new Error("Unknown combat input " + String(desc.from));
    }
  }

  function zone(name: string): number {
    const expr = book.zones[name];
    const decl = book.zoneDecls[name];
    if (!expr || !decl) throw new Error("Unknown combat zone " + name);
    const override = record(record(decl.by_type)[input.category]).read;
    const active = scopedZones.has(name);
    let result: number;
    if (override) {
      result = number(read({ key: name, ...record(override) }));
    } else {
      const context: Record<string, unknown> = {};
      for (const [id, original] of Object.entries(record(decl.inputs))) {
        const { by_type, ...fields } = record(original);
        const merged = { ...fields, ...record(record(by_type)[input.category]) };
        let item = read(merged);
        if (active && merged.scoped) item = number(item) + scoped(record(merged.scoped));
        context[id] = merged.wrap === "list" ? [item] : item;
      }
      const outcome = evaluate<number>(expr, { context, rng: input.rng, trace: Boolean(decl.roll_check) });
      result = outcome.value;
      if (decl.roll_check) isCrit = outcome.trace.kind === "IfExp"
        ? Boolean(outcome.trace.children?.[0]?.value) : result !== 1;
    }
    if (decl.scoped_post && active) result += scoped(record(decl.scoped_post));
    return result;
  }

  function bound(bind: RuleValues): unknown {
    if (typeof bind.zone !== "string") return read(bind);
    const override = typeof bind.override_param === "string" ? parameters[bind.override_param] : undefined;
    return override === undefined || override === null ? zone(bind.zone) : number(override);
  }

  function finish(): Settlement {
    const fixedBars = Math.max(0, ...[...target.modifiers.values()].map(mod => mod.fixedHpBars ?? 0));
    const resolved = fixedBars > 0 ? (panel("target").stats.hp ?? 0) / fixedBars : value;
    if (deductsHp) {
      target.currentHp -= value;
      if (fixedBars > 0) target.currentHp += value - resolved;
    }
    return { value: resolved, node: output };
  }

  const gate = book.settleGates[input.category];
  if (gate) {
    const gateSpec = record(spec.gate);
    const context = Object.fromEntries(Object.entries(record(gateSpec.ctx)).map(([key, desc]) => [key, read(record(desc))]));
    if (evaluate<boolean>(gate, { context, rng: input.rng, trace: false }).value) {
      for (const [key, item] of Object.entries(record(gateSpec.node))) {
        output[key] = typeof item === "string" ? context[item] : item;
      }
      return finish();
    }
  }

  const context: Record<string, unknown> = {};
  const binds = record(spec.bind);
  const drop = new Set(strings(spec.node_drop));
  // Eager first-occurrence order is also the reference engine's RNG order.
  for (const ident of idents) {
    const bind = record(binds[ident]);
    const isBound = Object.hasOwn(binds, ident);
    const item = isBound ? bound(bind) : zone(ident);
    context[ident] = item;
    const key = isBound ? bind.node : book.zoneDecls[ident]?.node;
    if (typeof key === "string" && !drop.has(ident)) output[key] = item;
  }
  value = evaluate<number>(formula, { context, rng: input.rng, trace: false }).value;
  for (const desc of spec.node_extra as readonly Values[] ?? []) {
    const item = read(desc);
    if (item !== OMIT) output[text(desc.node)] = item;
  }
  if (spec.is_crit === "crit" || spec.is_crit === "literal_false") {
    output.isCrit = spec.is_crit === "crit" && isCrit;
  }
  return finish();
}
