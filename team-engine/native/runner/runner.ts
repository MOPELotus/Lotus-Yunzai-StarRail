// Turn loop and event boundaries follow HSR_Nous 00185dd (MIT).
import { ActionScheduler, ActorState, BattleState, basePanel, consumeEnergy, gainEnergy,
  numericConstant, type DamageInput, type EffectivePanel, type TurnKind } from "../combat/index.ts";
import { numeric, number, string } from "../compile/library.ts";
import type { CompiledAction, CompiledActor, CompiledEncounter } from "../compile/types.ts";
import { evaluate } from "../rules/expression.ts";
import { actionPayload, executeAction } from "./action.ts";
import { FormBook } from "./forms.ts";
import type {
  ActionOptions, ActionResult, BattleEvent, BattleMechanics, BattleParty, EnergySource,
  MechanicFactory, ModifierWithDefinition, Payload, RunnerOptions, TerminationReason, Waterfall,
} from "./contracts.ts";

const ALLY_EXCLUDED = new Set(["untargetable", "no_wipe", "no_aura"]);
const TURN_LIMIT = 2500; // the vendored worker's configured safety limit

export interface BattleStep {
  readonly actorId: string;
  readonly kind: TurnKind;
  readonly clock: number;
  readonly skipped: boolean;
}

function roundEven(value: number): number {
  const lower = Math.floor(value);
  return value - lower === .5 && lower % 2 === 0 ? lower : Math.round(value);
}

export class BattleRunner {
  readonly state: BattleState;
  readonly scheduler: ActionScheduler<CompiledActor>;
  readonly mechanics: BattleMechanics;
  readonly mode: "expected" | "roll";
  readonly rng?: () => number;
  readonly events: BattleEvent[] = [];
  readonly lastTargetByActor = new Map<string, string>();
  readonly #templates = new Map<string, CompiledActor>();
  readonly #forms = new FormBook(this);
  #lastTarget?: ActorState;
  #poolOverride?: number;
  #turnConsumed = false;
  #prepared = false;
  #eventsEnabled = false;
  #end?: TerminationReason;
  #wave = 0;
  #actionDepth = 0;
  #turnActorId?: string;
  #autoTargetDepth = 0;

  constructor(readonly encounter: CompiledEncounter, factory?: MechanicFactory, readonly options: RunnerOptions = {}) {
    this.mode = options.mode ?? "expected";
    this.rng = options.rng;
    if (this.mode === "roll" && !this.rng) throw new Error("Roll-mode battle needs a random source");
    const initial = [...encounter.team, ...encounter.stage.enemies];
    for (const actor of [...initial, ...encounter.systemActors, ...encounter.summons.values()]) {
      this.#templates.set(actor.id, actor);
    }
    this.state = new BattleState(encounter.rules, initial, encounter.stage.cycle, options.initialSkillPoints);
    this.scheduler = new ActionScheduler(initial);
    this.mechanics = factory?.(this) ?? {};
  }

