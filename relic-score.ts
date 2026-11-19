// Star Rail portion of miao-plugin's models/artis/{ArtisMark,ArtisMarkCfg}.js.
// Licensed MIT. Original rules and assets are recorded in README.md.
import baseStats from "./panel-theme/relic-character-base.json";
import defaultValues from "./panel-theme/relic-values.json";
import { usefulAttr } from "./panel-theme/relic-weights.js";
import { damageAttribute, readLegacyRelicAttributes } from "./panel-attributes.ts";
import { object, type PanelAvatar } from "./panel-model.ts";

type Json = Record<string, unknown>;
type Roll = { key: string; value: number; rolls?: number; eff?: number };
type Weights = Readonly<Record<string, number>>;
type WeightedAttribute = { weight: number; fixWeight: number; mark: number };
const characters: Readonly<Record<string, { hp: number; atk: number; def: number }>> = baseStats;
const presets: Readonly<Record<string, Weights>> = usefulAttr;

const rules = {
  atk: { title: "大攻击", value: 4.32 }, atkPlus: { title: "小攻击", value: 127 / 6, base: "atk" },
  def: { title: "大防御", value: 5.4 }, defPlus: { title: "小防御", value: 127 / 6, base: "def" },
  hp: { title: "大生命", value: 4.32 }, hpPlus: { title: "小生命", value: 254 / 6, base: "hp" },
  speed: { title: "速度", value: 2.6, flat: true }, cpct: { title: "暴击率", value: 3.24 },
  cdmg: { title: "暴击伤害", value: 6.48 }, recharge: { title: "充能效率", value: 3.11 },
  dmg: { title: "伤害加成", value: 6.22 }, heal: { title: "治疗加成", value: 5.53 },
  stance: { title: "击破特攻", value: 6.48 }, effPct: { title: "效果命中", value: 4.32 },
  effDef: { title: "效果抵抗", value: 4.32 },
} as const;
const attrRules: Readonly<Record<string, { title: string; value: number; base?: "hp" | "atk" | "def"; flat?: boolean }>> = rules;
export const relicAttributeMap = Object.fromEntries(Object.entries(attrRules).map(([key, rule]) => [key, {
  title: rule.title, type: rule.base ? "plus" : "normal",
  text: `${rule.value.toFixed(2)}${rule.base || rule.flat ? "" : "%"}`,
}]));

const mainKeys: Readonly<Record<number, readonly string[]>> = {
  3: ["atk", "def", "hp", "cpct", "cdmg", "heal", "effPct"],
  4: ["atk", "def", "hp", "speed"], 5: ["atk", "def", "hp", "dmg"], 6: ["atk", "def", "hp", "recharge", "stance"],
};
const subKeys = ["atk", "atkPlus", "def", "defPlus", "hp", "hpPlus", "speed", "cpct", "cdmg", "effPct", "effDef", "stance"];
const defaultWeight = { atk: 75, cpct: 100, cdmg: 100, dmg: 100, speed: 100 };

function parse(value: unknown): number | undefined {
  const parsed = typeof value === "string" && /^\d{1,8}(?:\.\d{1,8})?%?$/u.test(value) ? Number.parseFloat(value) : value;
  if (typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0) return parsed;
}

function maxAttrs(attrs: Readonly<Record<string, WeightedAttribute>>, keys: readonly string[], size: number, excluded = "") {
  return keys.filter(key => key !== excluded && attrs[key]).map((key, order) => ({ key, order, value: attrs[key]!.fixWeight }))
    .sort((a, b) => b.value - a.value || b.order - a.order).slice(0, size).map(({ key }) => key);
}

function subMaximum(attrs: Readonly<Record<string, WeightedAttribute>>, main: string) {
  return maxAttrs(attrs, subKeys, 4, main).reduce((total, key, index) => total + attrs[key]!.fixWeight * (index === 0 ? 6 : 1), 0);
}

