import { calculateLegacyPanelAttributeRows, damageAttribute } from "./panel-attributes.ts";
import type { readPanelDamageMetadata } from "./panel-card.ts";
import { object, type PanelAvatar } from "./panel-model.ts";
import DmgAttr from "./panel-damage-rules/DmgAttr.js";
import DmgCalc from "./panel-damage-rules/DmgCalc.js";
import { attrMap } from "./panel-damage-rules/relic-attributes.js";
import relicRules from "./panel-damage-rules/relics.js";
import * as seele from "./panel-damage-rules/characters/seele.js";
import * as acheron from "./panel-damage-rules/characters/acheron.js";
import * as aventurine from "./panel-damage-rules/characters/aventurine.js";
import * as theHerta from "./panel-damage-rules/characters/the-herta.js";
import hunt from "./panel-damage-rules/weapons/hunt.js";
import nihility from "./panel-damage-rules/weapons/nihility.js";
import erudition from "./panel-damage-rules/weapons/erudition.js";
import preservation from "./panel-damage-rules/weapons/preservation.js";

type Metadata = NonNullable<Awaited<ReturnType<typeof readPanelDamageMetadata>>>;
type Attr = { base: number; plus: number; pct: number; inc?: number };
type Numbers = Record<string, number>;
type Params = Record<string, number | boolean>;
type SkillValues = Record<string, Numbers>;
type Variables = {
  attr: Readonly<Record<string, Attr>>;
  calc: (attr: Attr) => number;
  talent: SkillValues;
  cons: number;
  trees: Record<string, boolean>;
  params: Params;
};
type DamageValue = { avg: number; dmg?: number };
type DamageFn = ((multiplier: number, skill: string, effect?: string) => DamageValue) & {
  basic: (amount: number, skill: string) => DamageValue;
  shield: (amount: number) => DamageValue;
};
type Buff = {
  title?: string;
  data?: Record<string, number | string | ((variables: Variables) => string | number)>;
  isStatic?: boolean;
  sort?: number;
  cons?: number;
  tree?: number;
};
type Rule = {
  details: readonly {
    title: string;
    cons?: number;
    params?: Readonly<Params>;
    dmg: (variables: Variables, damage: DamageFn) => DamageValue;
  }[];
  buffs: readonly Buff[];
  defDmgIdx: number;
  mainAttr: string;
  defParams?: (variables: Variables) => Params;
};
type Character = {
  name: string;
  element: string;
  path: string;
  traces: readonly number[];
  stat?: string;
  rule: Rule;
  cones: Readonly<Record<string, string>>;
};
const setRules = relicRules as unknown as Readonly<Record<string, Readonly<Record<number, Buff | Buff[]>>>>;

// The original JS rules share DmgAttr's numeric AttrItem coercion and variable shape.
const characters: ReadonlyMap<string, Character> = new Map(Object.entries({
  "1102": { name: "希儿", element: "量子", path: "巡猎", traces: [102], rule: seele,
    cones: { "20000": "锋镝", "23001": "于夜色中", "23012": "如泥酣眠" } },
  "1308": { name: "黄泉", element: "雷", path: "虚无", traces: [102, 103], rule: acheron,
    cones: { "23024": "行于流逝的岸", "21044": "无边曼舞" } },
  "1401": { name: "大黑塔", element: "冰", path: "智识", traces: [101, 102, 103], rule: theHerta,
    cones: { "23037": "向着不可追问处" } },
  "1304": { name: "砂金", element: "虚数", path: "存护", traces: [102], stat: "def", rule: aventurine,
    cones: { "23023": "命运从未公平", "21043": "两个人的演唱会" } },
}) as unknown as [string, Character][]);
export const personalDamageNames = [...characters.values()].map(({ name }) => name).join("、");
export const personalDamageEnemyLevel = 80;
export const hasPersonalDamage = (id: string) => characters.has(id);

export function personalDamageScenarios(avatar: PanelAvatar) {
  const { rule } = characters.get(avatar.id) ?? {};
  return rule?.details.filter(row => !row.cons || (avatar.rank !== undefined && avatar.rank >= row.cons)).length ?? 0;
}

function tableValue(values: unknown, level: number | undefined) {
  const value: unknown = Array.isArray(values) && level && values[level - 1];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new MissingDamageData("缺少技能等级或叠影数据");
  return value;
}

class MissingDamageData extends Error {}

