// Public report preserves the event attribution and row limits of Lotus's Python timeline.
import panelCharacterNames from "../../../challenge-character-names.json";
import type { TeamBattleResult } from "../../../team-damage-runtime.ts";
import { evaluate, parse } from "../rules/expression.ts";
import type { BattleEvent, Payload } from "./contracts.ts";
import type { BattleRunner } from "./runner.ts";

const actionLabels: Readonly<Record<string, string>> = {
  basic: "普攻", skill: "战技", ultimate: "终结技", follow_up: "追加攻击",
  elation_skill: "欢愉技", memosprite_skill: "忆灵技", assist: "助战技", technique: "秘技",
};
const knownApproximations: Readonly<Record<string, string>> = {
  "1220": "终结技视为追加攻击等细节未完整计入。",
  "1112": "账账继承托帕攻击力和部分暴击伤害效果按近似规则计算。",
};

const onePlace = parse("round(value, 1)");
function roundOne(value: number): number {
  return evaluate<number>(onePlace, { context: { value }, trace: false }).value;
}
const damageNumber = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function formatDamage(value: number): string { return damageNumber.format(roundOne(value)); }

function label(value: unknown, fallback?: string): string | undefined {
  return typeof value === "string" && /[\u3400-\u9fff]/u.test(value) && !/[A-Za-z_]/u.test(value) ? value : fallback;
}

interface Row {
  readonly title: string;
  readonly actionPoint: number;
  label: string;
  readonly hits: Map<string, number>;
}
function text(event: Payload, key: string): string {
  return typeof event[key] === "string" ? event[key] : event[key] == null ? "" : String(event[key]);
}

function publicTimeline(events: readonly BattleEvent[], runner: BattleRunner,
  contributors: ReadonlyMap<string, string>): Pick<TeamBattleResult, "actions" | "turns"> {
  const summons = new Map<string, string>();
  const names = new Map<string, string>();
  for (const def of runner.encounter.summons.values()) {
    if (!def.ownerId || !contributors.has(def.ownerId)) continue;
    summons.set(def.id, def.ownerId);
    names.set(def.id, label(def.name, "召唤物")!);
  }
  const allies = new Set([...contributors.keys(), ...summons.keys(), ...runner.encounter.systemActors.map(actor => actor.id)]);
  for (const [id, name] of contributors) names.set(id, name);
  for (const id of runner.state.actors.keys()) {
    if (!names.has(id)) {
      names.set(id, label(runner.actorTemplate(id).name, summons.has(id) ? "召唤物" : "目标")!);
    }
  }
  const name = (id: string, fallback = "队员") => names.get(id) ?? fallback;
  const opening = new Map<string, { name: string; value: number }>();
  const rows: Row[] = [];
  const pending = new Map<string, Row>();
  const completed = new Map<string, { row: Row; skill?: string; actionType: string }>();
  const row = (title: string, actionPoint: number, outputLabel: string): Row => {
    const entry = { title, actionPoint, label: outputLabel, hits: new Map<string, number>() };
    rows.push(entry);
    return entry;
  };

  for (const { kind, time, payload } of events) {
    if (kind !== "on_turn_start" && kind !== "actor_enter" && kind !== "on_cycle_start" && kind !== "on_wave_start"
      && kind !== "on_state_change" && kind !== "on_break" && kind !== "on_action" && kind !== "after_being_hit") continue;
    const av = roundOne(time);
    const actor = text(payload, "actor");
    if (kind === "on_turn_start" && contributors.has(actor)) {
      if (!opening.has(actor)) opening.set(actor, { name: name(actor), value: av });
    } else if (kind === "actor_enter" && summons.has(actor) && payload.reason === "summon") {
      row(name(summons.get(actor)!), av, "召唤 · " + name(actor, "召唤物") + "登场");
    } else if (kind === "on_cycle_start") {
      row("战斗轮次", av, "第 " + text(payload, "cycle_index") + " 轮开始");
    } else if (kind === "on_wave_start" && Number(payload.wave_index) > 0) {
      row("敌人波次", av, "第 " + (Number(payload.wave_index) + 1) + " 波敌人登场");
    } else if (kind === "on_state_change" && allies.has(actor)) {
      const entering = Boolean(payload.to_state);
      const config = runner.actorTemplate(actor).stateConfig?.raw;
      const state = entering ? payload.to_state : payload.from_state;
      const display = config && config.state === state ? label(config.name) : undefined;
      row(name(actor), av, (entering ? "进入" : "退出") + (display ? "「" + display + "」" : "强化状态"));
    } else if (kind === "on_break" && allies.has(text(payload, "source"))) {
      row(name(text(payload, "source")), av, "击破弱点 · " + name(text(payload, "target"), "目标"));
    } else if (kind === "on_action" || kind === "after_being_hit") {
      const source = kind === "on_action" ? actor : text(payload, "source");
      if (!allies.has(source)) continue;
      const actionType = text(payload, "action_type");
      const actionId = text(payload, "action_id");
      const category = actionLabels[actionType] ?? (kind === "on_action" ? "行动" : "伤害结算");
      const actionKey = JSON.stringify([av, source, actionId || actionType]);
      const sourceKey = JSON.stringify([av, source]);
      if (kind === "on_action") {
        const action = runner.encounter.actionsByActor.get(source)?.find(item => item.id === actionId);
        const skill = label(action?.name);
        const shown = skill ? category + " · " + skill : category;
        const entry = pending.get(actionKey) ?? row(name(source), av, shown);
        pending.delete(actionKey);
        entry.label = shown;
        completed.set(sourceKey, { row: entry, skill, actionType });
      } else if (Number(payload.amount) > 0) {
        let entry = pending.get(actionKey);
        if (!entry && actionId.startsWith("hook_")) {
          const previous = completed.get(sourceKey);
          const hook = actionId.slice(5).split("·")[0];
          if (previous && (hook === previous.skill || actionType === "ultimate" && previous.actionType === actionType)) {
            entry = previous.row;
          }
        }
        if (!entry) {
          entry = row(name(source), av, "伤害结算");
          pending.set(actionKey, entry);
        }
        const target = text(payload, "target");
        entry.hits.set(target, (entry.hits.get(target) ?? 0) + Number(payload.amount));
      }
    }
  }

  return {
    actions: [...opening.values()].slice(0, 12),
    turns: rows.slice(0, 36).map(entry => {
      const lines = [entry.label];
      if (entry.hits.size) {
        const total = [...entry.hits.values()].reduce((sum, amount) => sum + amount, 0);
        const summary = "造成 " + formatDamage(total) + " 点伤害";
        lines.push(summary + (entry.hits.size > 1 ? " · 命中 " + entry.hits.size + " 个目标" : ""));
        for (const [target, amount] of entry.hits) lines.push(name(target, "目标") + "受到 " + formatDamage(amount) + " 点伤害");
      }
      return { title: entry.title, actionPoint: entry.actionPoint, lines: lines.slice(0, 8) };
    }),
  };
}

