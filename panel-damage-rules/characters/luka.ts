import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.luka.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.luka.text_5da6ea551c"),
  dmg: ({ talent }, dmg) => dmg(talent.a2!['直冲拳每段伤害']! * 3 + talent.a2!['碎天拳伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.luka.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['单体伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.luka.text_c4639706bb"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['持续伤害']!, 'dot', 'skillDot')
}, {
  title: $t("panel-damage-rules.characters.luka.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.luka.text_a83c7f8242"),
  data: {
    enemydmg: ({ talent }) => talent.q!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.luka.text_89b4d72125"),
  cons: 1,
  data: {
    dmg: 15
  }
}, {
  title: $t("panel-damage-rules.characters.luka.text_505855daaf"),
  cons: 4,
  data: {
    atkPct: 20
  }
}]

export const createdBy = 'Aluxes'