function makeConfig(avatar: PanelAvatar, { name, abbr, speed, base }: {
  readonly name: string; readonly abbr: string; readonly speed?: number; readonly base?: Json;
}) {
  const selected = base ?? characters[avatar.id];
  const hp = parse(selected?.hp), atk = parse(selected?.atk), def = parse(selected?.def);
  if (!hp || !atk || !def) return;
  const baseAttr = { hp, atk, def };
  let weights: Weights = presets[name] || presets[avatar.name] || defaultWeight;
  let title = `${abbr}-通用`;
  if (name === "椒丘" && avatar.rank === 6) {
    title = "椒丘-满魂";
    weights = { hp: 75, atk: 75, def: 75, speed: 100, cpct: 100, cdmg: 100, stance: 0, heal: 0, recharge: 0, effPct: 100, effDef: 50, dmg: 100 };
  }
  if (name === "缇宝" && speed !== undefined && speed > 109) {
    title = "缇宝-高速";
    weights = { ...weights, speed: 100 };
  }
  if (name === "风堇" && avatar.rank === 6) {
    title = "风堇-满魂";
    weights = { ...weights, cdmg: 100 };
  }
  const attrs: Record<string, WeightedAttribute> = {};
  for (const [key, rule] of Object.entries(attrRules)) {
    const weight = weights[rule.base ?? key];
    if (!weight) continue;
    if (rule.base) {
      const reference = baseAttr[rule.base] + (rule.base === "atk" ? 520 : 0);
      const mark = weight / attrRules[rule.base]!.value / reference * 100;
      attrs[key] = { weight, fixWeight: mark * rule.value, mark };
    } else {
      attrs[key] = { weight, fixWeight: weight, mark: weight / rule.value };
    }
  }
  const ignoreMain = avatar.id === "1511" ? [5, 6] : [];
  const posMaxMark: Record<string, number> = {};
  for (let slot = 1; slot <= 6; slot++) {
    const candidates = mainKeys[slot] ?? [];
    const main = slot === 1 ? "hpPlus" : slot === 2 ? "atkPlus" : ignoreMain.includes(slot)
      ? "" : maxAttrs(attrs, candidates, 1)[0] ?? candidates[0] ?? "";
    const variable = slot >= 3 && !ignoreMain.includes(slot);
    const maxMain = variable ? attrs[main]?.fixWeight ?? 0 : 0;
    posMaxMark[String(slot)] = maxMain * 2 + subMaximum(attrs, main);
    posMaxMark[`m${slot}`] = maxMain;
  }
  return { attrs, classTitle: title, posMaxMark, ignoreMain };
}

function relicKey(key: string, value: string) {
  const pct = key.match(/^(hp|atk|def)Pct$/u);
  if (pct) return pct[1]!;
  return /^(hp|atk|def)$/u.test(key) && !value.endsWith("%") ? `${key}Plus` : key;
}

function rollValue(part: PanelAvatar["relics"][number], values: Json) {
  const meta = object(object(values.starData)?.[part.rarity ?? -1]);
  const legacy = readLegacyRelicAttributes(part, values);
  const subConfig = Object.values(object(meta?.sub) ?? {}).map(object).filter((row): row is Json => row !== undefined);
  function withEfficiency(item: Roll): Roll {
    const cfg = subConfig.find(row => row.key === item.key);
    const base = parse(cfg?.base), step = parse(cfg?.step);
    if (base === undefined || step === undefined || base + step * 2 <= 0) return item;
    return { ...item, eff: item.value / (base + step * 2) };
  }
  if (legacy) return { main: legacy.main, sub: legacy.sub.map(withEfficiency) };
  if (!part.main || part.legacyMainId) return;
  const key = relicKey(part.main.key, part.main.value);
  const rawMain = parse(part.main.value);
  const cfg = object(object(meta?.main)?.[key]);
  const base = parse(cfg?.base), step = parse(cfg?.step);
  const value = base !== undefined && step !== undefined && part.level !== undefined ? base + step * part.level : rawMain;
  if (value === undefined) return;
  const sub: Roll[] = [];
  for (const attr of part.subs) {
    const kind = relicKey(attr.key, attr.value);
    const original = parse(attr.value);
    if (original === undefined) return;
    const cfg = subConfig.find(item => item.key === kind);
    const base = parse(cfg?.base), step = parse(cfg?.step);
    let rolls = attr.times;
    let value = original;
    // Old Miao reconstructs the exact affix from rounded MiYouShe text and
    // the recorded roll count. Keep the reported number when roll data is absent.
    if (base && step && rolls !== undefined) {
      if (kind === "speed") rolls = Math.floor(original / base) || 1;
      value = rolls * base + Math.round((original - rolls * base) / step) * step;
    }
    sub.push(withEfficiency({ key: kind, value, rolls }));
  }
  return { main: { key, value }, sub };
}

