import { readLegacyRelicAttributes, readManagedRelicAttributes } from "./panel-attributes.ts";
import { id, whole, type PanelAvatar } from "./panel-model.ts";
import relicValues from "./panel-theme/relic-values.json";

const primary = { hp: "hp", atk: "atk", def: "def", speed: "spd" } as const;
const percent = {
  cpct: "critRate", cdmg: "critDmg", recharge: "energyRegen", heal: "outgoingHeal", stance: "breakEffect",
  effPct: "effectHitRate", effDef: "effectRes",
} as const;
const elements: Readonly<Record<string, string>> = {
  phy: "Physical", fire: "Fire", ice: "Ice", elec: "Thunder", wind: "Wind", quantum: "Quantum", imaginary: "Imaginary",
};
const direct: Readonly<Record<string, string>> = {
  hpPlus: "hp", atkPlus: "atk", defPlus: "def", speed: "spd", ...percent,
};
const skillKeys: Readonly<Record<string, string>> = {
  a: "basic", e: "skill", q: "ult", t: "talent", xe: "elation", me: "memo", mt: "memoTalent",
};
const elationKeys = new Set(["joy", "elation"]);

export interface TeamOwnedPanel {
  readonly level: number;
  readonly rank: number;
  readonly base: Readonly<Record<string, number>>;
  readonly stats: Readonly<Record<string, number>>;
  readonly conePanelEffects?: Readonly<Record<string, number>>;
  readonly skills: Readonly<Record<string, { readonly level: number; readonly effective: boolean }>>;
  readonly cone: { readonly id: string; readonly level?: number; readonly rank: number; readonly base?: Readonly<Record<string, number>> } | null;
  readonly relics: readonly {
    readonly slot: number;
    readonly set: string;
    readonly main?: { readonly key: string; readonly value: number };
    readonly subs: Readonly<Record<string, number>>;
  }[];
  readonly warnings: readonly string[];
}

function statNumber(value?: string) {
  if (typeof value !== "string" || !/^[-+]?\d{1,9}(?:\.\d{1,15})?%?$/u.test(value)) return;
  const result = Number.parseFloat(value);
  return Number.isFinite(result) ? result : undefined;
}

function recordStat(record: Record<string, number>, key: string, value: number) {
  record[key] = (record[key] ?? 0) + value;
}

function readRelics(avatar: PanelAvatar, warnings: string[]) {
  const slots = new Set<number>();
  return avatar.relics.flatMap(part => {
    const indexed = /^[3-6]([13]\d{2})([1-6])$/u.exec(part.id);
    if (!indexed || Number(indexed[2]) !== part.slot || slots.has(part.slot)) {
      warnings.push("有遗器套装编号无法确认");
      return [];
    }
    slots.add(part.slot);
    const decoded = part.legacyMainId ? readLegacyRelicAttributes(part, relicValues)
      : readManagedRelicAttributes(part, relicValues);
    const normalized = (key: string, value: number, calculated: boolean) => {
      const element = elements[key];
      const stat = element ? `dmgBonus_${element}` : direct[key] ?? (
        calculated && /^(hp|atk|def)$/u.test(key) ? `${key}Pct`
        : /^(hp|atk|def)(?:Pct)?$/u.test(key) ? key : undefined
      );
      if (stat) return { key: stat, value: /^(hp|atk|def|spd)$/u.test(stat) ? value : value / 100 };
    };
    const measured = (attribute: NonNullable<typeof part.main>) => {
      const value = statNumber(attribute.value);
      return value === undefined ? undefined : normalized(attribute.key, value, false);
    };
    const main = decoded ? normalized(decoded.main.key, decoded.main.value, true) : part.main && measured(part.main);
    const sub = decoded ? decoded.sub.map(row => normalized(row.key, row.value, true)) : part.subs.map(measured);
    const subs: Record<string, number> = {};
    for (const entry of sub) if (entry) recordStat(subs, entry.key, entry.value);
    if (!main) warnings.push("有遗器词条无法读取");
    return [{ slot: part.slot, set: indexed[1]!, main, subs }];
  });
}

export function projectTeamOwnedPanel(avatar: PanelAvatar, stats = avatar.stats,
  staticCone?: readonly { readonly key: string; readonly value: number }[],
  coneBase?: Readonly<Record<string, number>>): TeamOwnedPanel | undefined {
  const level = whole(avatar.level, 80);
  const rank = whole(avatar.rank, 6);
  const weapon = avatar.cone;
  const weaponId = id(weapon?.id);
  const weaponRank = whole(weapon?.rank, 5);
  if (!level || rank === undefined || (weapon && (!weaponId || !weaponRank))) return;
  const base: Record<string, number> = {};
  const final: Record<string, number> = {};
  const warnings: string[] = [];
  for (const stat of stats) {
    const value = statNumber(stat.value);
    if (value === undefined) continue;
    const flatKey = primary[stat.key as keyof typeof primary];
    if (flatKey) {
      const baseValue = statNumber(stat.base);
      if (baseValue && baseValue > 0) base[flatKey] = baseValue;
      if (value > 0) final[flatKey] = value;
      continue;
    }
    const percentKey = percent[stat.key as keyof typeof percent];
    const element = elements[stat.key];
    if (element) final[`dmgBonus_${element}`] = value / 100;
    if (elationKeys.has(stat.key)) final.elation = value / 100;
    if (!percentKey) continue;
    // The official panel and legacy calculator can report a 100% base energy-recovery multiplier.
    const multiplier = stat.key === "recharge" && (statNumber(stat.base) === 100 || value >= 100);
    final[percentKey] = (value - (multiplier ? 100 : 0)) / 100;
  }
  const skills: Record<string, { level: number; effective: boolean }> = {};
  for (const skill of avatar.skills) {
    const key = skillKeys[skill.key];
    const value = whole(skill.level, 25);
    if (key && value && !Object.hasOwn(skills, key)) {
      const original = whole(skill.original, 25);
      skills[key] = original ? { level: original, effective: false } : { level: value, effective: !avatar.legacy || skill.effective === true };
    }
  }
  if (["basic", "skill", "ult", "talent"].some(key => !Object.hasOwn(skills, key))) warnings.push("缺失技能等级沿用公开配装");
  const relics = readRelics(avatar, warnings);
  if (!Object.keys(final).length && !relics.length && !Object.keys(skills).length && !weapon) return;
  const conePanelEffects: Record<string, number> | undefined = staticCone && {};
  if (conePanelEffects && staticCone) {
    for (const { key, value } of staticCone) {
      const stat = direct[key] ?? (elements[key] ? `dmgBonus_${elements[key]}` : /^(hp|atk|def|speed)Pct$/u.test(key) ? key : undefined);
      if (stat) recordStat(conePanelEffects, stat, /^(hp|atk|def|spd)$/u.test(stat) ? value : value / 100);
    }
  }
  return { level, rank, base, stats: final, conePanelEffects, skills, cone: weapon ? { id: weaponId, level: weapon.level, rank: weaponRank!, base: coneBase } : null,
    relics, warnings: [...new Set(warnings)] };
}
