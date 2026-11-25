import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.hook.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.hook.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['单体伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.hook.text_aa10a3aec3"),
  dmg: ({ talent }, dmg) => dmg(talent.e2!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.hook.text_75f5ee444e"),
  dmg: ({ talent }, dmg) => dmg(talent.e2!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.hook.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.hook.text_c4639706bb"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['持续伤害']!, 'dot', 'skillDot')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg,dmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.hook.text_21334ad934"),
  cons: 1,
  data: {
    eDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.hook.text_c12f1d066c"),
  cons: 6,
  data: {
    dmg: 20
  }
}]

export const createdBy = 'Aluxes'
