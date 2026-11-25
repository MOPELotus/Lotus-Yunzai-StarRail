import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
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
    return { error: $t("panel-skill-preview.text_e8ca247cfb", { "name": target.name }) };
  }
  const icons = new Map(target.skills.map(skill => [skill.key, skill.icon]));
  const skills = keys.map(key => ({ key, icon: icons.get(key) ?? "", ...starRailSpecifiedSkillLevel(key, requested[key], rank, upgrades[key]) }));
  const label = $t("panel-skill-preview.text_8159b42b98", { "value1": skills.map(skill => skill.level).join("/") });
  return { avatar: { ...target, skills, stats: [] }, label };
}
