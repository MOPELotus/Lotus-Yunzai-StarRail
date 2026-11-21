import type { TeamSimulationMember } from "../../team-damage-runtime.ts";
import type { TeamOwnedPanel } from "../../team-owned-panel.ts";
import defaults from "../defaults.json";
import { canonicalPath, compileEncounter } from "./compile/encounter.ts";
import { map, MissingTemplate, numeric, string, templateLibrary, type TemplateLibrary } from "./compile/library.ts";
import type { ActorBuild, CompiledActor, CompiledEncounter, Numbers, RelicSlot } from "./compile/types.ts";
import { getRulebook, type RuleValues } from "./rules/rulebook.ts";

export interface WorkerBuildRequest {
  readonly roles: readonly TeamSimulationMember[];
  readonly cycle: number;
  readonly enemies: number;
}
export interface PanelCalibration {
  readonly stats: Numbers;
  readonly conePanelEffects: Numbers;
}
export interface CompiledWorkerBuild {
  readonly encounter: CompiledEncounter;
  readonly panelCalibration: ReadonlyMap<string, PanelCalibration>;
  readonly notices: readonly string[];
}
export interface EffectivePanel {
  readonly stats: Numbers;
  readonly damageBonus: Numbers;
}

const scalarStats: Readonly<Record<string, string>> = {
  hp: "hp", atk: "atk", def: "def_", spd: "spd", critRate: "crit_rate", critDmg: "crit_dmg",
  energyRegen: "energy_regen", breakEffect: "break_effect", outgoingHeal: "heal_bonus",
  effectHitRate: "effect_hit", effectRes: "effect_res", elation: "elation",
};
const affixStats: Readonly<Record<string, string>> = {
  ...scalarStats, hpPct: "hp_pct", atkPct: "atk_pct", defPct: "def_pct", speedPct: "spd_pct",
};
const primary = ["hp", "atk", "def", "spd"] as const;
const skills: Readonly<Record<string, string>> = {
  basic: "basic", skill: "skill", ult: "ultimate", talent: "talent", elation: "elation_skill",
  memo: "memosprite_skill", memoTalent: "memosprite_talent",
};
type DefaultLoadout = { cone: string; sets: readonly string[]; body: string; orb: string; rope: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function hasWhite(stats: Numbers | undefined, fields: readonly string[]): stats is Numbers {
  return !!stats && fields.every(key => isFiniteNumber(stats[key]));
}
function damageElement(key: string): string | undefined {
  return key.startsWith("dmgBonus_") ? key.slice("dmgBonus_".length).toLowerCase() : undefined;
}
function affix(key: string): string | undefined {
  const element = damageElement(key);
  return element ? element + "_dmg" : affixStats[key];
}
function makeDefaults(member: TeamSimulationMember, template: RuleValues): ActorBuild {
  const path = canonicalPath(template.path);
  const base = (defaults.paths as Readonly<Record<string, DefaultLoadout>>)[path];
  if (!base) return { id: member.id, version: member.version };
  const preset = { ...base, ...(defaults.characters as Readonly<Record<string, Partial<DefaultLoadout>>>)[member.id] };
  const element = string(template.element).toLowerCase();
  const orb = preset.orb === "element" ? element ? element + "_dmg" : "hp_pct" : preset.orb;
  return {
    id: member.id, version: member.version, cone: { id: preset.cone, rank: 1, active: true },
    relics: ["hp", "atk", preset.body, "spd", orb, preset.rope]
      .map((main, index) => ({ set: preset.sets[index < 4 ? 0 : 1], main })),
  };
}

async function makeOwned(member: TeamSimulationMember, template: RuleValues, panel: TeamOwnedPanel,
  notices: string[], calibrations: Map<string, PanelCalibration>, library: TemplateLibrary): Promise<ActorBuild> {
  const ranks = map(template.eidolons);
  const levelBonus: Record<string, number> = {};
  for (let rank = 1; rank <= panel.rank; rank++) {
    for (const [key, value] of Object.entries(numeric(map(ranks["E" + rank]).skill_level_overrides))) {
      levelBonus[key] = (levelBonus[key] ?? 0) + value;
    }
  }
  const skillLevels: Record<string, number> = {};
  for (const [key, saved] of Object.entries(panel.skills)) {
    const skill = skills[key];
    if (!skill) continue;
    const level = saved.level - (saved.effective ? levelBonus[skill] ?? 0 : 0);
    if (level < 1) notices.push("有技能等级与已解锁星魂不一致，使用模板等级");
    else skillLevels[skill] = level;
  }

  const relics = new Map<number, RelicSlot>();
  for (const piece of panel.relics) {
    if (!Number.isInteger(piece.slot) || piece.slot < 1 || piece.slot > 6) continue;
    let set: string | undefined = piece.set;
    try {
      await library.read("relics", set);
    } catch (error) {
      if (!(error instanceof MissingTemplate)) throw error;
      notices.push(`遗器套装 ${set} 尚无机制模板，保留该部件词条`);
      set = undefined;
    }
    const subs: Record<string, number> = {};
    for (const [key, value] of Object.entries(piece.subs)) {
      const field = affix(key);
      if (field) subs[field] = value;
    }
    relics.set(piece.slot, { set, main: piece.main && affix(piece.main.key), mainValue: piece.main?.value, subs });
  }
  notices.push(...panel.warnings);
  const whiteStats: Record<string, number> = {};
  for (const key of primary) {
    const value = panel.base[key];
    if (isFiniteNumber(value)) whiteStats[scalarStats[key]!] = value;
  }
  let cone: ActorBuild["cone"];
  const weapon = panel.cone;
  if (weapon) {
    let model: RuleValues | undefined;
    try {
      model = await library.read("light_cones", weapon.id);
    } catch (error) {
      if (!(error instanceof MissingTemplate)) throw error;
      notices.push(`光锥 ${weapon.id} 尚无机制模板，只使用面板可核对的白值`);
      if (!hasWhite(panel.base, primary.slice(0, 3))) throw error;
    }
    if (model) {
      const active = canonicalPath(model.path) === canonicalPath(template.path);
      const base = active && hasWhite(weapon.base, primary.slice(0, 3)) ? weapon.base
        : !active ? weapon.base ?? numeric(model.base_stats) : undefined;
      cone = { id: weapon.id, rank: weapon.rank, active, base };
    }
    if ((weapon.level ?? 80) < 80 && !weapon.base && !hasWhite(panel.base, primary.slice(0, 3))) {
      notices.push("缺少低等级光锥白值，沿用引擎模板的基础属性");
    }
  }
  if (panel.conePanelEffects === undefined && weapon) {
    notices.push("未核对光锥常驻面板词条，采用实际装备计算");
  } else {
    if (Object.keys(whiteStats).length < 4 && panel.level < 80) notices.push("未核对低等级白值，使用引擎的属性模板");
    calibrations.set(member.id, { stats: panel.stats, conePanelEffects: panel.conePanelEffects ?? {} });
  }
  return { id: member.id, version: member.version, level: panel.level, rank: panel.rank,
    skillLevels, cone, whiteStats, relics: [...relics.values()] };
}

export async function compileWorkerBuild(request: WorkerBuildRequest,
  library: TemplateLibrary = templateLibrary): Promise<CompiledWorkerBuild> {
  const { roles, cycle, enemies } = request;
  if (!Array.isArray(roles) || roles.length < 1 || roles.length > 4 ||
      !Number.isInteger(cycle) || cycle < 1 || cycle > 20 || ![1, 3, 5].includes(enemies)) {
    throw new TypeError("无效队伤请求");
  }
  const team: ActorBuild[] = [];
  const notices: string[] = [];
  const panelCalibration = new Map<string, PanelCalibration>();
  for (const member of roles) {
    if (!/^[1-9][0-9]{3}$/.test(member.id)) throw new TypeError("无效角色标识");
    const template = await library.read("characters", member.id, member.version);
    team.push(member.panel ? await makeOwned(member, template, member.panel, notices, panelCalibration, library)
      : makeDefaults(member, template));
  }
  const { modes } = await getRulebook();
  const mode = "forgotten_hall";
  const cycleRule = modes[mode];
  if (!cycleRule) throw new TypeError("缺少忘却之庭轮次配置");
  const stage = { id: "lotus_team_simulation", mode,
    maxActionValue: cycleRule.first_cycle_av + cycleRule.subsequent_cycle_av * (cycle - 1),
    enemies: Array.from({ length: enemies }, (_, index) => ({
      template: "sandbag", id: "enemy_" + (index + 1), name: "假人 " + (index + 1),
    })),
  };
  return { encounter: await compileEncounter({ team, stage }, library), panelCalibration, notices };
}

/** Diff the saved panel against pre-battle effective stats, without applying a cone passive twice. */
export function panelResidual(actor: CompiledActor, baseline: EffectivePanel, { stats, conePanelEffects }: PanelCalibration): Numbers {
  const residual: Record<string, number> = {};
  for (const [key, value] of Object.entries(stats)) {
    const element = damageElement(key);
    if (element) {
      residual["dmg_" + element] = value - (baseline.damageBonus[element] ?? 0) -
        (baseline.damageBonus.all ?? 0) - (conePanelEffects[key] ?? 0);
      continue;
    }
    const field = scalarStats[key];
    const base = field ? baseline.stats[field] : undefined;
    if (!field || base === undefined) continue;
    const percentage = key === "spd" ? "speedPct" : key + "Pct";
    const known = (conePanelEffects[key] ?? 0) + (primary.some(stat => stat === key)
      ? (conePanelEffects[percentage] ?? 0) * (actor.stats[field] ?? 0) : 0);
    residual[field] = value + Number(key === "energyRegen") - base - known;
  }
  return residual;
}
