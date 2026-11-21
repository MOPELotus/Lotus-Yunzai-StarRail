// HSR Nous compilation model, adapted from its MIT-licensed engine at the pinned revision in UPSTREAM.md.
import type { PreparedExpression } from "../rules/expression.ts";
import type { CycleRule, Rulebook, RuleValues } from "../rules/rulebook.ts";
import type { ExpressionCompiler, SkillLevels } from "../rules/schema.ts";

export type TemplateVersion = "enhanced" | "legacy";
export type TemplateKind = "characters" | "light_cones" | "relics" | "enemies";
export type Numbers = Readonly<Record<string, number>>;
export type Party = "player" | "enemy";

export interface Mechanic {
  readonly raw: RuleValues;
  readonly expressions: ReadonlyMap<string, PreparedExpression>;
}
export interface CompiledAction extends Mechanic {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly target: string;
  readonly damageType?: string;
  readonly levelKey: string;
  readonly scaling: readonly Numbers[];
  readonly scalingBlast: readonly Numbers[];
}
export interface CompiledHook extends Mechanic {
  readonly ownerId: string;
  readonly event: string;
  readonly effects: readonly Mechanic[];
  readonly source: string;
  readonly accumulated: boolean;
  readonly flushTriggers: readonly string[];
  readonly targetFilter?: PreparedExpression;
  readonly condition?: PreparedExpression;
}
export interface InitialModifier extends Mechanic {
  readonly id: string;
  readonly name: string;
  readonly statEffects: Numbers;
}
export interface CompiledStats extends Numbers {
  readonly hp: number;
  readonly atk: number;
  readonly def_: number;
  readonly spd: number;
  readonly max_energy: number;
  readonly max_toughness: number;
}
export interface CompiledActor extends Mechanic {
  readonly id: string;
  readonly ownerId?: string;
  readonly name: string;
  readonly party: Party;
  readonly kind: string;
  readonly level: number;
  readonly rank: number;
  readonly path: string;
  readonly element: string;
  readonly groups: readonly string[];
  readonly elationNumber: number;
  readonly systemFlags: readonly string[];
  readonly speedRule?: string;
  readonly turnHandler?: string;
  readonly summon?: {
    readonly inheritance: string | readonly string[];
    readonly maxHpRatio: number;
    readonly control: string;
    readonly capabilities: Readonly<Record<string, boolean>>;
  };
  readonly stats: CompiledStats;
  readonly damageBonus: Numbers;
  readonly resistance: Numbers;
  readonly weakness: readonly string[];
  readonly toughnessBars: readonly number[];
  readonly skillLevels: SkillLevels;
  readonly actions: readonly CompiledAction[];
  readonly hooks: readonly CompiledHook[];
  readonly resources: Readonly<Record<string, Mechanic>>;
  readonly bindingParams: Numbers;
  readonly modifiers: readonly InitialModifier[];
  readonly stateConfig?: Mechanic;
  readonly summons: readonly CompiledActor[];
  readonly techniques: readonly Mechanic[];
}
export interface CompiledPolicyRule extends Mechanic {
  readonly action: string;
  readonly priority: number;
  readonly condition?: PreparedExpression;
}
export interface CompiledPolicy {
  readonly mode: "rule_based";
  readonly ultimateTiming: "after_action";
  readonly actionRules: readonly CompiledPolicyRule[];
  readonly enemyRules: ReadonlyMap<string, Mechanic>;
}
export interface CompiledStage {
  readonly id: string;
  readonly mode: string;
  readonly terminationMode: "fixed_av";
  readonly maxActionValue: number;
  readonly cycle: CycleRule;
  readonly enemies: readonly CompiledActor[];
}
export interface CompiledEncounter {
  readonly team: readonly CompiledActor[];
  readonly stage: CompiledStage;
  readonly systemActors: readonly CompiledActor[];
  readonly summons: ReadonlyMap<string, CompiledActor>;
  readonly actionsByActor: ReadonlyMap<string, readonly CompiledAction[]>;
  readonly hooks: readonly CompiledHook[];
  readonly policy: CompiledPolicy;
  readonly caveats: readonly RuleValues[];
  readonly rules: Rulebook;
  readonly expr: ExpressionCompiler;
}
export interface RelicSlot {
  readonly set?: string;
  readonly main?: string;
  readonly mainValue?: number;
  readonly subs?: Numbers;
}
export interface ActorBuild {
  readonly id: string;
  readonly version?: TemplateVersion;
  readonly level?: number;
  readonly rank?: number;
  readonly skillLevels?: SkillLevels;
  readonly whiteStats?: Numbers;
  readonly cone?: {
    readonly id: string;
    readonly rank: number;
    readonly base?: Numbers;
    readonly active: boolean;
  };
  readonly relics?: readonly RelicSlot[];
}
export interface EnemyBuild {
  readonly template: string;
  readonly id: string;
  readonly name?: string;
}
export interface StageBuild {
  readonly id: string;
  readonly mode: string;
  readonly maxActionValue: number;
  readonly enemies: readonly EnemyBuild[];
}
export interface EncounterBuild {
  readonly team: readonly ActorBuild[];
  readonly stage: StageBuild;
  readonly actionRules?: readonly RuleValues[];
}
