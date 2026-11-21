import type { ActorState, DamageInput, EffectivePanel } from "../combat/index.ts";
import type { CompiledAction, CompiledActor, Mechanic } from "../compile/types.ts";
import type { BattleRunner } from "./runner.ts";

export type Payload = Readonly<Record<string, unknown>>;
export type Waterfall = Record<string, unknown>;
export interface BattleEvent {
  readonly kind: string;
  readonly time: number;
  readonly payload: Payload;
}
export type ModifierAnchor = "owner_turn_start" | "owner_turn_end" | "source_turn_start" | "source_turn_end" | "on_action";

export interface ActionOptions {
  readonly insert?: boolean;
  readonly forcedTarget?: ActorState;
  readonly tag?: string;
  readonly poolOverride?: number;
}
export interface ActionResult {
  readonly target: ActorState | undefined;
  readonly spentSkillPoints: number;
}
export interface EnergySource {
  readonly source: string;
  readonly actionId?: string;
  readonly reason: string;
  readonly errExempt?: boolean;
}

export interface BattleMechanics {
  prepareInitial?(): void;
  onEvent?(kind: string, payload: Payload): void;
  waterfall?(kind: string, payload: Waterfall): Waterfall | void;
  panelOf?(actor: ActorState): EffectivePanel;
  scopedBoost?: NonNullable<DamageInput["scopedBoost"]>;
  tick?(actor: ActorState, anchor: ModifierAnchor): void;
  tickDots?(actor: ActorState): void;
  applyActionEffects?(actor: ActorState, action: CompiledAction): void;
  removeModifier?(actor: ActorState, id: string, reason: string): void;
  absorbHit?(target: ActorState, amount: number, source: ActorState): number;
  checkDeath?(target: ActorState, sourceId: string, actionId: string): void;
  actionAvailability?(actor: ActorState, action: CompiledAction): boolean;
  gainResource?(actor: ActorState, id: string, amount: number, sourceId?: string): void;
  onDamageEvent?<T>(fn: () => T): T;
  enterUltimateState?(caster: ActorState, action: CompiledAction): "entered" | "already" | undefined;
  runSystemTurn?(actor: ActorState, template: CompiledActor): void;
  onBreak?(source: ActorState, target: ActorState, element: string): void;
  onTurnActionEnd?(actor: ActorState, stateAtStart: unknown): void;
  filterActions?(actor: ActorState, actions: readonly CompiledAction[]): readonly CompiledAction[];
  stateOf?(actor: ActorState): unknown;
  onActorSpawn?(actor: ActorState, template: CompiledActor): void;
  applyModifier?(target: ActorState, definition: Mechanic, source: ActorState): void;
  policyContext?(actor: ActorState): Payload;
}

export type MechanicFactory = (runner: BattleRunner) => BattleMechanics;
export type BattleParty = "player" | "enemy";
export type TerminationReason = "all_allies_dead" | "target_killed" | "max_action_value_reached" | "max_cycles" | "max_turns";

export interface RunnerOptions {
  readonly mode?: "expected" | "roll";
  readonly rng?: () => number;
  readonly maxTurns?: number;
  readonly initialSkillPoints?: number;
  readonly initialEnergyRatio?: number;
  readonly laterWaves?: readonly (readonly CompiledActor[])[];
}
