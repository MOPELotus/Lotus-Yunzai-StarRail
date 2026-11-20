// ProfileChange.js applies the four specified levels via the fixed CharTalent level mode.
import { object, starRailSpecifiedSkillLevel, type PanelAvatar } from "./panel-model.ts";

const keys = ["a", "e", "t", "q"] as const;
export type CoreSkillLevels = Readonly<Record<(typeof keys)[number], number>>;

export function changePanelCoreSkills(
  target: PanelAvatar, requested: CoreSkillLevels, talentCons: unknown,
): { avatar: PanelAvatar; label: string } | { error: string } {
  const upgrades = object(talentCons);
  const rank = target.rank;
  if (!upgrades || rank === undefined || keys.some(key => !Object.hasOwn(upgrades, key))) {
    return { error: `「${target.name}」技能等级试算缺少可确认的星魂或加级资料。` };
  }
  const icons = new Map(target.skills.map(skill => [skill.key, skill.icon]));
  const skills = keys.map(key => ({ key, icon: icons.get(key) ?? "", ...starRailSpecifiedSkillLevel(key, requested[key], rank, upgrades[key]) }));
  const label = `临时技能 · 普攻/战技/天赋/终结技 ${skills.map(skill => skill.level).join("/")}`;
  return { avatar: { ...target, skills, stats: [] }, label };
}
