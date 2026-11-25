import { createTranslator as createTextTranslator } from "../../../../../packages/i18n/index.ts";
import messageCatalog from "../../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
// HSR Nous build/actor/stage compilation, adapted from the MIT-licensed pinned engine.
import { getRulebook, type RuleValues } from "../rules/rulebook.ts";
import { bindRuleExpression, compileTemplateExpressions, effectiveSkillLevels, ExpressionCompiler, skillParameterTables,
  type ExpressionBinding } from "../rules/schema.ts";
import { entries, map, number, numeric, string, strings, templateLibrary, type TemplateLibrary } from "./library.ts";
import type { ActorBuild, CompiledActor, CompiledEncounter, CompiledStats, EncounterBuild,
  InitialModifier, Mechanic, Numbers } from "./types.ts";

const defaultStats: CompiledStats = {
  hp: 0, atk: 0, def_: 0, spd: 100, crit_rate: 0.05, crit_dmg: 0.5, break_effect: 0,
  elation: 0, break_efficiency_boost: 0, weakness_break_efficiency_boost: 0, effect_hit: 0,
  effect_res: 0, def_pen: 0, res_pen: 0, vulnerability: 0, max_energy: 100, energy_regen: 1,
  heal_bonus: 0, shield_bonus: 0, taunt: 100, max_toughness: 0,
};
const pathAliases: Readonly<Record<string, string>> = {
  warrior: "destruction", mage: "erudition", rogue: "hunt", shaman: "harmony", warlock: "nihility",
  knight: "preservation", priest: "abundance", memory: "remembrance", the_hunt: "hunt", nihilism: "nihility",
};
export function canonicalPath(value: unknown): string {
  const key = string(value).toLowerCase();
  return pathAliases[key] ?? key;
}
const defaultPolicy: readonly RuleValues[] = [
  { condition: "skill_points > 0", action: "skill", priority: 50 },
  { condition: "true", action: "basic", priority: 0 },
];
const elementalAffixes = new Set(["physical_dmg", "fire_dmg", "ice_dmg", "thunder_dmg",
  "wind_dmg", "quantum_dmg", "imaginary_dmg"]);
const add = (dest: Record<string, number>, key: string, value: number) => { dest[key] = (dest[key] ?? 0) + value; };

