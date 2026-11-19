// Static Star Rail panel math adapted from miao-plugin's models/attr/{Attr,AttrData}.js,
// models/Character.js, models/Weapon.js and models/artis/ArtisAttr.js.
import staticRules from "./panel-theme/static-panel-rules.json";
import { object, type PanelAvatar } from "./panel-model.ts";

type Json = Record<string, unknown>;
type Attribute = { key: string; value: number; rolls?: number };
type Relic = PanelAvatar["relics"][number];

const primary = ["hp", "atk", "def", "speed"] as const;
const percentages = ["recharge", "cpct", "cdmg", "dmg", "heal", "stance", "effPct", "effDef", "joy"] as const;
const elementKeys = new Set(["phy", "fire", "ice", "elec", "wind", "quantum", "imaginary"]);
export const damageAttribute: Readonly<Record<string, string>> = {
  物理: "phy", 火: "fire", 冰: "ice", 雷: "elec", 风: "wind", 量子: "quantum", 虚数: "imaginary",
};
const staticCones: Readonly<Record<string, readonly { key: string; idx: string }[]>> = staticRules.cones;
const staticSets: Readonly<Record<string, unknown>> = staticRules.sets;
const ascensions = [20, 30, 40, 50, 60, 70];

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatPanelAttribute(value: number, ratio: boolean) {
  return `${Number(value.toFixed(ratio ? 2 : 1))}${ratio ? "%" : ""}`;
}

export function isFlatRelicAttribute(key: string) {
  return ["hpPlus", "atkPlus", "defPlus", "speed"].includes(key);
}

export function leveledAttributes(meta: Json, level: number | undefined, promotion: number | undefined, cone: boolean) {
  if (!level || (promotion === undefined && ascensions.includes(level))) return;
  const promote = promotion ?? ascensions.filter(step => level > step).length;
  const rows = meta.attr;
  const stats = object(Array.isArray(rows) ? rows[promote] : object(rows)?.[promote]);
  const bases = object(stats?.attrs);
  const growths = cone ? object(meta.growAttr) : object(stats?.grow);
  if (!bases || !growths) return;
  const result: Record<string, number> = {};
  for (const [key, base] of Object.entries(bases)) {
    const growth = growths[key] ?? 0;
    if (finite(base) && finite(growth)) result[key] = base + growth * (level - 1);
  }
  return result;
}

export function readLegacyRelicAttributes(part: Relic, meta: Json) {
  if (!part.legacyMainId || part.rarity === undefined || part.level === undefined || !part.legacySubIds) return;
  const star = object(object(meta.starData)?.[part.rarity]);
  const key = object(object(meta.mainIdx)?.[part.slot])?.[part.legacyMainId];
  if (typeof key !== "string") return;
  const main = object(object(star?.main)?.[key]);
  if (!main || !finite(main.base) || !finite(main.step)) return;
  const sub: Attribute[] = [];
  for (const entry of part.legacySubIds) {
    const match = /^(\d{1,3}),(\d{1,2}),(-?\d{1,2})$/u.exec(entry);
    const cfg = match?.[1] && object(object(star?.sub)?.[match[1]]);
    if (!match || !cfg || typeof cfg.key !== "string" || !finite(cfg.base) || !finite(cfg.step)) return;
    const rolls = Number(match[2]);
    sub.push({ key: cfg.key, value: cfg.base * rolls + cfg.step * Number(match[3]), rolls });
  }
  return { main: { key, value: main.base + main.step * part.level }, sub };
}

type PanelAttributeMetadata = {
  readonly character: Json;
  readonly cone: Json;
  readonly conePath: string;
  readonly relicMetadata: Json;
  readonly setForId: (id: string) => string | undefined;
};

export function calculateManagedElation(avatar: PanelAvatar, { character, cone, setForId }: PanelAttributeMetadata) {
  const trees = object(character.tree);
  if (!trees) return;
  const traces = new Map(avatar.traces.map(trace => [trace.id, trace.active]));
  const base = object(character.baseAttr)?.joy;
  let joy = finite(base) ? base : 0;
  for (const [id, entry] of Object.entries(trees)) {
    const trace = object(entry);
    if (trace?.key !== "joy") continue;
    if (!traces.has(id) || !finite(trace.value)) return;
    if (traces.get(id)) joy += trace.value;
  }
  if (avatar.cone) {
    const rules = staticCones[avatar.cone.id];
    if (!rules) return;
    const tables = object(object(cone.skill)?.tables);
    for (const { key, idx } of rules) {
      if (key !== "joy") continue;
      const values = tables?.[idx];
      const value = avatar.cone.rank && Array.isArray(values) ? values[avatar.cone.rank - 1] : undefined;
      if (!finite(value)) return;
      joy += value;
    }
  }
  const sets = new Map<string, number>();
  for (const relic of avatar.relics) {
    const name = setForId(relic.id);
    if (!name || !Object.hasOwn(staticSets, name)) return;
    sets.set(name, (sets.get(name) ?? 0) + 1);
  }
  for (const [name, count] of sets) {
    const bonuses = object(staticSets[name]);
    for (const threshold of [2, 4]) {
      const value = object(bonuses?.[threshold])?.joy;
      if (count >= threshold && finite(value)) joy += value;
    }
  }
  return joy;
}