  get wave(): number { return this.#wave; }
  get terminationReason(): TerminationReason | undefined { return this.#end; }
  get poolOverride(): number | undefined { return this.#poolOverride; }
  get currentTurnActorId(): string | undefined { return this.#turnActorId; }
  get autoTargeting(): boolean { return this.#autoTargetDepth > 0; }

  actorTemplate(id: string): CompiledActor {
    const actor = this.#templates.get(id);
    if (!actor) throw new Error("Unknown compiled battle actor " + id);
    return actor;
  }

  actionsOf(actor: ActorState): readonly CompiledAction[] {
    return this.encounter.actionsByActor.get(actor.actor.id) ?? this.actorTemplate(actor.actor.id).actions;
  }

  actors(party: BattleParty): ActorState[] {
    return [...this.state.actors.values()].filter(state => {
      const template = this.actorTemplate(state.actor.id);
      return state.alive && template.party === party
        && (party === "enemy" || !state.banished && !template.systemFlags.some(flag => ALLY_EXCLUDED.has(flag)));
    });
  }

  spawn(template: CompiledActor, options: { after?: string; before?: string; reason?: string } = {}): ActorState {
    const previous = this.state.actors.get(template.id);
    if (previous?.alive) return previous;
    this.#templates.set(template.id, template);
    const actor = previous ? new ActorState(template) : this.state.spawn(template);
    if (previous) {
      this.state.actors.set(template.id, actor);
      this.scheduler.rejoinActor(template);
    } else {
      this.scheduler.addActor(template);
    }
    if (template.systemFlags.includes("wave_reset_exempt")) this.scheduler.exemptFromWaveReset(template.id);
    if (template.summon?.capabilities.av === false) this.scheduler.freeze(template.id);
    const reference = options.after ?? options.before;
    if (reference) {
      const formation = [...this.state.actors].filter(([id]) => id !== template.id);
      const index = formation.findIndex(([id]) => id === reference);
      if (index >= 0) {
        let at = index;
        if (options.after) {
          at += 1;
          while (at < formation.length && this.actorTemplate(formation[at]![0]).ownerId === options.after) at += 1;
        }
        formation.splice(at, 0, [template.id, actor]);
        this.state.actors.clear();
        for (const [id, state] of formation) this.state.actors.set(id, state);
      }
    }
    for (const [id, decl] of Object.entries(template.resources)) actor.resources.set(id, number(decl.raw.current));
    this.mechanics.onActorSpawn?.(actor, template);
    if (options.reason) this.emit("actor_enter", {
      actor: template.id, reason: options.reason, actor_type: template.kind, wave_index: this.#wave,
    });
    return actor;
  }

  leave(id: string, reason = "flee"): boolean {
    const actor = this.state.actors.get(id);
    if (!actor?.alive) return false;
    this.emit("before_actor_exit", { actor: id, reason });
    actor.alive = false;
    this.scheduler.freeze(id);
    if (reason !== "banish") this.mechanics.onActorLeave?.(actor, reason);
    this.emit("actor_exit", { actor: id, reason });
    return true;
  }

  dismiss(id: string, reason = "dismiss"): boolean {
    return this.state.actors.get(id)?.actor.kind === "summon" && this.leave(id, reason);
  }

  emit(kind: string, payload: Payload): void {
    this.events.push({ kind, time: this.state.clock, payload: { ...payload } });
    if (this.#eventsEnabled) this.mechanics.onEvent?.(kind, payload);
  }

  waterfall(kind: string, payload: Waterfall): Waterfall {
    if (!this.#eventsEnabled) return payload;
    this.events.push({ kind, time: this.state.clock, payload: { ...payload } });
    return this.mechanics.waterfall?.(kind, payload) ?? payload;
  }

  panelOf(actor: ActorState): EffectivePanel {
    return this.mechanics.panelOf?.(actor) ?? basePanel(actor);
  }

  damageInput(source: ActorState, target: ActorState): Omit<DamageInput, "category"> {
    const boost = this.mechanics.scopedBoost;
    return {
      source, target, mode: this.mode, rng: this.rng,
      panelOf: actor => this.panelOf(actor),
      scopedBoost: boost?.bind(this.mechanics),
    };
  }

  removeModifier(actor: ActorState, id: string, reason: string): void {
    if (this.mechanics.removeModifier) this.mechanics.removeModifier(actor, id, reason);
    else actor.modifiers.delete(id);
  }

  checkDeath(actor: ActorState, sourceId = "", actionId = ""): void {
    if (this.mechanics.checkDeath) {
      this.mechanics.checkDeath(actor, sourceId, actionId);
      return;
    }
    if (actor.alive && actor.currentHp <= 0) {
      const id = actor.actor.id;
      this.emit("before_actor_exit", { actor: id, reason: "death" });
      actor.alive = false;
      this.exitState(actor, "death");
      this.emit("actor_exit", { actor: id, reason: "death" });
      if (sourceId) this.emit("on_kill", { source: sourceId, target: id, action_id: actionId });
      for (const summon of this.encounter.summons.values()) {
        if (summon.ownerId === id) this.dismiss(summon.id);
      }
    }
  }

  gainResource(actor: ActorState, id: string, amount: number, sourceId = ""): void {
    if (this.mechanics.gainResource) {
      this.mechanics.gainResource(actor, id, amount, sourceId);
      return;
    }
    const limit = number(this.actorTemplate(actor.actor.id).resources[id]?.raw.max, Infinity);
    actor.resources.set(id, Math.min(limit, Math.max(0, (actor.resources.get(id) ?? 0) + amount)));
  }

  grantEnergy(recipient: ActorState, amount: number, metadata: EnergySource): number {
    const owner = this.actorTemplate(recipient.actor.id).ownerId;
    if (owner) recipient = this.state.actors.get(owner) ?? recipient;
    const event = this.waterfall("on_gain_energy", { actor: recipient.actor.id, amount,
      source: metadata.source, action_id: metadata.actionId ?? null, reason: metadata.reason, err_exempt: metadata.errExempt ?? false });
    const changed = number(event.amount, amount);
    if (event.cancel || changed <= 0) return 0;
    return Number(gainEnergy(this.encounter.rules, recipient, changed,
      metadata.errExempt ? 1 : this.panelOf(recipient).stats.energy_regen ?? 1).node.actualAmount);
  }

  adjustSkillPoints(delta: number, reason = "", consumer = ""): number {
    if (!delta) return 0;
    if (delta < 0) {
      const event = this.waterfall("before_consume", { actor: "", resource_id: "sp", amount: -delta, reason });
      if (event.cancel) return 0;
      delta = -Math.max(0, roundEven(number(event.amount, -delta)));
    }
    const before = this.state.skillPoints;
    this.state.skillPoints = Math.max(0, Math.min(this.state.maxSkillPoints, before + Math.trunc(delta)));
    const after = this.state.skillPoints;
    if (after !== before) {
      this.emit("on_skill_point_change", { before, after, reason, turn: this.state.turnCount + 1, consumer: delta < 0 ? consumer : "" });
    }
    if (delta < 0 && after < before) this.emit("after_consume", {
      actor: "", resource_id: "sp", amount: before - after, current: after,
    });
    return Math.max(0, before - this.state.skillPoints);
  }

  applyActionEffects(source: ActorState, action: CompiledAction): void {
    for (const [id, amount] of Object.entries(numeric(action.raw.resource_gain))) this.gainResource(source, id, amount, source.actor.id);
    if (action.raw.act_now_targets === "all_enemies") {
      for (const target of this.actors("enemy")) this.scheduler.actNow(target.actor.id);
    }
    this.mechanics.applyActionEffects?.(source, action);
  }

  damageEvent<T>(fn: () => T): T {
    return this.mechanics.onDamageEvent ? this.mechanics.onDamageEvent(fn) : fn();
  }

  execute(source: ActorState, action: CompiledAction, options: ActionOptions = {}): ActionResult {
    if (this.#actionDepth >= 128) throw new Error("Battle action recursion limit reached");
    const previous = this.#poolOverride;
    if (options.poolOverride !== undefined) this.#poolOverride = options.poolOverride;
    const automatic = Boolean(options.insert || options.autoTarget);
    if (automatic) this.#autoTargetDepth += 1;
    this.#actionDepth += 1;
    try {
      const result = executeAction(this, source, action, options);
      this.#lastTarget = result.target;
      this.emit("on_action", {
        ...actionPayload(source, action, result),
        ...(options.insert ? { insert: true, tag: options.tag ?? "insert" } : {}),
      });
      this.emit("on_action_end", { actor: source.actor.id, action_type: action.kind, action_id: action.id,
        actor_type: source.actor.kind, insert: options.insert ?? false,
      });
      return result;
    } finally {
      this.#actionDepth -= 1;
      if (automatic) this.#autoTargetDepth -= 1;
      this.#poolOverride = previous;
    }
  }

  actionAvailable(actor: ActorState, action: CompiledAction): boolean {
    if (!action.raw.available_if) return true;
    if (this.mechanics.actionAvailability) return this.mechanics.actionAvailability(actor, action);
    const expr = action.expressions.get("available_if");
    if (!expr) return false;
    try { return Boolean(evaluate(expr, { context: this.#policyContext(actor), trace: false }).value); }
    catch { return false; }
  }

  #policyContext(actor: ActorState): Payload {
    const stats = this.panelOf(actor).stats;
    const resources = Object.fromEntries([...actor.resources].map(([name, amount]) => ["res_" + name, amount]));
    return {
      skill_points: this.state.skillPoints, energy: actor.currentEnergy, actor: actor.actor.id,
      skill_point: this.state.skillPoints, turn: this.state.turnCount + 1,
      self: { ...stats, actor_id: actor.actor.id, hp: actor.currentHp, max_hp: stats.hp, energy: actor.currentEnergy },
      ...resources, ...this.mechanics.policyContext?.(actor),
    };
  }

  #ultimateThreshold(actor: ActorState, action: CompiledAction): number {
    const declared = number(action.raw.energy_cost);
    return declared > 0 ? declared : actor.actor.stats.max_energy ?? 0;
  }

  #ready(actor: ActorState, action: CompiledAction): boolean {
    const custom = string(action.raw.ult_cost_resource);
    return custom ? (actor.resources.get(custom) ?? 0) >= number(action.raw.ult_cost_amount)
      : actor.currentEnergy >= this.#ultimateThreshold(actor, action);
  }

  #formActions(actor: ActorState, candidates: readonly CompiledAction[]): readonly CompiledAction[] {
    return this.mechanics.filterActions?.(actor, candidates) ?? this.#forms.filter(actor, candidates);
  }

  enterState(actor: ActorState): boolean { return this.#forms.enter(actor); }
  exitState(actor: ActorState, reason = "exit"): void { this.#forms.exit(actor, reason); }
  activeForm(actor: ActorState): string { return string(this.#forms.current(actor)?.raw.state); }

  #ultimateOf(actor: ActorState): CompiledAction | undefined {
    return this.#formActions(actor, this.actionsOf(actor).filter(action => action.kind === "ultimate"))[0];
  }

  activateUltimate(actor: ActorState): boolean {
    if (!actor.alive || actor.banished) return false;
    const action = this.#ultimateOf(actor);
    return action ? this.#fireUltimate(actor, action, true) : false;
  }

  #fireUltimate(actor: ActorState, action: CompiledAction, free = false): boolean {
    if (this.#forms.sameEntry(actor, action)) return false;
    if (!free) {
      const custom = string(action.raw.ult_cost_resource);
      if (custom) this.gainResource(actor, custom, -(number(action.raw.ult_consume_amount) || number(action.raw.ult_cost_amount)));
      else consumeEnergy(actor, this.#ultimateThreshold(actor, action));
    }
    const state = this.mechanics.enterUltimateState?.(actor, action) ?? this.#forms.enterFromUltimate(actor, action);
    if (state === "already") return false;
    if (state === "entered") {
      this.emit("on_action", actionPayload(actor, action, { target: this.#lastTarget, spentSkillPoints: 0 }));
    } else {
      this.execute(actor, action);
    }
    this.emit("on_ultimate", { source: actor.actor.id, action: action.id, target: this.#lastTarget?.actor.id ?? null });
    return true;
  }

  #ultimateWindow(actor: ActorState): void {
    if (!actor.alive || actor.banished) return;
    for (let count = 0; count < 16; ++count) {
      const ult = this.#ultimateOf(actor);
      const action = ult && this.#ready(actor, ult) && this.actionAvailable(actor, ult) ? ult
        : this.actionsOf(actor).find(item => item.raw.manual_trigger && this.actionAvailable(actor, item));
      if (!action) return;
      if (action.raw.manual_trigger) this.execute(actor, action);
      else if (!this.#fireUltimate(actor, action)) return;
    }
  }

  endCurrentTurn(actor: ActorState): void {
    for (const modifier of actor.modifiers.values() as Iterable<ModifierWithDefinition>) {
      if (modifier.duration > 0 && (modifier.anchor ?? "owner_turn_end") === "owner_turn_end") modifier.duration += 1;
    }
    this.mechanics.tick?.(actor, "owner_turn_end");
    this.#turnConsumed = true;
  }

  #playerAction(actor: ActorState, isSummon: boolean): CompiledAction | undefined {
    const candidates = this.actionsOf(actor).filter(action => {
      if (action.kind === "assist" || action.kind === "elation_skill") return false;
      return action.kind === "ultimate" ? this.#ready(actor, action) : this.state.skillPoints >= number(action.raw.skill_point_cost);
    });
    const legal = (isSummon ? candidates : this.#formActions(actor, candidates)).filter(action => this.actionAvailable(actor, action));
    if (isSummon && this.actorTemplate(actor.actor.id).summon?.control !== "manual") {
      return legal.find(action => !action.raw.manual_trigger);
    }
    const context = this.#policyContext(actor);
    const want = this.encounter.policy.actionRules.find(rule =>
      !rule.condition || evaluate(rule.condition, { context, rng: this.rng, trace: false }).value)?.action ?? "basic";
    return legal.find(action => action.id === want) ?? legal.find(action => action.kind === want) ?? legal[0];
  }

  #enemyTurn(actor: ActorState): void {
    const freeze = [...actor.modifiers.values()].filter(mod => mod.controlKind === "freeze");
    if (freeze.length) {
      for (const mod of freeze) this.removeModifier(actor, mod.id, "expire");
      this.scheduler.advanceAction(actor.actor.id, numericConstant(this.encounter.rules, "freeze_advance"));
      return;
    }
    if (actor.broken) {
      const full = actor.actor.stats.max_toughness ?? 0;
      const recovery = this.waterfall("toughness_recovered", { target: actor.actor.id, amount: full });
      if (recovery.cancel) {
        this.scheduler.undoGaugeReset(actor.actor.id);
        return;
      }
      actor.broken = false;
      actor.barIndex = 0;
      actor.toughness = number(recovery.amount, full);
    }
    const actions = this.actionsOf(actor);
    const policy = this.encounter.policy.enemyRules.get(actor.actor.id);
    if (policy) throw new Error("Unsupported native enemy policy " + actor.actor.id);
    const action = actions[0];
    if (action) this.execute(actor, action);
  }

  #forcedBasic(actor: ActorState, control: "outrage" | "dominate"): boolean {
    if (![...actor.modifiers.values()].some(mod => mod.controlKind === control)) return false;
    const party = this.actorTemplate(actor.actor.id).party;
    const targetParty = control === "dominate" ? party : party === "player" ? "enemy" : "player";
    const candidates = this.actors(targetParty).filter(state => state !== actor);
    if (!candidates.length) return true;
    const index = this.mode === "roll" && this.rng ? Math.floor(this.rng() * candidates.length) : 0;
    const action = this.actionsOf(actor).find(item => item.kind === "basic");
    if (action) this.execute(actor, { ...action, target: control === "dominate" ? "ally_single" : "single" },
      { forcedTarget: candidates[index] });
    return true;
  }

  #runTurn(actor: ActorState, kind: TurnKind): void {
    this.#turnActorId = actor.actor.id;
    const countdown = kind === "countdown";
    const event = { actor: actor.actor.id, kind };
    if (!countdown) this.emit("on_turn_start", event);
    this.mechanics.tick?.(actor, "owner_turn_start");
    this.mechanics.tick?.(actor, "source_turn_start");
    this.mechanics.tickDots?.(actor);
    if (!actor.alive) return;
    const forced = this.#forcedBasic(actor, "outrage") || this.#forcedBasic(actor, "dominate");
    const prevented = [...actor.modifiers.values()].some(mod => (mod as ModifierWithDefinition).model?.raw.prevent_action);
    if (!forced && !prevented) {
      const template = this.actorTemplate(actor.actor.id);
      const prior = this.mechanics.stateOf?.(actor) ?? this.#forms.current(actor);
      this.#turnConsumed = false;
      if (template.party === "enemy") {
        this.#enemyTurn(actor);
        this.#ultimateWindow(actor);
      } else {
        const summon = template.kind === "summon";
        const finalAction = !summon && countdown ? this.#forms.lastAction(actor) : undefined;
        const action = finalAction || this.#playerAction(actor, summon);
        if (action && !this.#turnConsumed) {
          this.execute(actor, action, { autoTarget: summon && template.summon?.control !== "manual" });
          if (!summon) {
            if (!finalAction) this.#ultimateWindow(actor);
            if (this.mechanics.onTurnActionEnd) this.mechanics.onTurnActionEnd(actor, prior);
            else this.#forms.countAction(actor, prior);
          }
        }
      }
    }
    if (!countdown) this.emit("on_turn_end", event);
    this.mechanics.tick?.(actor, "owner_turn_end");
    this.mechanics.tick?.(actor, "source_turn_end");
    this.state.turnCount += 1;
  }

  #elationMembers(): ActorState[] {
    return this.actors("player").filter(actor => this.actorTemplate(actor.actor.id).path === "elation");
  }

  #ahaSpeed(members: readonly ActorState[]): number {
    const weights = this.encounter.rules.constants.aha_speed_weights ?? [];
    return members.map(actor => this.panelOf(actor).stats.spd ?? actor.actor.stats.spd).sort((a, b) => b - a)
      .slice(0, weights.length)
      .reduce((total, speed, index) => total + speed * (weights[index] ?? 0),
        numericConstant(this.encounter.rules, "aha_speed_base"));
  }

  runAhaTurn(extraPool?: number): void {
    const members = this.#elationMembers().sort((a, b) =>
      (this.actorTemplate(a.actor.id).elationNumber || 9999) - (this.actorTemplate(b.actor.id).elationNumber || 9999));
    if (!members.length) return;
    for (const actor of members) {
      for (const mod of [...actor.modifiers.values()] as ModifierWithDefinition[]) {
        if (mod.controlKind && mod.dispellable !== false) this.removeModifier(actor, mod.id, "cleanse");
      }
    }
    const pool = extraPool ?? this.state.punchline;
    const event = { consumed: pool, extra: extraPool === undefined ? 0 : 1, actors: members.map(actor => actor.actor.id) };
    this.emit("aha_instant_start", event);
    for (const actor of members) {
      const action = this.actionsOf(actor).find(item => item.kind === "elation_skill" && this.actionAvailable(actor, item));
      if (action) this.execute(actor, action, { insert: true, tag: "aha", poolOverride: extraPool });
    }
    if (pool > 0) for (const actor of members) this.gainResource(actor, "certified_banger", pool);
    if (extraPool === undefined) this.state.punchline = 0;
    this.emit("aha_instant_end", event);
    const system = this.encounter.systemActors.find(actor => actor.turnHandler === "aha_turn" && this.state.actors.has(actor.id));
    if (system) {
      const speed = this.#ahaSpeed(members);
      if (Math.abs(speed - (this.scheduler.speedOf(system.id) ?? speed)) > 1e-9) this.scheduler.changeSpeed(system.id, speed);
    }
  }

  setup(): void {
    if (this.#prepared) return;
    this.#prepared = true;
    this.mechanics.prepareInitial?.();
    for (const state of this.state.actors.values()) {
      state.currentHp = this.panelOf(state).stats.hp ?? state.currentHp;
      const actor = this.actorTemplate(state.actor.id);
      for (const [id, declaration] of Object.entries(actor.resources)) state.resources.set(id, number(declaration.raw.current));
    }
    for (const system of this.encounter.systemActors) {
      if (system.speedRule && system.speedRule !== "aha") throw new Error("Unknown system speed rule " + system.speedRule);
      this.spawn(system.speedRule === "aha" ? { ...system, stats: {
        ...system.stats, spd: this.#ahaSpeed(this.#elationMembers()),
      }} : system);
    }
    this.#eventsEnabled = true;
    for (const grant of this.state.initialEnergyGrants(this.state.actors.values(), this.options.initialEnergyRatio)) {
      this.grantEnergy(grant.actor, grant.amount, { source: "initial_energy", reason: "initial_energy", errExempt: true });
    }
    const event = { encounter: this.encounter.stage.id };
    this.emit("before_battle_start", event);
    this.emit("on_battle_start", event);
  }

  #nextWave(): readonly CompiledActor[] | undefined { return this.options.laterWaves?.[this.#wave]; }

  advanceWave(): boolean {
    const next = this.#nextWave();
    if (!next || this.actors("enemy").length) return false;
    this.#wave += 1;
    for (const template of next) {
      this.spawn(template);
      this.emit("actor_enter", { actor: template.id, wave_index: this.#wave, actor_type: template.kind });
    }
    if (this.encounter.stage.cycle.reset_on_wave) {
      this.scheduler.resetActionGauge(true);
      this.state.resetCycleForWave();
    }
    this.emit("on_wave_start", { wave_index: this.#wave });
    return true;
  }

  #terminate(reason: TerminationReason): undefined {
    if (!this.#end) {
      this.#end = reason;
      this.emit("battle_end", { reason });
    }
  }

  step(): BattleStep | undefined {
    this.setup();
    if (this.#end) return undefined;
    this.advanceWave();
    if (!this.actors("player").length) return this.#terminate("all_allies_dead");
    const nextWave = this.#nextWave();
    if (!this.actors("enemy").length && !nextWave) return this.#terminate("target_killed");
    const limit = this.encounter.stage.maxActionValue;
    if (this.state.clock >= limit && !nextWave) return this.#terminate("max_action_value_reached");
    const maxCycles = number((this.encounter.stage.cycle as { max_cycles?: number }).max_cycles);
    if (maxCycles > 0 && this.state.cycleIndex > maxCycles) return this.#terminate("max_cycles");
    const turn = this.scheduler.nextActor();
    if (!turn) throw new Error("Battle has no scheduled actor");
    const { actor: template, kind, time } = turn;
    if (kind === "normal_extra") this.emit("on_extra_turn", { actor: template.id });
    if (time > limit && !nextWave) return this.#terminate("max_action_value_reached");
    this.state.advanceClock(time, cycle => {
      this.emit(cycle.kind === "start" ? "on_cycle_start" : "on_cycle_end", {
        cycle_index: cycle.index, ...(cycle.kind === "start" ? { budget: cycle.budget } : {}),
      });
    });
    const actor = this.state.actors.get(template.id)!;
    const skipped = !actor.alive;
    if (!skipped) {
      if (!template.turnHandler) this.#runTurn(actor, kind);
      else if (this.mechanics.runSystemTurn) this.mechanics.runSystemTurn(actor, template);
      else if (template.turnHandler === "aha_turn") this.runAhaTurn();
      else throw new Error("Unknown system turn handler " + template.turnHandler);
    }
    return { actorId: template.id, kind, clock: time, skipped };
  }

  run(): BattleState {
    this.setup();
    for (let turn = 0; turn < (this.options.maxTurns ?? TURN_LIMIT); ++turn) {
      if (this.step() === undefined) return this.state;
    }
    this.state.truncated = true;
    this.#terminate("max_turns");
    return this.state;
  }
}