export async function compileEncounter(build: EncounterBuild, library: TemplateLibrary = templateLibrary): Promise<CompiledEncounter> {
  const rules = await getRulebook();
  const expr = new ExpressionCompiler();
  const binding = { constants: rules.constants };
  const caveats: RuleValues[] = [];
  const summons = new Map<string, CompiledActor>();
  const actionsByActor = new Map<string, CompiledActor["actions"]>();
  const enemyRules = new Map<string, Mechanic>();
  const hooks: CompiledEncounter["hooks"][number][] = [];
  const mechanic = (raw: RuleValues, context: ExpressionBinding = binding): Mechanic => ({
    raw, expressions: new Map(compileTemplateExpressions(raw, context, expr)
      .map(({ path, expression }) => [path.join("."), expression])),
  });
  const resetEvents: Readonly<Record<string, string | null>> = {
    per_turn: "on_turn_start", per_wave: "on_wave_start", per_action: "on_action",
    once_per_battle: null, per_battle: null,
  };
  const makeHooks = (raw: unknown, ownerId: string, source: string, context: ExpressionBinding,
    declarations: Record<string, Mechanic> = {}) => {
    const hookModel = (hook: RuleValues) => {
      const model = mechanic(hook, context);
      return { ...model, ownerId, source, event: string(hook.event),
        accumulated: hook.accumulated === true, flushTriggers: strings(hook.flush_triggers),
        targetFilter: model.expressions.get("target_filter"), condition: model.expressions.get("condition"),
        effects: entries(hook.effects).map(effect => mechanic(effect, context)),
      };
    };
    return entries(raw).flatMap((hook, index) => {
      if (hook.trigger_limit == null) return [hookModel(hook)];
      if (hook.event === "on_battle_start") throw new TypeError(source + $t("team-engine.native.compile.encounter.text_9eeccfaa82"));
      let count = 1, window = "per_turn", resetOn: string | undefined;
      for (const [key, value] of Object.entries(map(hook.trigger_limit))) {
        if (key === "count") count = Number(value);
        else if (key === "reset_on") resetOn = string(value);
        else {
          if (!Object.hasOwn(resetEvents, key)) throw new TypeError(source + $t("team-engine.native.compile.encounter.text_f86d605b6e"));
          window = key;
          count = value == null ? 1 : Number(value);
        }
      }
      if (!Number.isInteger(count) || count < 1) throw new TypeError(source + $t("team-engine.native.compile.encounter.text_1d2b3b6500"));
      const hash = new Bun.CryptoHasher("md5").update(ownerId + "/" + source + "/" + index).digest("hex");
      const id = "_tl_" + hash.slice(0, 10);
      declarations[id] = mechanic({ max: count, current: 0, overflow_mode: "none" }, context);
      const gate = "res_" + id + " > 0";
      const reset = resetOn ?? resetEvents[window];
      const refill = { effect_type: "set_resource", resource_id: id, amount: count };
      return [
        hookModel({ event: "on_battle_start", effects: [refill] }),
        ...(reset ? [hookModel({ event: reset, effects: [refill] })] : []),
        hookModel({ ...hook, trigger_limit: undefined,
          condition: hook.condition ? "(" + string(hook.condition) + ") and (" + gate + ")" : gate,
          effects: [...entries(hook.effects), { effect_type: "gain_resource", resource_id: id, amount: -1 }],
        }),
      ];
    });
  };
  const initial = (id: string, name: string, effects: Numbers): InitialModifier => ({
    ...mechanic({ modifier_id: id, name, modifier_type: "buff", duration: 0,
      dispellable: false, stat_effects: effects }), id, name, statEffects: effects,
  });
  function appendStats(modifiers: InitialModifier[], id: string, name: string, value: unknown) {
    const effects = numeric(value);
    if (Object.keys(effects).length) modifiers.push(initial(id, name, effects));
  }
  function appendCaveats(raw: RuleValues, actor: string, ref: string) {
    caveats.push(...entries(raw.caveats).map(item => ({ actor, source: "template", ref, ...item })));
  }
  function resources(raw: RuleValues, context: ExpressionBinding, ownerId: string, source: string) {
    const declarations: Record<string, Mechanic> = {};
    const refundHooks: ReturnType<typeof makeHooks> = [];
    for (const [id, value] of Object.entries(map(raw.custom_resources))) {
      const data = map(value);
      if (id === "energy" || (data.max !== undefined && data.max !== "inf" && typeof data.max !== "number")) {
        throw new TypeError(source + $t("team-engine.native.compile.encounter.text_390cd4d8cf") + id + $t("team-engine.native.compile.encounter.text_5498465824"));
      }
      const spec = { ...data, max: data.max ?? "inf", current: data.current ?? 0,
        overflow_mode: data.overflow_mode ?? "none" };
      if (spec.overflow_mode === "bank") {
        if (typeof data.bank_max !== "number" || typeof data.bank_refund !== "string") {
          throw new TypeError(source + $t("team-engine.native.compile.encounter.text_040f5f1188") + id + $t("team-engine.native.compile.encounter.text_be338e0c99"));
        }
        declarations[id + "_bank"] = mechanic({ max: data.bank_max, current: 0, overflow_mode: "none" }, context);
        refundHooks.push(...makeHooks([{ event: data.bank_refund === "after_ultimate" ? "on_ultimate" : data.bank_refund,
          effects: [{ effect_type: "refund_bank", resource_id: id }] }], ownerId, source + "/bank", context));
      } else if (spec.overflow_mode !== "none") throw new TypeError(source + $t("team-engine.native.compile.encounter.text_5d81c0b0c5"));
      declarations[id] = mechanic(spec, context);
    }
    return { declarations, refundHooks };
  }
  function actor(raw: RuleValues, id: string, name: string, party: CompiledActor["party"], kind: string,
    level: number, rank: number, context: ExpressionBinding): CompiledActor {
    const base = map(raw.base_stats);
    const isSystem = raw.flags !== undefined;
    const stats = { ...defaultStats, max_energy: kind === "monster" || isSystem ? 0 : 100,
      taunt: isSystem ? 0 : 100,
      ...numeric(base), def_: number(base.def) };
    delete (stats as Record<string, number>).def;
    if (!Number.isInteger(level) || level < 1 || (party === "player" && level > 80) || (kind !== "summon" && stats.spd <= 0)) {
      throw new TypeError($t("team-engine.native.compile.encounter.text_fbb7f7ac1a", { "id": id }));
    }
    const source = "actor/" + id;
    const { declarations, refundHooks } = resources(raw, context, id, source);
    const modelHooks = makeHooks(raw.hooks, id, source, context, declarations);
    return {
      ...mechanic(raw, context), id, name, party, kind, level, rank, stats,
      path: canonicalPath(raw.path), element: string(raw.element).toLowerCase(), groups: strings(raw.groups),
      elationNumber: number(raw.elation_number), systemFlags: strings(raw.flags),
      speedRule: raw.speed_rule ? string(raw.speed_rule) : undefined,
      turnHandler: raw.turn_handler ? string(raw.turn_handler) : undefined,
      summon: kind === "summon" ? {
        inheritance: Array.isArray(raw.inheritance) ? strings(raw.inheritance) : string(raw.inheritance, "full"),
        maxHpRatio: number(raw.max_hp_ratio), control: string(raw.control, "auto"),
        capabilities: Object.fromEntries(Object.entries(map(raw.capabilities)).map(([flag, set]) => [flag, !!set])),
      } : undefined,
      damageBonus: numeric(base.dmg_bonus), resistance: numeric(raw.resistance ?? base.resistance),
      weakness: strings(raw.weakness ?? base.weakness),
      toughnessBars: Array.isArray(base.toughness_bars) ? base.toughness_bars.map(value => number(value)) : [],
      skillLevels: context.levels ?? {},
      actions: entries(raw.actions).map(action => ({
        ...mechanic(action, context), id: string(action.action_id), name: string(action.name, string(action.action_id)),
        kind: string(action.action_type, "basic"), target: string(action.target_type, "single"),
        damageType: action.damage_type ? string(action.damage_type) : undefined,
        levelKey: string(action.level_key, string(action.action_type, "basic")),
        scaling: entries(action.scaling).map(numeric),
        scalingBlast: entries(action.scaling_blast).map(numeric),
      })),
      hooks: [...refundHooks, ...modelHooks], resources: declarations, bindingParams: {},
      modifiers: [], summons: [], techniques: entries(raw.techniques).map(item => mechanic(item, context)),
    };
  }
  function register(unit: CompiledActor, isSummon = false) {
    if (actionsByActor.has(unit.id)) throw new TypeError($t("team-engine.native.compile.encounter.text_83c30a430a", { "id": unit.id }));
    actionsByActor.set(unit.id, unit.actions);
    if (isSummon) summons.set(unit.id, unit);
  }
  function addResources(target: Record<string, Mechanic>, source: Record<string, Mechanic>, owner: string) {
    for (const [id, declaration] of Object.entries(source)) {
      if (Object.hasOwn(target, id)) throw new TypeError($t("team-engine.native.compile.encounter.text_c8afe67408", { "owner": owner, "id": id }));
      target[id] = declaration;
    }
  }
  async function compileMember(member: ActorBuild, raw: RuleValues): Promise<CompiledActor> {
    const id = member.id, rank = member.rank ?? 0, level = member.level ?? 80;
    const context = { ...binding, levels: effectiveSkillLevels(raw, member.skillLevels ?? {}, rank),
      tables: skillParameterTables(raw.skill_params) };
    const unit = actor(raw, id, string(raw.name, id), "player", string(raw.actor_type, "character"), level, rank, context);
    const stats = { ...unit.stats };
    const allHooks: CompiledActor["hooks"][number][] = [];
    const allResources: Record<string, Mechanic> = {};
    const modifiers: InitialModifier[] = [];
    const params: Record<string, number> = {};
    if (member.cone) {
      const { id: coneId, rank: superimposition, active } = member.cone;
      if (!Number.isInteger(superimposition) || superimposition < 1 || superimposition > 5) {
        throw new TypeError($t("team-engine.native.compile.encounter.text_81c7c6d8ce", { "coneId": coneId }));
      }
      const cone = active ? await library.read("light_cones", coneId) : {};
      const white = member.cone.base ?? numeric(cone.base_stats);
      stats.hp += white.hp ?? 0;
      stats.atk += white.atk ?? 0;
      stats.def_ += white.def ?? 0;
      const tables = map(cone.lookup_tables);
      for (const declaration of strings(cone.variable_bindings)) {
        const assignment = /^\s*self\.(\w+)\s*=\s*(.+?)\s*$/.exec(declaration);
        if (!assignment) throw new TypeError($t("team-engine.native.compile.encounter.text_2da1e5bf7d", { "coneId": coneId }));
        const name = assignment[1]!, source = assignment[2]!;
        params[name] = expr.evaluate<number>(expr.compile(source, binding, "formula"), {
          context: { build: { light_cone: { superimposition } } },
          functions: { lookup_table: (table: string, { index }: { index: number }) => {
            const values = tables[table];
            const value: unknown = Array.isArray(values) ? values[Math.trunc(index)] : undefined;
            if (typeof value !== "number") throw new TypeError($t("team-engine.native.compile.encounter.text_1a31398735", { "coneId": coneId, "table": table, "index": index }));
            return value;
          } },
        });
      }
      appendCaveats(cone, id, "light_cones/" + coneId);
      const source = "light_cones/" + coneId;
      const { declarations, refundHooks } = resources(cone, binding, id, source);
      addResources(allResources, declarations, id);
      allHooks.push(...refundHooks, ...makeHooks(cone.hooks, id, source, binding, allResources));
    }
    Object.assign(stats, member.whiteStats);
    const affixes: Record<string, number> = {};
    const sets = new Map<string, number>();
    const affix = (key: string, family: "main" | "sub", override?: number) => {
      const base = rules.relicAffixes[family]?.[key];
      if (base === undefined) throw new TypeError($t("team-engine.native.compile.encounter.text_eaa36c2473", { "value1": family === "main" ? $t("team-engine.native.compile.encounter.text_9e32fa2b4f") : $t("team-engine.native.compile.encounter.text_79e5dcf869"), "key": key }));
      add(affixes, elementalAffixes.has(key) ? "dmg_" + key.slice(0, -4) : key, override ?? base);
    };
    for (const relic of member.relics ?? []) {
      if (relic.set) sets.set(relic.set, (sets.get(relic.set) ?? 0) + 1);
      if (relic.main) affix(relic.main, "main", relic.mainValue);
      for (const [key, value] of Object.entries(relic.subs ?? {})) affix(key, "sub", value);
    }
    appendStats(modifiers, "RELIC_" + id, $t("team-engine.native.compile.encounter.text_9114c43bcb"), affixes);
    for (const [setId, count] of sets) {
      if (count < 2) continue;
      const set = await library.read("relics", setId);
      appendCaveats(set, id, "relics/" + setId);
      const { declarations, refundHooks } = resources(set, binding, id, "relics/" + setId);
      addResources(allResources, declarations, id);
      allHooks.push(...refundHooks);
      for (const need of [2, 4]) {
        if (count < need) continue;
        const piece = map(set[`set_${need}pc`]);
        appendStats(modifiers, `RELIC_${setId}_${need}PC`, `${string(set.name, setId)} ${need}pc`, piece.stat_effects);
        allHooks.push(...makeHooks(piece.hooks, id, `relics/${setId}/${need}pc`, binding, allResources));
      }
    }
    appendCaveats(raw, id, "characters/" + id);
    appendStats(modifiers, "TRACE_" + id, $t("team-engine.native.compile.encounter.text_f852e2fa16"), raw.trace_stat_effects);
    addResources(allResources, { ...unit.resources }, id);
    allHooks.push(...unit.hooks);
    const children = Object.entries(map(raw.summons)).map(([summonId, definition]) => {
      const model = map(definition);
      return { ...actor(model, summonId, string(model.name, summonId), "player", "summon", level, 0, context), ownerId: id };
    });
    allHooks.push(...children.flatMap(child => child.hooks));
    const eidolons = map(raw.eidolons);
    let state = map(raw.state_config);
    for (let step = 1; step <= rank; step++) {
      const eidolon = map(eidolons["E" + step]);
      appendStats(modifiers, `EIDO_${id}_E${step}`, string(eidolon.name, "E" + step), eidolon.stat_effects);
      if (raw.state_config) state = { ...state, ...map(eidolon.overrides) };
      allHooks.push(...makeHooks(eidolon.hooks, id, `characters/${id}/E${step}`, context, allResources));
    }
    if (state.stat_effects !== undefined) {
      const stats = Object.fromEntries(Object.entries(map(state.stat_effects)).map(([key, value]) => {
        const bound = typeof value === "string" ? Number(bindRuleExpression(value, context)) : value;
        if (typeof bound !== "number" || !Number.isFinite(bound)) throw new TypeError(id + $t("team-engine.native.compile.encounter.text_6cbccac7c6") + key + $t("team-engine.native.compile.encounter.text_6e2ef963ba"));
        return [key, bound];
      }));
      state = { ...state, stat_effects: stats };
    }
    return { ...unit, stats, hooks: allHooks, resources: allResources, modifiers, bindingParams: params,
      stateConfig: raw.state_config ? mechanic(state, context) : undefined, summons: children };
  }

  const templates = await Promise.all(build.team.map(row => library.read("characters", row.id, row.version)));
  const systemNames = new Set(templates.flatMap(raw => [
    ...strings(raw.imports), ...(canonicalPath(raw.path) === "elation" ? ["paths/elation"] : []),
  ]));
  const systemActors: CompiledActor[] = [];
  for (const name of systemNames) {
    const raw = await library.system(name);
    const units = entries(raw.units).map(model => {
      const id = string(model.actor_id);
      return actor(model, id, string(model.name, id), "player", string(model.actor_type, "system"),
        number(model.level, 80), 0, binding);
    });
    const owner = units[0];
    if (!owner) throw new TypeError($t("team-engine.native.compile.encounter.text_0bba70dbb2", { "name": name }));
    const { declarations, refundHooks } = resources(raw, binding, owner.id, name);
    const systemHooks = [...refundHooks, ...makeHooks(raw.hooks, owner.id, name, binding, declarations)];
    for (const unit of units) {
      const primary = unit === owner;
      const withModule = primary ? { ...unit, hooks: [...systemHooks, ...unit.hooks],
        resources: { ...unit.resources, ...declarations } } : unit;
      register(withModule);
      hooks.push(...withModule.hooks);
      systemActors.push(withModule);
    }
  }
  const team: CompiledActor[] = [];
  for (const [index, member] of build.team.entries()) {
    const unit = await compileMember(member, templates[index]!);
    register(unit);
    for (const child of unit.summons) register(child, true);
    hooks.push(...unit.hooks);
    team.push(unit);
  }
  const enemies: CompiledActor[] = [];
  for (const spec of build.stage.enemies) {
    const raw = await library.read("enemies", spec.template);
    const enemy = actor(raw, spec.id, spec.name ?? string(raw.name, spec.id), "enemy", "monster",
      number(raw.level, 80), 0, binding);
    register(enemy);
    if (raw.policy) enemyRules.set(enemy.id, mechanic(map(raw.policy)));
    hooks.push(...enemy.hooks);
    enemies.push(enemy);
  }
  if (!Number.isFinite(build.stage.maxActionValue) || build.stage.maxActionValue <= 0) {
    throw new TypeError($t("team-engine.native.compile.encounter.text_8cc9015e49"));
  }
  const approximate = new Map<string, number>();
  for (const hook of hooks) {
    if ([...hook.expressions.values()].some(expression => /\bmechanic_chance\s*\(/.test(expression.source))) {
      approximate.set(hook.ownerId, (approximate.get(hook.ownerId) ?? 0) + 1);
    }
  }
  for (const [owner, count] of [...approximate].sort(([a], [b]) => a.localeCompare(b))) {
    caveats.push({ actor: owner, source: "compiler", level: "approx", mechanism: "mechanic_chance",
      text: $t("team-engine.native.compile.encounter.text_f1ee810398", { "count": count }) });
  }
  const actionRules = (build.actionRules ?? defaultPolicy).map(raw => {
    const model = mechanic(raw);
    return { ...model, action: string(raw.action), priority: number(raw.priority),
      condition: model.expressions.get("condition") };
  }).sort((a, b) => b.priority - a.priority);
  const cycle = rules.modes[build.stage.mode];
  if (!cycle) throw new TypeError($t("team-engine.native.compile.encounter.text_45f86c98d8") + build.stage.mode);
  const stage = { ...build.stage, terminationMode: "fixed_av" as const, enemies, cycle };
  return { team, stage, systemActors, summons, actionsByActor, hooks,
    policy: { mode: "rule_based", ultimateTiming: "after_action", actionRules, enemyRules }, caveats, rules, expr };
}
