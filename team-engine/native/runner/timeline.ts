import { createTranslator as createTextTranslator } from "../../../../../packages/i18n/index.ts";
import messageCatalog from "../../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
// Public report preserves the event attribution and row limits of Lotus's Python timeline.
import panelCharacterNames from "../../../challenge-character-names.json";
import type { TeamBattleResult } from "../../../team-damage-runtime.ts";
import { evaluate, parse } from "../rules/expression.ts";
import type { BattleEvent, Payload } from "./contracts.ts";
import type { BattleRunner } from "./runner.ts";

const actionLabels: Readonly<Record<string, string>> = {
  basic: $t("team-engine.native.runner.timeline.text_8b79df27ba"), skill: $t("team-engine.native.runner.timeline.text_6d8c868f52"), ultimate: $t("team-engine.native.runner.timeline.text_a985bc32b7"), follow_up: $t("team-engine.native.runner.timeline.text_28960b911a"),
  elation_skill: $t("team-engine.native.runner.timeline.text_a9613395e7"), memosprite_skill: $t("team-engine.native.runner.timeline.text_79bd79472f"), assist: $t("team-engine.native.runner.timeline.text_bde5b0a97f"), technique: $t("team-engine.native.runner.timeline.text_4bd90c6477"),
};
const knownApproximations: Readonly<Record<string, string>> = {
  "1220": $t("team-engine.native.runner.timeline.text_cc703ae0a0"),
  "1112": $t("team-engine.native.runner.timeline.text_fde71418d5"),
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
    names.set(def.id, label(def.name, $t("team-engine.native.runner.timeline.text_3c58afb55c"))!);
  }
  const allies = new Set([...contributors.keys(), ...summons.keys(), ...runner.encounter.systemActors.map(actor => actor.id)]);
  for (const [id, name] of contributors) names.set(id, name);
  for (const id of runner.state.actors.keys()) {
    if (!names.has(id)) {
      names.set(id, label(runner.actorTemplate(id).name, summons.has(id) ? $t("team-engine.native.runner.timeline.text_3c58afb55c") : $t("team-engine.native.runner.timeline.text_57060c88a3"))!);
    }
  }
  const name = (id: string, fallback = $t("team-engine.native.runner.timeline.text_6f3a9f7421")) => names.get(id) ?? fallback;
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
      row(name(summons.get(actor)!), av, $t("team-engine.native.runner.timeline.text_c0fec559c9") + name(actor, $t("team-engine.native.runner.timeline.text_3c58afb55c")) + $t("team-engine.native.runner.timeline.text_989ba36a73"));
    } else if (kind === "on_cycle_start") {
      row($t("team-engine.native.runner.timeline.text_a3205a2a50"), av, $t("team-engine.native.runner.timeline.text_9552fe3bd3") + text(payload, "cycle_index") + $t("team-engine.native.runner.timeline.text_ea318ce106"));
    } else if (kind === "on_wave_start" && Number(payload.wave_index) > 0) {
      row($t("team-engine.native.runner.timeline.text_73632ab84c"), av, $t("team-engine.native.runner.timeline.text_9552fe3bd3") + (Number(payload.wave_index) + 1) + $t("team-engine.native.runner.timeline.text_b561c4fc73"));
    } else if (kind === "on_state_change" && allies.has(actor)) {
      const entering = Boolean(payload.to_state);
      const config = runner.actorTemplate(actor).stateConfig?.raw;
      const state = entering ? payload.to_state : payload.from_state;
      const display = config && config.state === state ? label(config.name) : undefined;
      row(name(actor), av, (entering ? $t("team-engine.native.runner.timeline.text_f88182fcd5") : $t("team-engine.native.runner.timeline.text_498e1d59b4")) + (display ? "「" + display + "」" : $t("team-engine.native.runner.timeline.text_215495f806")));
    } else if (kind === "on_break" && allies.has(text(payload, "source"))) {
      row(name(text(payload, "source")), av, $t("team-engine.native.runner.timeline.text_fd4f0bcd90") + name(text(payload, "target"), $t("team-engine.native.runner.timeline.text_57060c88a3")));
    } else if (kind === "on_action" || kind === "after_being_hit") {
      const source = kind === "on_action" ? actor : text(payload, "source");
      if (!allies.has(source)) continue;
      const actionType = text(payload, "action_type");
      const actionId = text(payload, "action_id");
      const category = actionLabels[actionType] ?? (kind === "on_action" ? $t("team-engine.native.runner.timeline.text_253fb75906") : $t("team-engine.native.runner.timeline.text_051f03a7be"));
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
          entry = row(name(source), av, $t("team-engine.native.runner.timeline.text_051f03a7be"));
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
        const summary = $t("team-engine.native.runner.timeline.text_9863bfdb7b") + formatDamage(total) + $t("team-engine.native.runner.timeline.text_cd07575758");
        lines.push(summary + (entry.hits.size > 1 ? $t("team-engine.native.runner.timeline.text_6015819aab") + entry.hits.size + $t("team-engine.native.runner.timeline.text_bfccaf26c2") : ""));
        for (const [target, amount] of entry.hits) lines.push(name(target, $t("team-engine.native.runner.timeline.text_57060c88a3")) + $t("team-engine.native.runner.timeline.text_22df40c9a4") + formatDamage(amount) + $t("team-engine.native.runner.timeline.text_cd07575758"));
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
      contributors.set(id, label(actor.name, $t("team-engine.native.runner.timeline.text_7f1723b231"))!);
      amounts.set(id, damage);
    }
  }
  const notes = new Map<string, string>();
  for (const caveat of runner.encounter.caveats) {
    const id = text(caveat, "actor");
    const ref = text(caveat, "ref");
    if (contributors.has(id) && ref.startsWith("characters/")) {
      notes.set(id, contributors.get(id) + "：" + (knownApproximations[id] ?? $t("team-engine.native.runner.timeline.text_b5578a00b4")));
    } else if (ref.startsWith("light_cones/") || ref.startsWith("relics/")) {
      notes.set("gear", $t("team-engine.native.runner.timeline.text_5a4c39f0cc"));
    } else {
      notes.set("other", $t("team-engine.native.runner.timeline.text_b885777d5a"));
    }
  }
  const damage = [...amounts].sort((a, b) => b[1] - a[1]).map(([id, value]) => ({ name: contributors.get(id)!, value }));
  const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0);
  return { total, dps: total / cycles, damage, ...publicTimeline(runner.events, runner, contributors),
    warnings: [...new Set([...notices, ...notes.values()])].slice(0, 8) };
}