export function reportBattle(runner: BattleRunner, cycles: number,
  notices: readonly string[] = []): TeamBattleResult | { error: "limit" } {
  if (runner.state.truncated) return { error: "limit" };
  const contributors = new Map(runner.encounter.team.map(actor =>
    [actor.id, actor.id === "1224" ? panelCharacterNames["1224"] : actor.name]));
  const amounts = new Map([...contributors.keys()].map(id => [id, 0]));
  for (const [id, damage] of runner.state.damageByActor) {
    const unit = runner.state.actors.get(id);
    const actor = unit ? runner.actorTemplate(id) : undefined;
    const owner = actor?.ownerId || runner.encounter.summons.get(id)?.ownerId;
    const target = owner && contributors.has(owner) ? owner : id;
    const previous = amounts.get(target);
    if (previous !== undefined) amounts.set(target, previous + damage);
    else if (damage > 0 && actor && actor.kind !== "monster") {
      contributors.set(id, label(actor.name, "助战单位")!);
      amounts.set(id, damage);
    }
  }
  const notes = new Map<string, string>();
  for (const caveat of runner.encounter.caveats) {
    const id = text(caveat, "actor");
    const ref = text(caveat, "ref");
    if (contributors.has(id) && ref.startsWith("characters/")) {
      notes.set(id, contributors.get(id) + "：" + (knownApproximations[id] ?? "部分角色机制按近似规则计算。"));
    } else if (ref.startsWith("light_cones/") || ref.startsWith("relics/")) {
      notes.set("gear", "部分光锥或遗器的条件效果按近似规则计算。");
    } else {
      notes.set("other", "部分触发条件按近似规则计算。");
    }
  }
  const damage = [...amounts].sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ name: contributors.get(id)!, value }));
  const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0);
  return { total, dps: total / cycles, damage, ...publicTimeline(runner.events, runner, contributors),
    warnings: [...new Set([...notices, ...notes.values()])].slice(0, 8) };
}
