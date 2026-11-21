// HSR Nous hook namespaces and target algebra, adapted from the MIT-licensed pinned engine.
import { ActorState, isEnemy } from "../combat/index.ts";
import { map, number, string, strings } from "../compile/library.ts";
import type { CompiledActor, Mechanic } from "../compile/types.ts";
import { evaluate, type EvaluateOptions, type PreparedExpression } from "../rules/expression.ts";
import { skillParameterTables } from "../rules/schema.ts";
import type { BattleRunner } from "../runner/runner.ts";
import type { EventPayload } from "./events.ts";
import { dataOf, type EvaluationScope, type ModifierBook, type PanelOf } from "./modifiers.ts";
import type { ResourceBook } from "./resources.ts";

type Functions = NonNullable<EvaluateOptions["functions"]>;
const c = (condition: unknown): number => Number(Boolean(condition));
const live = (actor?: ActorState) => !!actor?.alive && !actor.banished;
const dotElements: Readonly<Record<string, string>> = { shock: "thunder", wind_shear: "wind", burn: "fire", bleed: "physical" };
const aliases: Readonly<Record<string, EventPayload>> = {
  self: { pool: "self" }, all_allies: { pool: "allies" }, other_allies: { pool: "allies" },
  all_enemies: { pool: "enemies" }, enemy_first: { pool: "enemies", take: 1 },
  highest_hp: { pool: "enemies", order_by: "-$it.hp", take: 1 },
  highest_hp_hit: { pool: "$event.hit_targets", order_by: "-$it.hp", take: 1 },
};

export class HookContext {
  readonly #rollFrames: Map<string, number>[] = [];
  readonly #dynamic = new Map<ActorState, Map<string, number>>();
  readonly #level: ActorState;

  constructor(readonly runner: BattleRunner, readonly modifiers: ModifierBook, readonly resources: ResourceBook) {
    this.#level = new ActorState({ id: "$level", kind: "level", level: 80, stats: { spd: 0 } });
  }

  actor(ref: unknown): ActorState | undefined {
    if (ref instanceof ActorState) return ref;
    const id = string(map(ref).actor_id ?? ref);
    return id === "$level" ? this.#level : this.runner.state.actors.get(id);
  }

  template(id: string): CompiledActor | undefined {
    if (id === "$level") return undefined;
    return this.runner.actorTemplate(id);
  }

  setDynamic(actor: ActorState, key: string, value: number): void {
    const data = this.#dynamic.get(actor) ?? new Map<string, number>();
    data.set(key, value);
    this.#dynamic.set(actor, data);
  }

  frame<T>(fn: () => T): T {
    this.#rollFrames.push(new Map());
    try { return fn(); } finally { this.#rollFrames.pop(); }
  }

  bindRoll(key: string, scale = 1): number {
    const frame = this.#rollFrames.at(-1);
    if (!frame) throw new Error("概率绑定须在行动结算中");
    if (!frame.has(key)) frame.set(key, scale * (this.runner.mode === "roll" ? this.rng() : 0.49999999999999994));
    return frame.get(key)!;
  }

  rng = (): number => {
    if (!this.runner.rng) throw new Error("战斗未提供随机源");
    return this.runner.rng();
  };

  expression(raw: unknown, actor: ActorState): PreparedExpression {
    const template = this.template(actor.actor.id);
    return this.runner.encounter.expr.compile(String(raw), {
      constants: this.runner.encounter.rules.constants,
      tables: skillParameterTables(template?.raw.skill_params),
      levels: template?.skillLevels,
    });
  }

  amount(model: Mechanic, key: string, actor: ActorState, payload: EventPayload, scope: EvaluationScope = {}, fallback = 0): number {
    const expression = model.expressions.get(key);
    const raw = model.raw[key];
    if (!expression && typeof raw !== "string") return number(raw, fallback);
    return Number(this.evaluate(expression ?? this.expression(raw, actor), actor, payload, scope));
  }

  #namespace(actor: ActorState, panelOf: PanelOf, forTarget = false): EventPayload {
    const template = this.template(actor.actor.id);
    const values = {
      ...template?.bindingParams, actor_id: actor.actor.id, name: template?.name ?? actor.actor.id,
      hp: actor.currentHp, energy: actor.currentEnergy, max_energy: actor.actor.stats.max_energy ?? 0,
      state: this.runner.activeForm(actor),
      summoner_id: template?.ownerId ?? "", broken: actor.broken, alive: actor.alive,
    };
    let panel: ReturnType<PanelOf> | undefined;
    const view = () => panel ??= panelOf(actor);
    const lookup = (key: string): unknown => {
      if (key === "max_hp") return view().stats.hp;
      if (key === "dmg_bonus") return view().damageBonus;
      if (key === "shield" && forTarget) return this.modifiers.shieldTotal(actor);
      return view().stats[key];
    };
    return new Proxy(values as EventPayload, {
      getOwnPropertyDescriptor(target, key) {
        const desc = Object.getOwnPropertyDescriptor(target, key);
        if (desc || typeof key !== "string") return desc;
        const value = lookup(key);
        return value === undefined ? undefined : { value, configurable: true, enumerable: true };
      },
      get(target, key) { return Reflect.has(target, key) || typeof key !== "string" ? Reflect.get(target, key) : lookup(key); },
    });
  }

