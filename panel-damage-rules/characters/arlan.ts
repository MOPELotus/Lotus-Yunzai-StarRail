import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.arlan.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.arlan.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.arlan.text_865663ca7b"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.arlan.text_d84ee1cece"),
  dmg: ({ talent, cons }, dmg) => cons < 6 ? dmg(talent.q!['相邻目标伤害']!, 'q') : dmg(talent.q!['技能伤害']!, 'q')
}]

export const mainAttr = 'atk,cpct,cdmg,dmg'
export const defDmgIdx = 2

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.arlan.text_c29ff966e3"),
  data: {
    dmg: ({ talent }) => talent.t!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.arlan.text_89daef0c3c"),
  cons: 1,
  data: {
    eDmg: 10
  }
}, {
  title: $t("panel-damage-rules.characters.arlan.text_92f77d4bfd"),
  cons: 6,
  data: {
    qDmg: 20
  }
}]

export const createdBy = 'Aluxes'