function talentValues(avatar: PanelAvatar, metadata: Metadata, rank: number): SkillValues {
  const current = new Map(avatar.skills.map(({ key, level }) => [key, level]));
  const cfg = object(metadata.character.talent);
  const upgrades = object(metadata.character.talentCons);
  return new Proxy(Object.create(null), {
    get(_, key: string) {
      const originalKey = key.replace(/^([aeqtx]|xe|me|mt)[123]$/u, "$1");
      const baseLevel = current.get(originalKey);
      if (!baseLevel || (avatar.legacy && !upgrades)) throw new MissingDamageData("缺少技能等级");
      const upgradeAt = upgrades?.[originalKey];
      const unlocks = Array.isArray(upgradeAt) ? upgradeAt : [upgradeAt];
      const extra = avatar.legacy ? unlocks.filter(value => typeof value === "number" && rank >= value).length * (originalKey === "a" ? 1 : 2) : 0;
      const level = avatar.legacy ? Math.min(baseLevel + extra, originalKey === "a" ? 10 : 15) : baseLevel;
      const tables = object(object(cfg?.[key])?.tables);
      const rows = Object.values(tables ?? {}).map(object);
      return new Proxy(Object.create(null), {
        get(_, name) {
          const row = rows.find(row => row?.name === name);
          return tableValue(row?.values, level);
        },
      });
    },
  });
}

function panelValues(avatar: PanelAvatar, metadata: Metadata, character: Character) {
  const attrs = avatar.legacy ? calculateLegacyPanelAttributeRows(avatar, metadata) : avatar.stats;
  if (!attrs) throw new MissingDamageData("面板属性不齐");
  const values: Numbers = Object.create(null);
  const flat: Record<string, Attr> = Object.create(null);
  const element = damageAttribute[character.element];
  for (const stat of attrs) {
    const key = stat.key === element ? "dmg" : stat.key;
    for (const field of ["value", "base"] as const) {
      const raw = stat[field];
      const number = typeof raw === "string" ? Number.parseFloat(raw) : raw;
      if (typeof number === "number" && Number.isFinite(number) && number >= 0) values[field === "base" ? key + "Base" : key] = number;
    }
  }
  for (const key of ["atk", "speed", ...(character.stat ? [character.stat] : [])]) {
    if (!values[key + "Base"] || values[key] === undefined) throw new MissingDamageData("缺少角色基础与综合属性");
  }
  for (const key of ["cpct", "cdmg", "dmg"]) {
    if (values[key] === undefined) throw new MissingDamageData("缺少暴击或元素伤害属性");
  }
  for (const key of Object.keys(values)) {
    if (key.endsWith("Base")) continue;
    const base = values[key + "Base"] ?? 0;
    flat[key] = { base, plus: values[key]! - base, pct: 0 };
  }
  return { ...values, staticAttr: flat };
}

