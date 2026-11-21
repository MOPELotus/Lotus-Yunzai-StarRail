// Default scripted/compiled target resolution follows HSR_Nous 00185dd (MIT).
import type { ActorState, CombatModifier } from "../combat/index.ts";
import type { CompiledAction } from "../compile/types.ts";
import type { BattleRunner } from "./runner.ts";

export interface Targets {
  readonly primary?: ActorState;
  readonly members: readonly ActorState[];
}

type TargetModifier = CombatModifier & {
  readonly lockOn?: boolean;
  readonly forcedTaunt?: boolean;
  readonly dotElement?: string;
};
const DOT_ELEMENTS: Readonly<Record<string, string>> = { shock: "thunder", wind_shear: "wind", burn: "fire", bleed: "physical" };

export function isBlast(target: string): boolean {
  return target === "blast" || target === "bounce_blast";
}

function around(primary: ActorState | undefined, pool: readonly ActorState[], type: string): Targets {
  if (!primary) return { members: [] };
  if (type === "aoe" || type === "ally_aoe") return { primary, members: pool };
  if (!isBlast(type)) return { primary, members: [primary] };
  const i = pool.indexOf(primary);
  return { primary, members: i < 0 ? [primary] : pool.slice(Math.max(0, i - 1), i + 2) };
}

function forcedTaunt(runner: BattleRunner, source: ActorState, candidates: readonly ActorState[]): ActorState | undefined {
  for (const mod of source.modifiers.values() as Iterable<TargetModifier>) {
    const issuer = mod.forcedTaunt && mod.sourceId ? runner.state.actors.get(mod.sourceId) : undefined;
    if (issuer && candidates.includes(issuer)) return issuer;
  }
}

function preferred(runner: BattleRunner, source: ActorState, action: CompiledAction,
  candidates: readonly ActorState[]): ActorState | undefined {
  const spec = action.raw.prefer_target;
  if (spec === "owner_last_target") {
    const owner = runner.actorTemplate(source.actor.id).ownerId;
    const last = owner && runner.lastTargetByActor.get(owner);
    return candidates.find(candidate => candidate.actor.id === last);
  }
  if (typeof spec !== "string" || !spec.startsWith("dot:")) return;
  const element = DOT_ELEMENTS[spec.slice(4)];
  if (!element) return;
  return candidates.find(candidate => [...candidate.modifiers.values()].some(mod =>
    mod.type === "dot" && (mod as TargetModifier).dotElement === element));
}

function enemyTarget(runner: BattleRunner, source: ActorState, candidates: readonly ActorState[]): ActorState | undefined {
  const taunter = forcedTaunt(runner, source, candidates);
  if (taunter) return taunter;
  const locked = candidates.find(actor => [...actor.modifiers.values()].some(mod => (mod as TargetModifier).lockOn));
  if (locked) return locked;
  const weights = candidates.map(actor => {
    if (runner.actorTemplate(actor.actor.id).summon?.capabilities.taunt === false) return 0;
    const panel = runner.panelOf(actor).stats;
    return panel.taunt_eff ?? (panel.taunt ?? 100) * (1 + (panel.aggro_boost ?? 0));
  });
  if (runner.mode === "roll" && runner.rng && candidates.length) {
    let roll = runner.rng() * weights.reduce((sum, weight) => sum + weight, 0);
    for (const [index, weight] of weights.entries()) {
      roll -= weight;
      if (roll < 0) return candidates[index];
    }
    return candidates.at(-1);
  }
  let best = -Infinity;
  let picked: ActorState | undefined;
  for (const [index, weight] of weights.entries()) {
    if (weight <= best) continue;
    best = weight;
    picked = candidates[index];
  }
  return picked;
}

export function resolveTargets(runner: BattleRunner, source: ActorState, action: CompiledAction,
  forced?: ActorState): Targets {
  const type = action.target;
  if (forced && !forced.alive) return { members: [] };
  if (type === "self") return { primary: source, members: [source] };
  const enemy = runner.actorTemplate(source.actor.id).party === "enemy";
  const allied = type === "ally_single" || type === "ally_aoe";
  const pool = enemy !== allied ? runner.actors("player") : runner.actors("enemy");
  const candidates = pool.filter(target => {
    if (allied && (forced || enemy) || forced && enemy) return true;
    const flags = runner.actorTemplate(target.actor.id).summon?.capabilities;
    return flags?.[allied ? "ally_targetable" : "enemy_targetable"] !== false;
  });
  if (forced) return candidates.includes(forced) ? around(forced, candidates, type) : { members: [] };
  if (type === "aoe" || type === "ally_aoe") return around(candidates[0], candidates, type);
  if (allied && !enemy) return around(source, candidates, type);

  const taunter = enemy ? undefined : forcedTaunt(runner, source, candidates);
  if (taunter) return around(taunter, candidates, type);
  if (type === "bounce" || type === "bounce_blast") {
    const index = runner.mode === "roll" && runner.rng ? Math.floor(runner.rng() * candidates.length) : 0;
    return around(candidates[index], candidates, type);
  }
  const pick = preferred(runner, source, action, candidates)
    ?? (enemy ? enemyTarget(runner, source, candidates) : candidates[0]);
  return around(pick, candidates, type);
}