  evaluate(expression: PreparedExpression, actor: ActorState, payload: EventPayload, scope: EvaluationScope = {}): unknown {
    const panelOf = scope.panelOf ?? (target => this.modifiers.panelOf(target));
    const self = this.#namespace(actor, panelOf);
    const team = new Proxy<Record<string, unknown>>({}, {
      getOwnPropertyDescriptor: (_target, key) => typeof key === "string"
        ? { configurable: true, enumerable: true } : undefined,
      get: (_target, key) => typeof key === "string"
        ? this.runner.actors("player").filter(unit =>
          this.template(unit.actor.id)?.summon?.capabilities.ally_targetable !== false).map(unit =>
          key === "certified_banger" ? this.resources.value(unit, key) : this.#namespace(unit, panelOf)[key]) : undefined,
    });
    const source = payload.source ?? this.actor(payload.target)?.modifiers.get(string(payload.modifier_id))?.sourceId ?? "";
    const target = scope.target;
    const context = { event: { insert: false, cancel: false, ...payload }, self, team,
      level: { actor_id: "$level" }, ...this.resources.entries(actor),
      ...(payload.modifier_id === undefined ? {} : { modifier: { modifier_id: payload.modifier_id, source } }),
      ...(target ? { target: this.#namespace(target, panelOf, true) } : {}), ...scope.extra,
    };
    return evaluate(expression, { context, functions: this.#functions(actor, payload, panelOf, !!scope.readonlyRoll),
      rng: this.runner.rng, trace: false }).value;
  }

  #functions(owner: ActorState, payload: EventPayload, panelOf: PanelOf, readonlyRoll: boolean): Functions {
    const actor = (ref: unknown) => this.actor(ref);
    const participants = [...this.runner.state.actors.values()];
    const sides = (faction: unknown, alive: boolean) => {
      if (!["all", "ally", "enemy"].includes(String(faction))) throw new TypeError("战斗队伍筛选条件不正确");
      return participants.filter(unit => (!alive || live(unit)) &&
        (faction === "all" || isEnemy(unit.actor) === (faction === "enemy")));
    };
    const enemies = () => this.runner.actors("enemy");
    const statuses = (ref: unknown) => [...(actor(ref)?.modifiers.values() ?? [])];
    const template = (ref: unknown) => { const target = actor(ref); return target ? this.template(target.actor.id) : undefined; };
    const status = (ref: unknown, id: unknown) => actor(ref)?.modifiers.get(string(id));
    const sameGroup = (meta: CompiledActor | undefined, group: string) =>
      !!meta && (group.startsWith("path:") ? group === "path:" + meta.path : meta.groups.includes(group));
    const panel = (ref: unknown, key: string, noAura?: unknown) => {
      const target = actor(ref);
      return target ? (noAura ? this.modifiers.panelOf(target, true, true) : panelOf(target)).stats[key] ?? 0 : 0;
    };
    const bySpot = (ref: unknown, team: unknown = "dark") =>
      actor(ref) ? this.runner.actors(team === "dark" ? "enemy" : "player") : [];
    const sideOf = (unit: ActorState) => isEnemy(unit.actor) ? "dark" : "light";
    const inSpot = (ref: unknown, team?: unknown) => {
      const target = actor(ref);
      return target ? bySpot(ref, team).indexOf(target) + 1 : 0;
    };
    const ids = (item: unknown) => string(item);
    const existing = (ref: unknown, id: unknown, source?: unknown) => {
      const item = status(ref, id);
      return !!item && (!source || item.sourceId === string(map(source).actor_id ?? source));
    };
    return {
      stacks: (ref: unknown, id: unknown) => status(ref, id)?.stacks ?? 0,
      modifier_duration: (ref: unknown, id: unknown) => status(ref, id)?.duration ?? 0,
      sum_stacks: (id: unknown, side: unknown = "enemy") => sides(side, true).reduce((sum, unit) => sum + (status(unit, id)?.stacks ?? 0), 0),
      has_modifier: (ref: unknown, id: unknown, source?: unknown) => c(existing(ref, id, source)),
      modifier_source: (ref: unknown, id: unknown) => status(ref, id)?.sourceId ?? "",
      enemies_alive: () => enemies().length,
      damageable_enemies: () => enemies().filter(unit => !statuses(unit).some(item => dataOf(item).hp_lock)).length,
      broken_of: (ref: unknown) => c(actor(ref)?.broken),
      has_weakness: (ref: unknown, element: unknown) => {
        const target = actor(ref);
        return c(target && (panelOf(target).weakness ?? []).includes(string(element)));
      },
      weakness_count: (ref: unknown) => { const target = actor(ref); return target ? panelOf(target).weakness?.length ?? 0 : 0; },
      dot_kind: (ref: unknown, kind: unknown) => c(statuses(ref).some(item => item.type === "dot" &&
        dataOf(item).dot_element === dotElements[string(kind).toLowerCase()])),
      has_stat_penalty: (ref: unknown, stat: unknown) => c(statuses(ref).some(item =>
        item.type !== "buff" && number(map(dataOf(item).stat_effects)[string(stat)]) < 0)),
      has_shield: (ref: unknown, src?: unknown) => {
        const target = actor(ref);
        return c(target && this.modifiers.shieldCount(target, src ? string(map(src).actor_id ?? src) : undefined));
      },
      shielded_count: () => this.runner.actors("player").filter(unit => this.modifiers.shieldCount(unit)).length,
      controlled: (ref: unknown, kind?: unknown) => c(statuses(ref).some(item => item.controlKind &&
        (!kind || item.controlKind === kind))),
      action_disabled: (ref: unknown) => c(statuses(ref).some(item => dataOf(item).prevent_action)),
      has_debuff: (ref: unknown) => c(statuses(ref).some(item => item.type !== "buff")),
      debuff_count: (ref: unknown, source?: unknown) => statuses(ref).filter(item =>
        item.type !== "buff" && (!source || item.sourceId === string(map(source).actor_id ?? source))).length,
      dot_count: (ref: unknown) => statuses(ref).filter(item => item.type === "dot").length,
      dot_value: (ref: unknown, id: unknown) => {
        const item = status(ref, id);
        return item?.type === "dot" && "dot" in item ? number(map(map(item.dot).snapshot).ability_multiplier) * item.stacks : 0;
      },
      count: (collection: unknown) => Array.isArray(collection) || typeof collection === "string" ? collection.length
        : collection instanceof Set || collection instanceof Map ? collection.size : Object.keys(map(collection)).length,
      count_selected: (pool: unknown, where: unknown = "true") => this.targets({ pool, where }, owner, payload, panelOf).length,
      unique_sources: (id: unknown) => this.resources.uniqueSources(owner, string(id)),
      actor_type_of: (ref: unknown) => actor(ref)?.actor.kind ?? "",
      path_of: (ref: unknown) => template(ref)?.path ?? "",
      has_summon: (ref: unknown) => c(participants.some(unit => live(unit) && template(unit)?.ownerId === actor(ref)?.actor.id)),
      summoner_of: (ref: unknown) => template(ref)?.ownerId ?? "",
      actor_alive: (ref: unknown) => c(live(actor(ref) ?? participants.find(unit => unit.actor.id.split("__", 1)[0] === string(ref)))),
      hp_of: (ref: unknown) => actor(ref)?.currentHp ?? 0,
      max_hp_of: (ref: unknown) => panel(ref, "hp"),
      toughness_of: (ref: unknown) => actor(ref)?.toughness ?? 0,
      has_pending_one_more: (ref: unknown) => c(this.runner.scheduler.preview(1).some(turn =>
        turn.kind === "normal_extra" && turn.actor.id === actor(ref)?.actor.id)),
      turn_owner_of: () => this.runner.currentTurnActorId ?? "",
      position_of: inSpot,
      side_size: (ref: unknown, team?: unknown) => bySpot(ref, team).length,
      neighbor_of: (ref: unknown, offset: unknown) => {
        const target = actor(ref);
        if (!target) return "";
        const side = sideOf(target), spot = inSpot(ref, side);
        return spot ? bySpot(ref, side)[spot + Number(offset) - 1]?.actor.id ?? "" : "";
      },
      position_delta: (ref: unknown, origin: unknown) => {
        const from = actor(origin), to = actor(ref);
        return from && to && sideOf(from) === sideOf(to) ? inSpot(ref, sideOf(from)) - inSpot(origin, sideOf(from)) : 0;
      },
      is_adjacent: (ref: unknown, origin: unknown) => {
        const from = actor(origin), to = actor(ref);
        if (!from || !to || sideOf(from) !== sideOf(to)) return 0;
        const side = sideOf(from), a = inSpot(ref, side), b = inSpot(origin, side);
        return c(a > 0 && b > 0 && Math.abs(a - b) === 1);
      },
      resource_of: (ref: unknown, id: unknown) => { const target = actor(ref); return target ? this.resources.value(target, string(id)) : 0; },
      dynamic_of: (ref: unknown, key: unknown) => { const target = actor(ref); return target ? this.#dynamic.get(target)?.get(string(key)) ?? 0 : 0; },
      mechanic_chance: (chance: unknown) => c(this.runner.mode === "expected" ? Number(chance) >= 0.5 : this.rng() < Number(chance)),
      roll: (key: unknown) => {
        const id = string(key);
        if (!readonlyRoll) {
          const frame = this.#rollFrames.at(-1);
          if (!frame) throw new Error("随机表达式须在行动结算中");
          if (!frame.has(id)) frame.set(id, this.rng());
          return frame.get(id)!;
        }
        const value = this.#rollFrames.at(-1)?.get(id);
        if (value === undefined) throw new Error("条件表达式没有已绑定的随机值");
        return value;
      },
      count_team: (path: unknown = "", group: unknown = "") => {
        const pathName = typeof path === "string" ? path : string(map(path).path);
        const groupName = string(map(path).group ?? map(group).group ?? group);
        return this.runner.encounter.team.filter(unit => (!pathName && !groupName) ||
          (!!pathName && unit.path === pathName) || (!!groupName && sameGroup(unit, groupName))).length;
      },
      in_group: (ref: unknown, group: unknown) => c(sameGroup(template(ref), string(group))),
      count_modifier: (...args: unknown[]) => {
        const last = args.at(-1);
        const side = map(last).side ?? "ally";
        const wanted = new Set((last && typeof last === "object" ? args.slice(0, -1) : args).map(ids));
        return sides(side, true).filter(unit => statuses(unit).some(item =>
          wanted.has(item.id) || wanted.has(string(dataOf(item).name)))).length;
      },
      who_has: (id: unknown, side: unknown = "ally") => sides(map(side).side ?? side, false)
        .find(unit => status(unit, id))?.actor.id ?? "",
      character_id: (ref: unknown) => actor(ref)?.actor.id.split("__", 1)[0] ?? "",
      monster_id: (ref: unknown) => isEnemy(actor(ref)?.actor ?? owner.actor) ? template(ref)?.raw.enemy_id ?? "" : "",
      monster_unique_id: (ref: unknown) => number(template(ref)?.raw.unique_id),
      monster_rank: (ref: unknown) => number(template(ref)?.raw.rank),
      element_of: (ref: unknown) => {
        const unit = template(ref);
        if (!unit || unit.element || !unit.ownerId) return unit?.element ?? "";
        // Summon definitions can leave the element on the attacking action. This is
        // needed by allied effects such as Yao Guang's attack-element follow-up.
        const action = unit.id === payload.actor ? unit.actions.find(action => action.id === payload.action_id) : undefined;
        return action?.damageType ?? this.template(unit.ownerId)?.element ?? "";
      },
      elation_of: (ref: unknown) => panel(ref, "elation"),
      stat_of: (ref: unknown, stat: unknown, noAura?: unknown) => panel(ref, string(stat), noAura),
      base_stat_of: (ref: unknown, stat: unknown) => actor(ref)?.actor.stats[stat === "def" ? "def_" : string(stat)] ?? 0,
      in_zone: (ref: unknown, id: unknown) => c(existing(ref, id)),
    };
  }

  #pool(pool: unknown, owner: ActorState, payload: EventPayload): ActorState[] {
    const side = isEnemy(owner.actor) ? "enemy" : "player";
    if (typeof pool === "string" && pool.startsWith("$event.")) {
      const key = pool.slice(7);
      if (["hit_targets", "targets"].includes(key)) return strings(payload[key]).flatMap(id => {
        const actor = this.actor(id);
        return actor?.alive ? [actor] : [];
      });
      const actor = this.actor(payload[key]);
      return actor ? [actor] : [];
    }
    if (pool === "self") return [owner];
    if (pool === "$level") return [this.#level];
    const allies = (who: ActorState) => this.template(who.actor.id)?.summon?.capabilities.ally_targetable !== false;
    const enemies = (who: ActorState) => this.template(who.actor.id)?.summon?.capabilities.enemy_targetable !== false;
    if (pool === "allies") return this.runner.actors(side).filter(allies);
    if (pool === "enemies") return this.runner.actors(side === "enemy" ? "player" : "enemy").filter(enemies);
    if (pool === "all") return [...this.#pool("allies", owner, payload), ...this.#pool("enemies", owner, payload)];
    throw new TypeError("未知战斗选取范围 " + string(pool));
  }

  targets(selector: unknown, owner: ActorState, payload: EventPayload, panelOf: PanelOf = actor => this.modifiers.panelOf(actor)): ActorState[] {
    const spec = typeof selector === "string"
      ? selector.startsWith("$event.") || selector === "$level" ? { pool: selector } : aliases[selector]
      : map(selector);
    if (!spec) throw new TypeError("未知战斗选取方式 " + string(selector));
    let choices = this.#pool(spec.pool ?? "enemies", owner, payload);
    if (selector === "other_allies") choices = choices.filter(target => target !== owner);
    const candidate = (target: ActorState) => ({ it: this.#namespace(target, panelOf, true),
      target_hp: target.currentHp, target_hp_pct: target.currentHp / Math.max(target.actor.stats.hp ?? 0, 1e-6),
      target_broken: target.broken });
    const predicate = string(spec.where);
    if (predicate && predicate.toLowerCase() !== "true") {
      const condition = this.expression(predicate, owner);
      choices = choices.filter(target => this.evaluate(condition, owner, payload, { panelOf, extra: candidate(target) }));
    }
    const order = string(spec.order_by);
    if (order === "-formation") choices.reverse();
    else if (order && order !== "formation") {
      const descending = order.startsWith("-");
      const ordering = this.expression(descending ? order.slice(1) : order, owner);
      choices = choices.map(target => ({ target,
        priority: Number(this.evaluate(ordering, owner, payload, { panelOf, extra: candidate(target) })) }))
        .sort((a, b) => descending ? b.priority - a.priority : a.priority - b.priority).map(row => row.target);
    }
    const rawTake = spec.take ?? "all";
    const take = rawTake === "all" ? choices.length : typeof rawTake === "number" ? rawTake
      : this.evaluate(this.expression(rawTake, owner), owner, payload, { panelOf });
    if (typeof take !== "number" || !Number.isInteger(take) || take < 0) throw new TypeError("选取数量须为非负整数");
    if (spec.mode === "random" && this.runner.mode === "roll" && take < choices.length) {
      const sampled: ActorState[] = [];
      while (sampled.length < take) sampled.push(choices.splice(Math.floor(this.rng() * choices.length), 1)[0]!);
      return sampled;
    }
    return choices.slice(0, take);
  }
}