export function calculateLegacyPanelAttributeRows(avatar: PanelAvatar, {
  character, cone, conePath, relicMetadata, setForId,
}: PanelAttributeMetadata) {
  if (!avatar.legacy?.dataComplete || !["mysPanelHSR", "homo", "EnkaHSR"].includes(avatar.legacy.source)) return;
  const charStats = leveledAttributes(character, avatar.level, avatar.legacy.promote, false);
  if (!charStats || primary.some(key => !finite(charStats[key]))) return;
  const trees = object(character.tree);
  if (!trees) return;
  const element = damageAttribute[avatar.element] ?? damageAttribute[String(character.elem ?? "")];
  if (!element) return;

  const base = new Map<string, number>(Object.entries(charStats));
  const flat = new Map<string, number>();
  const multipliers = new Map<string, number>();
  function add(key: string, value: number) {
    if (elementKeys.has(key)) {
      if (key === element) key = "dmg";
      else return;
    }
    if (key === "speedBase") {
      base.set("speed", (base.get("speed") ?? 0) + value);
      return;
    }
    const multiplier = /^(hp|atk|def|speed)Pct$/u.exec(key);
    const name = multiplier?.[1] || key.replace(/Plus$/u, "");
    const target = multiplier ? multipliers : flat;
    target.set(name, (target.get(name) ?? 0) + value);
  }

  for (const trace of avatar.traces) {
    if (!trace.active) continue;
    const cfg = object(trees[trace.id]);
    if (cfg && typeof cfg.key === "string" && finite(cfg.value)) {
      add(["hp", "atk", "def"].includes(cfg.key) ? `${cfg.key}Pct` : cfg.key, cfg.value);
    }
  }

  if (avatar.cone) {
    const stats = leveledAttributes(cone, avatar.cone.level, avatar.cone.promote, true);
    const rules = staticCones[avatar.cone.id];
    if (!stats || !rules || !["hp", "atk", "def"].every(key => finite(stats[key]))) return;
    for (const [key, stat] of Object.entries(stats)) base.set(key, (base.get(key) ?? 0) + stat);
    if (conePath === character.weapon) {
      const tables = object(object(cone.skill)?.tables);
      for (const { key, idx } of rules) {
        const values = tables?.[idx];
        const value = avatar.cone.rank && Array.isArray(values) ? values[avatar.cone.rank - 1] : undefined;
        if (!finite(value)) return;
        add(key, value);
      }
    }
  }

  const equippedSets = new Map<string, number>();
  const slots = new Set<number>();
  for (const part of avatar.relics) {
    const attrs = readLegacyRelicAttributes(part, relicMetadata);
    const setName = setForId(part.id);
    if (!attrs || !setName || !Object.hasOwn(staticSets, setName) || slots.has(part.slot)) return;
    slots.add(part.slot);
    equippedSets.set(setName, (equippedSets.get(setName) ?? 0) + 1);
    for (const { key, value } of [attrs.main, ...attrs.sub]) {
      add(["hp", "atk", "def"].includes(key) ? key + "Pct" : key, value);
    }
  }
  for (const [set, count] of equippedSets) {
    const bonuses = object(staticSets[set]);
    for (const threshold of [2, 4]) {
      if (count < threshold) continue;
      const values = object(bonuses?.[threshold]) ?? {};
      for (const [key, value] of Object.entries(values)) if (finite(value)) add(key, value);
    }
  }

  return [...primary, ...percentages].map(key => {
    const initial = base.get(key) ?? 0;
    const total = initial * (1 + (multipliers.get(key) ?? 0) / 100) + (flat.get(key) ?? 0);
    const ratio = percentages.some(value => value === key);
    return { key: key === "dmg" ? element : key, base: initial, value: total, ratio };
  });
}

export function calculateLegacyPanelAttributes(
  ...args: Parameters<typeof calculateLegacyPanelAttributeRows>
): PanelAvatar["stats"] | undefined {
  return calculateLegacyPanelAttributeRows(...args)?.map(({ key, base, value, ratio }) => ({
    key, base: formatPanelAttribute(base, ratio), value: formatPanelAttribute(value, ratio),
  }));
}
