// Personal damage adapted from MIT miao-plugin ProfileDmg, DmgAttr, DmgCalc
// and the original Seele, Hunt light cone and Star Rail relic calculations.
import { calculateLegacyPanelAttributeRows } from "./panel-attributes.ts";
import type { readPanelDamageMetadata } from "./panel-card.ts";
import { object, type PanelAvatar } from "./panel-model.ts";

const skills = [["a", "普攻伤害"], ["e", "战技伤害"], ["q", "终结技伤害"]] as const;
const stats = [["atk", "大攻击", 4.32], ["cpct", "暴击率", 3.24], ["cdmg", "暴击伤害", 6.48], ["speed", "速度", 2.6]] as const;
const supportedCones = new Set(["20000", "23001", "23012"]);
const supportedSets = new Set(["繁星璀璨的天才", "野穗伴行的快枪手", "繁星竞技场", "停转的萨尔索图", "太空封印站", "苍穹战线格拉默"]);
type Metadata = NonNullable<Awaited<ReturnType<typeof readPanelDamageMetadata>>>;
type Stat = typeof stats[number][0];

export const personalDamageScenarios = skills.length;
export const personalDamageEnemyLevel = 80;
export const hasPersonalDamage = (id: string) => id === "1102";

function tableValue(values: unknown, level: number | undefined) {
  const value: unknown = Array.isArray(values) && level && values[level - 1];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function talentValue(avatar: PanelAvatar, metadata: Metadata, key: string, name: string) {
  const baseLevel = avatar.skills.find(skill => skill.key === key)?.level;
  if (!baseLevel || avatar.rank === undefined) return;
  const upgradeAt = object(metadata.character.talentCons)?.[key];
  if (avatar.legacy && typeof upgradeAt !== "number") return;
  const level = baseLevel + (avatar.legacy && typeof upgradeAt === "number" && avatar.rank >= upgradeAt ? key === "a" ? 1 : 2 : 0);
  const tables = object(object(object(metadata.character.talent)?.[key])?.tables);
  const row = Object.values(tables ?? {}).map(object).find(row => row?.name === name);
  return tableValue(row?.values, level);
}

function panelValues(avatar: PanelAvatar, metadata: Metadata) {
  const attrs = avatar.legacy ? calculateLegacyPanelAttributeRows(avatar, metadata) : avatar.stats;
  function read(key: string, field: "base" | "value") {
    const raw = attrs?.find(stat => stat.key === key)?.[field];
    const value = typeof raw === "string" ? Number.parseFloat(raw) : raw;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  const atk = read("atk", "value"), atkBase = read("atk", "base"), speed = read("speed", "value"), speedBase = read("speed", "base");
  const cpct = read("cpct", "value"), cdmg = read("cdmg", "value"), quantum = read("quantum", "value");
  if (atk === undefined || !atkBase || speed === undefined || !speedBase || cpct === undefined || cdmg === undefined || quantum === undefined) return;
  return { atk, atkBase, speed, speedBase, cpct, cdmg, quantum };
}

export function calculateStarRailPersonalDamage(avatar: PanelAvatar, metadata: Metadata, scenario: number) {
  if (!hasPersonalDamage(avatar.id) || avatar.rank === undefined || !avatar.level || !skills[scenario - 1] ||
      !Number.isInteger(scenario) || metadata.character.elem !== "量子" || (avatar.element && avatar.element !== "量子")) return;
  const level = avatar.level, rank = avatar.rank;
  if (!avatar.legacy && !avatar.traces.some(trace => trace.id === "1102102")) return;
  if (avatar.cone && (metadata.conePath !== "巡猎" || !supportedCones.has(avatar.cone.id) || !avatar.cone.rank)) return;

  const values = panelValues(avatar, metadata);
  const amplification = talentValue(avatar, metadata, "t", "伤害提高");
  const coefficients = skills.map(([key]) => talentValue(avatar, metadata, key, "技能伤害"));
  if (!values || amplification === undefined || coefficients.some(value => value === undefined)) return;
  const { atk, atkBase, speed: panelSpeed, speedBase, cpct, cdmg, quantum } = values;

  const equipped = new Map<string, number>();
  const slots = new Set<number>();
  for (const item of avatar.relics) {
    const set = metadata.setForId(item.id);
    if (!set || slots.has(item.slot)) return;
    slots.add(item.slot);
    equipped.set(set, (equipped.get(set) ?? 0) + 1);
  }
  if ([...equipped].some(([set, count]) => count >= 2 && !supportedSets.has(set))) return;
  const has = (name: string, count: number) => (equipped.get(name) ?? 0) >= count;
  const affix = object(object(metadata.cone.skill)?.tables);
  const night = avatar.cone?.id === "23001";
  const arrows = avatar.cone?.id === "20000";
  const nightAttack = night ? tableValue(affix?.[2], avatar.cone?.rank) : 0;
  const nightUltimate = night ? tableValue(affix?.[3], avatar.cone?.rank) : 0;
  const arrowCrit = arrows ? tableValue(affix?.[1], avatar.cone?.rank) : 0;
  if (nightAttack === undefined || nightUltimate === undefined || arrowCrit === undefined) return;
  const lightCone = { nightAttack, nightUltimate, arrowCrit };
  const talentBonus = amplification * 100;

  const pierce = avatar.traces.some(trace => trace.active && trace.id === "1102102") ? 20 : 0;
  const defenseIgnore = has("繁星璀璨的天才", 4) ? 20 : 0;
  const defense = (200 + level * 10) / ((200 + level * 10) + (200 + personalDamageEnemyLevel * 10) * (1 - defenseIgnore / 100));

  function calculate(index: number, adjustment: Partial<Record<Stat, number>> = {}) {
    const active: string[] = [];
    const support = (name: string, enabled: boolean) => {
      if (enabled) active.push(name);
      return enabled;
    };
    const speed = panelSpeed + speedBase * (rank >= 2 ? 0.5 : 0.25) + (adjustment.speed ?? 0);
    const critRate = cpct + (rank >= 1 ? 15 : 0) + lightCone.arrowCrit + (adjustment.cpct ?? 0);
    const nightStacks = night ? Math.min(6, Math.floor((speed - 100) / 10)) : 0;
    const critDamage = cdmg + (index === 2 ? nightStacks * lightCone.nightUltimate : 0) + (adjustment.cdmg ?? 0);
    let attack = atk + atkBase * (adjustment.atk ?? 0) / 100;
    let bonus = quantum + talentBonus;
    if (night) active.push(`于夜色中 · ${nightStacks} 层`);
    if (arrows) active.push(`锋镝 · 暴击率 +${arrowCrit}%`);
    if (defenseIgnore) active.push("繁星璀璨的天才 · 无视防御力 20%");
    if (support("野穗伴行的快枪手 · 普攻伤害 +10%", index === 0 && has("野穗伴行的快枪手", 4))) bonus += 10;
    if (support("繁星竞技场 · 普攻与战技伤害 +20%", index < 2 && critRate >= 70 && has("繁星竞技场", 2))) bonus += 20;
    if (support("停转的萨尔索图 · 终结技伤害 +15%", index === 2 && critRate > 50 && has("停转的萨尔索图", 2))) bonus += 15;
    if (support("太空封印站 · 攻击力 +12%", speed > 120 && has("太空封印站", 2))) attack += atkBase * 0.12;
    if (speed >= 135 && has("苍穹战线格拉默", 2)) {
      const amount = speed < 160 ? 12 : 18;
      bonus += amount;
      active.push(`苍穹战线格拉默 · 伤害 +${amount}%`);
    }
    if (index < 2) bonus += nightStacks * lightCone.nightAttack;
    const crit = Math.max(0, Math.min(1, critRate / 100));
    const critFactor = crit === 0 ? 0 : critDamage / 100;
    const base = attack * coefficients[index]! * (1 + bonus / 100) * defense * (1 + pierce / 100) * 0.9;
    return { critical: base * (1 + critFactor), average: base * (1 + crit * critFactor), active };
  }

  const rows = skills.map(([, title], index) => ({ title, ...calculate(index) }));
  const swaps = stats.map(([from, title, amount]) => ({
    title, amount: `${amount}${from === "speed" ? "" : "%"}`,
    values: stats.map(([to, , increase]) => {
      if (from === to) return;
      const { critical, average } = calculate(scenario - 1, { [from]: -amount, [to]: increase });
      return { critical, average };
    }),
  }));
  const buffs = [`增幅状态 · 伤害 +${Number((amplification * 100).toFixed(2))}%`, `战技 · 速度 +${rank >= 2 ? 50 : 25}%`];
  if (rank >= 1) buffs.push("星魂 1 · 敌方生命低于 80% 时暴击率 +15%");
  if (pierce) buffs.push("行迹 · 抗性穿透 +20%");
  return { rows, swaps, selected: scenario - 1, buffs: [...buffs, ...rows[scenario - 1]!.active] };
}

export type StarRailPersonalDamage = NonNullable<ReturnType<typeof calculateStarRailPersonalDamage>>;