function relicEffects(avatar: PanelAvatar, metadata: Metadata) {
  const counts = new Map<string, number>();
  const slots = new Set<number>();
  for (const relic of avatar.relics) {
    const set = metadata.setForId(relic.id);
    if (!set || slots.has(relic.slot)) throw new MissingDamageData("遗器套装或位置不完整");
    slots.add(relic.slot);
    counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  const effects: Buff[] = [];
  const sets: Numbers = {};
  for (const [name, count] of counts) {
    if (count < 2) continue;
    const rule = Object.hasOwn(setRules, name) ? setRules[name] : undefined;
    if (!rule) throw new MissingDamageData(`「${name}」的套装规则尚未接入`);
    sets[name] = count >= 4 ? 4 : 2;
    for (const threshold of [2, 4]) {
      if (count < threshold) continue;
      for (const buff of [rule[threshold] ?? []].flat()) {
        if (!buff.isStatic) effects.push({ ...buff, title: `${name}${threshold}：${buff.title ?? ""}` });
      }
    }
  }
  return { effects, sets };
}

type IndexedBuff = Buff & { idx?: number; key?: string };
type WeaponRule = IndexedBuff | ((tables: Numbers) => IndexedBuff);
type WeaponRules = Readonly<Record<string, readonly WeaponRule[]>>;
const staticIndex = () => ({ isStatic: true });
function dynamicIndex(title: string, key: string | Numbers, idx?: number): WeaponRule {
  if (typeof key === "string") return { title, key, idx };
  return (tables) => ({ title, data: Object.fromEntries(Object.entries(key).map(([attr, index]) => [attr, tables[index]!])) });
}
const weaponRules: Readonly<Record<string, WeaponRules>> = {
  "巡猎": hunt(staticIndex, dynamicIndex), "虚无": nihility(staticIndex, dynamicIndex),
  "智识": erudition(staticIndex, dynamicIndex), "存护": preservation(staticIndex, dynamicIndex),
};

function weaponEffects(avatar: PanelAvatar, metadata: Metadata, character: Character) {
  const cone = avatar.cone;
  if (!cone) return [];
  const name = character.cones[cone.id];
  const configure = name && weaponRules[character.path]?.[name];
  if (!configure || !cone.rank || metadata.conePath !== character.path) {
    throw new MissingDamageData(`当前光锥「${cone.name || cone.id}」的伤害规则尚未接入或缺少叠影`);
  }
  const data = object(object(metadata.cone.skill)?.tables);
  const tables = new Proxy(Object.create(null), { get: (_, key: string) => tableValue(data?.[key], cone.rank) });
  return configure.flatMap(row => {
    const rule = typeof row === "function" ? row(tables) : row;
    if (rule.isStatic) return [];
    const title = rule.title?.includes("：") ? rule.title : `${name}：${rule.title ?? ""}`;
    return { ...rule, title, data: rule.idx && rule.key ? { [rule.key]: tables[rule.idx] } : rule.data };
  });
}

function originalDamage(
  avatar: PanelAvatar, metadata: Metadata, scenario: number | undefined,
  character: Character,
) {
  if (!avatar.level || avatar.rank === undefined || metadata.character.elem !== character.element ||
      (avatar.element && avatar.element !== character.element)) throw new MissingDamageData("缺少角色等级、星魂或元素资料");
  const { rule } = character;
  const rank = avatar.rank;
  const level = avatar.level;
  const knownTraces = new Map(avatar.traces.map(trace => [trace.id.match(/^1?\d{4}(\d{3})$/u)?.[1], trace.active]));
  if (!avatar.legacy && character.traces.some(trace => !knownTraces.has(String(trace)))) {
    throw new MissingDamageData("缺少对应的行迹状态");
  }
  const trees = Object.fromEntries([...knownTraces].filter(([id, active]) => id && active));
  const talent = talentValues(avatar, metadata, rank);
  const originalAttr = DmgAttr.getAttr({ game: "sr", originalAttr: undefined, attr: panelValues(avatar, metadata, character),
    char: { elem: character.element, sp: metadata.character.sp }, weapon: { affix: avatar.cone?.rank ?? 1 } });
  const weaponBuffs = weaponEffects(avatar, metadata, character);
  const relics = relicEffects(avatar, metadata);
  const buffs = [...rule.buffs, ...weaponBuffs, ...relics.effects].sort((a, b) => (a.sort ?? 1) - (b.sort ?? 1));
  const meta = { characterName: character.name, cons: rank, level, trees, talent, weapon: avatar.cone };
  const defaultParams = rule.defParams?.(meta as unknown as Variables) ?? {};
  const details = rule.details.filter(row => !row.cons || row.cons <= rank);
  const selected = scenario === undefined ? rule.defDmgIdx : scenario - 1;
  if (!details[selected] || (scenario !== undefined && !Number.isInteger(scenario))) throw new MissingDamageData("伤害场景序号无效");

  function calculate(detail: Rule["details"][number], incAttr = "", reduceAttr = "") {
    const params = { ...defaultParams, ...detail.params };
    const { attr, msg } = DmgAttr.calcAttr({
      originalAttr, buffs, meta: { ...meta }, artis: relics.sets, params, incAttr, reduceAttr, game: "sr",
    });
    const ds = { ...DmgAttr.getDs(attr, meta, params), artis: relics.sets };
    const damage = DmgCalc.getDmgFn({ ds, attr, level, enemyLv: personalDamageEnemyLevel, game: "sr", showDetail: false });
    const { dmg, avg } = detail.dmg(ds as unknown as Variables, damage as unknown as DamageFn);
    if (!Number.isFinite(avg) || (dmg !== undefined && !Number.isFinite(dmg))) throw new MissingDamageData("原规则所需数据不齐");
    return { critical: dmg, average: avg, active: msg as string[] };
  }

  const rows = details.map((detail) => ({ title: detail.title, ...calculate(detail) }));
  const statKeys = rule.mainAttr.split(",") as (keyof typeof attrMap)[];
  const swaps = statKeys.map(from => ({
    title: attrMap[from].title, amount: String(attrMap[from].value) + (from === "speed" ? "" : "%"),
    values: statKeys.map(to => {
      if (from === to) return;
      const { critical, average } = calculate(details[selected]!, to, from);
      return { critical, average };
    }),
  }));
  return { name: character.name, element: character.element, rows, swaps, selected, buffs: rows[selected]!.active };
}

export function readStarRailPersonalDamage(avatar: PanelAvatar, metadata: Metadata, scenario?: number) {
  const character = characters.get(avatar.id);
  if (!character) return { reason: "该星铁角色的个人伤害规则尚未接入" } as const;
  try {
    return { damage: originalDamage(avatar, metadata, scenario, character) } as const;
  } catch (error) {
    if (!(error instanceof MissingDamageData)) throw error;
    return { reason: error.message } as const;
  }
}

export function calculateStarRailPersonalDamage(avatar: PanelAvatar, metadata: Metadata, scenario?: number) {
  return readStarRailPersonalDamage(avatar, metadata, scenario).damage;
}

export type StarRailPersonalDamage = ReturnType<typeof originalDamage>;
