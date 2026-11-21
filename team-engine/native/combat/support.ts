// Shared support calculations follow HSR_Nous pipeline.py at 00185dd (MIT).
import { evaluate } from "../rules/expression.ts";
import type { Rulebook } from "../rules/rulebook.ts";
import { basePanel, type EffectivePanel } from "./settlement.ts";
import { type ActorState, type Settlement, numericConstant } from "./state.ts";

type Context = Readonly<Record<string, number>>;
type PanelLookup = (actor: ActorState) => EffectivePanel;

function zone(book: Rulebook, key: string, context: Context): number {
  const expr = book.zones[key];
  if (!expr) throw new Error("Missing combat zone " + key);
  return evaluate<number>(expr, { context, trace: false }).value;
}

function formula(book: Rulebook, key: string, context: Context): number {
  const expr = book.formulas[key];
  if (!expr) throw new Error("Missing combat formula " + key);
  return evaluate<number>(expr, { context, trace: false }).value;
}

export function hitChance(book: Rulebook, source: EffectivePanel, target: EffectivePanel,
  baseChance: number, effectResPen = 0): number {
  return zone(book, "ehr_multi", {
    base_chance: baseChance, effect_hit: source.stats.effect_hit ?? 0, target_effect_res: target.stats.effect_res ?? 0,
    effect_res_pen: effectResPen, type_res: 0,
  });
}

export function toughnessDamageAmount(book: Rulebook, source: EffectivePanel | undefined, amount: number,
  scopedBreakEfficiency = 0): number {
  return formula(book, "toughness_damage", {
    base_toughness: amount,
    break_efficiency_boost: (source?.stats.break_efficiency_boost ?? 0) + scopedBreakEfficiency,
    weakness_break_efficiency_boost: source?.stats.weakness_break_efficiency_boost ?? 0,
    fixed_toughness_dmg: 0,
  });
}

export function shieldValue(book: Rulebook, source: EffectivePanel | undefined,
  { flat = 0, scaling = {} }: { flat?: number; scaling?: Context }): number {
  for (const key of Object.keys(scaling)) {
    if (!["def", "def_", "hp", "atk"].includes(key)) throw new Error("Unknown shield scaling stat " + key);
  }
  const stats = source?.stats ?? {};
  return formula(book, "shield", {
    def_scaling: scaling.def ?? scaling.def_ ?? 0, defense: stats.def_ ?? 0,
    hp_scaling: scaling.hp ?? 0, hp: stats.hp ?? 0, atk_scaling: scaling.atk ?? 0, atk: stats.atk ?? 0,
    flat_shield: flat, shield_bonus: stats.shield_bonus ?? 0,
  });
}

export interface HealOptions {
  readonly flat?: number;
  readonly attackScaling?: number;
  readonly hpScaling?: number;
  readonly panelOf?: PanelLookup;
  readonly healBonusSource?: ActorState;
  readonly scopedHealBonus?: (source: ActorState, targetHpRatio: number, target: ActorState) => number;
}

export function heal(book: Rulebook, source: ActorState, target: ActorState, options: HealOptions = {}): Settlement {
  const { flat = 0, attackScaling = 0, hpScaling = 0, panelOf = basePanel, healBonusSource = source } = options;
  const attacker = panelOf(source).stats;
  const recipient = panelOf(target).stats;
  const provider = healBonusSource === source ? attacker : panelOf(healBonusSource).stats;
  const maxHp = recipient.hp ?? 0;
  const scoped = options.scopedHealBonus?.(healBonusSource, maxHp > 0 ? target.currentHp / maxHp : 0, target) ?? 0;
  const expr = book.formulas.heal;
  if (!expr) throw new Error("Missing combat formula heal");
  const result = evaluate<number>(expr, { context: {
    atk_scaling: attackScaling, atk: attacker.atk ?? 0, hp_scaling: hpScaling, hp: attacker.hp ?? 0,
    flat_heal: flat, heal_bonus: (provider.heal_bonus ?? 0) + scoped, incoming_heal: recipient.incoming_heal ?? 0,
  }});
  const reduction = Math.min(numericConstant(book, "recoverable_hp_reduction_cap"),
    Math.max(0, recipient.recoverable_hp_reduction ?? 0));
  const previousHp = target.currentHp;
  const recovered = Math.min(maxHp, maxHp * (1 - reduction), previousHp + result.value);
  target.currentHp = Math.max(previousHp, recovered);
  return { value: result.value, node: { formula: "heal", amount: flat,
    healBonusMulti: result.trace.children?.[1]?.value, actualAmount: Math.max(0, recovered - previousHp) } };
}

export function dotSnapshot(book: Rulebook, source: ActorState, target: ActorState, element: string,
  ratio: number | undefined, baseChance = 1, panelOf: PanelLookup = basePanel): Record<string, number> {
  const attacker = panelOf(source);
  const targetPanel = panelOf(target);
  const stats = attacker.stats;
  const bonus = attacker.damageBonus ?? {};
  const snapshot = {
    source_level: source.actor.level,
    def_pen: stats.def_pen ?? 0,
    res_pen: stats.res_pen ?? 0,
    dmg_boost_multi: zone(book, "dmg_boost_multi", {
      all_dmg_bonus: bonus.all ?? 0, elemental_dmg_bonus: element ? bonus[element] ?? 0 : 0,
      type_dmg_bonus: bonus.dot_dmg_boost ?? 0,
    }),
    ind_dmg_boost_multi: zone(book, "ind_dmg_boost_multi", { ind_dmg_bonus: bonus.ind_dmg_boost ?? 0 }),
    final_dmg_multi: zone(book, "final_dmg_multi", { final_dmg_bonus: bonus.final_dmg_boost ?? 0 }),
    weaken_multi: zone(book, "weaken_multi", { weaken: bonus.weaken ?? 0 }),
    ehr_multi: hitChance(book, attacker, targetPanel, baseChance, stats.effect_res_pen ?? 0),
    be_multi: zone(book, "be_multi", { break_effect: stats.break_effect ?? 0 }),
  };
  if (ratio === undefined) return snapshot;
  return {
    ...snapshot,
    ability_multiplier: zone(book, "ability_base", {
      atk_scaling: ratio, hp_scaling: 0, def_scaling: 0, atk: stats.atk ?? 0, hp: 0, def_: 0, base_dmg_add: 0,
    }),
  };
}
