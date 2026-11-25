import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.huohuo.text_a900baa1d0"),
  dmg: ({ talent, attr }, { basic }) => basic(talent.a!['技能伤害']! * attr.hp!, 'a')
}, {
  title: $t("panel-damage-rules.characters.huohuo.text_697a0a5d4c"),
  dmg: ({ talent, attr }, { heal }) => heal(attr.hp! * talent.e!['目标治疗·百分比生命']! + talent.e!['目标治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.huohuo.text_1f6c49662a"),
  dmg: ({ talent, attr }, { heal }) => heal(attr.hp! * talent.e!['相邻目标治疗·百分比生命']! + talent.e!['相邻目标治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.huohuo.text_194bc6aa39"),
  dmg: ({ talent, attr }, { heal }) => heal(attr.hp! * talent.t!['治疗·百分比生命']! + talent.t!['治疗·百分比生命']!)
}]

export const mainAttr = 'hp,cpct,cdmg,heal'
export const defDmgIdx = 1

export const createdBy = 'Aluxes'