const rankBands = ["D", "C", "B", "A", "S", "SS", "SSS", "ACE"];
const grade = (mark: number) => rankBands[Math.floor(mark / 7)] ?? "MAX";
const elements = new Set(Object.values(damageAttribute));
function shownRoll(roll: Roll, mark: number) {
  const percent = !roll.key.endsWith("Plus") && roll.key !== "speed";
  return { key: roll.key, value: `${roll.value.toFixed(1)}${percent ? "%" : ""}`, upNum: roll.rolls,
    eff: roll.eff === undefined ? "" : (roll.eff / 0.9).toFixed(1), _mark: mark, mark: Math.round(mark), title: attrRules[roll.key]?.title };
}

export function scoreStarRailRelics(avatar: PanelAvatar, options: {
  readonly name: string; readonly abbr: string; readonly element: string;
  readonly speed?: number; readonly base?: Json; readonly relicValues?: Json;
}) {
  const cfg = makeConfig(avatar, options);
  if (!cfg) return;
  const { attrs, posMaxMark, ignoreMain } = cfg;
  const values = options.relicValues && object(options.relicValues.starData) ? options.relicValues : defaultValues;
  let total = 0;
  const artis: Record<number, ReturnType<typeof scorePart>> = {};
  for (const part of avatar.relics) {
    if (Object.hasOwn(artis, part.slot)) continue;
    const roll = rollValue(part, values);
    if (!roll) continue;
    const result = scorePart(part.slot, roll);
    total += result._mark;
    artis[part.slot] = result;
  }
  if (!Object.keys(artis).length) return;
  const charWeight = Object.fromEntries(Object.entries(attrs).map(([key, cfg]) => [key, cfg.weight]));
  return { charCfg: cfg, artis, charWeight, mark: total.toFixed(1), markClass: grade(total / 6), incomplete: avatar.relics.length - Object.keys(artis).length };

  function scorePart(slot: number, roll: { main: Roll; sub: readonly Roll[] }) {
    const key = roll.main.key;
    const matching = slot === 5 && damageAttribute[options.element] === key;
    const main = matching ? "dmg" : key;
    let factor = 1;
    let score = 0;
    let pMax = posMaxMark[String(slot)] ?? 0;
    const ignored = ignoreMain.includes(slot);
    const variable = slot >= 3 && !ignored;
    if (variable) {
      const best = posMaxMark[`m${slot}`] ?? 0;
      if (key !== "recharge" && best > 0) factor = Math.min(1, Math.max(0, (attrs[main]?.weight ?? 0) / best));
      score += (attrs[main]?.mark ?? 0) * roll.main.value / 4;
      pMax = Math.max(pMax, (attrs[main]?.fixWeight ?? 0) * 2 + subMaximum(attrs, main));
    }
    const sub = roll.sub.map(attr => {
      const points = (attrs[attr.key]?.mark ?? 0) * attr.value;
      score += points;
      return shownRoll(attr, points);
    });
    const result = pMax > 0 ? Math.min(score * (1 + factor) / 2 / pMax * 66, 70) : 0;
    const displayMain = ignored ? 0 : (attrs[elements.has(key) ? "dmg" : key]?.mark ?? 0) * roll.main.value / 4 + 0.01;
    return { _mark: result, mark: result.toFixed(1), markClass: grade(result), pMax, mainFactor: (1 + factor) / 2,
      ignoreMain: ignored, main: shownRoll(roll.main, displayMain), attrs: sub };
  }
}
