import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
// Tier overrides retain the base skill levels used by the fixed CharTalent.js.
import { object, recoverStarRailSkillLevel, starRailLegacySkillLevel, type PanelAvatar } from "./panel-model.ts";

export function changePanelEidolon(target: PanelAvatar, rank: number, talentCons: unknown) {
  const upgrades = object(talentCons);
  const missing = { error: $t("panel-eidolon.text_07872403c5", { "name": target.name }) };
  if (!upgrades || (target.rank === undefined && (!target.legacy || target.skills.some(skill => skill.effective)))) return missing;

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
    if ((target.legacy && !skill.effective) || !skillKeys.includes(skill.key)) {
      adjusted.push(skill);
      continue;
    }
    const original = recoverStarRailSkillLevel(skill.key, skill.level, target.rank!, rank, upgrades[skill.key]);
    if (original === undefined) return missing;
    adjusted.push({ ...skill, original, level: starRailLegacySkillLevel(skill.key, original, rank, upgrades[skill.key]) });
  }
  const avatar = { ...target, rank, skills: adjusted, stats: [] };
  return { avatar, label: $t("panel-eidolon.text_36dbcd38ea", { "rank": rank }) };
}
