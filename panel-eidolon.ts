// Tier overrides retain the base skill levels used by the fixed CharTalent.js.
import { object, recoverStarRailSkillLevel, starRailLegacySkillLevel, type PanelAvatar } from "./panel-model.ts";

export function changePanelEidolon(target: PanelAvatar, rank: number, talentCons: unknown) {
  const upgrades = object(talentCons);
  const missing = { error: `「${target.name}」换星魂暂不可用，缺少可确认的星魂、技能等级或加级资料。` };
  if (!upgrades || (!target.legacy && target.rank === undefined)) return missing;

  const skillKeys = ["a", "e", "q", "t", ...["me", "mt", "xe"].filter(key => Object.hasOwn(upgrades, key))];
  const skills = new Map(target.skills.map(skill => [skill.key, skill.level]));
  if (skillKeys.some(key => {
    const level = skills.get(key);
    const entry = upgrades[key];
    const thresholds: unknown[] = Array.isArray(entry) ? entry : [entry];
    return !level || !Number.isInteger(level) || level < 1 || starRailLegacySkillLevel(key, level, 0, undefined) !== level ||
      !thresholds.length || thresholds.some(value => typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 6);
  })) return missing;

  const adjusted: PanelAvatar["skills"] = [];
  for (const skill of target.skills) {
    if (target.legacy || !skillKeys.includes(skill.key)) {
      adjusted.push(skill);
      continue;
    }
    const original = recoverStarRailSkillLevel(skill.key, skill.level, target.rank!, rank, upgrades[skill.key]);
    if (original === undefined) return missing;
    adjusted.push({ ...skill, original, level: starRailLegacySkillLevel(skill.key, original, rank, upgrades[skill.key]) });
  }
  const avatar = { ...target, rank, skills: adjusted, stats: [] };
  return { avatar, label: `临时星魂 · ${rank}魂` };
}
