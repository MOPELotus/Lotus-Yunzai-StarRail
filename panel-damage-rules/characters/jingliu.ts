import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.jingliu.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_dc753f33f3"),
  params: { strength: true },
  dmg: ({ talent }, dmg) => dmg(talent.e2!['目标伤害']! + talent.e2!['相邻目标伤害']! * 2, 'e')
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_a8b5ec058a"),
  params: { q: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['目标伤害']! + talent.q!['相邻目标伤害']! * 2, 'q')
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_6cb8b268e9"),
  params: { strength: true, q: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['目标伤害']! + talent.q!['相邻目标伤害']! * 2, 'q')
}]

export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.jingliu.text_df95a1414c"),
  tree: 3,
  check: ({ params }) => params.strength === true,
  data: {
    qDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_fe37a5a161"),
  check: ({ params }) => params.strength === true,
  data: {
    cpct: ({ talent }) => talent.t!['暴击率提高']! * 100,
    atkPlus: ({ attr, talent }) => attr.atk!.base! * talent.t!['攻击力提高上限']!
  }
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_c718bd64b3"),
  cons: 1,
  check: ({ params }) => params.strength === true || params.q === true,
  data: {
    cdmg: 24
  }
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_f980aff2e5"),
  cons: 2,
  check: ({ params }) => params.strength === true,
  data: {
    eDmg: 80
  }
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_1e22acae0a"),
  check: ({ params }) => params.strength === true,
  cons: 4,
  data: {
    atkPlus: ({ attr }) => attr.atk!.base! * 0.3
  }
}, {
  title: $t("panel-damage-rules.characters.jingliu.text_0149cb228e"),
  check: ({ params }) => params.strength === true,
  cons: 6,
  data: {
    cdmg: 50
  }
}]

export const createdBy = 'Aluxes'
