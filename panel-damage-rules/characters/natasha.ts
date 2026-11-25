import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.natasha.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.natasha.text_e813c6666d"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.e!['治疗·百分比生命']! + talent.e!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.natasha.text_97ea4582af"),
  params: { tBuff: true },
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.e!['治疗·百分比生命']! + talent.e!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.natasha.text_c2aa73a5df"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.q!['百分比生命']! + talent.q!['固定值']!)
}, {
  title: $t("panel-damage-rules.characters.natasha.text_c5bcf6651d"),
  params: { tBuff: true },
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.q!['百分比生命']! + talent.q!['固定值']!)
}, {
  title: $t("panel-damage-rules.characters.natasha.text_be50bc0b25"),
  params: { tBuff: true },
  dmg: ({ calc, attr }, { heal }) => heal(calc(attr.hp!) * 0.15 + 400)
}, {
  title: $t("panel-damage-rules.characters.natasha.text_80e40c2309"),
  params: { tBuff: true },
  dmg: ({ calc, attr }, { heal }) => heal(calc(attr.hp!) * 0.06 + 160)
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg,hp'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.natasha.text_b35a9d7eb5"),
  cons: 6,
  data: {
    aPlus: ({ calc, attr }) => calc(attr.hp!) * 0.4
  }
}, {
  title: $t("panel-damage-rules.characters.natasha.text_b1d5f5058d"),
  check: ({ params }) => params.tBuff === true,
  data: {
    heal: 50
  }
}, {
  title: $t("panel-damage-rules.characters.natasha.text_02dc0461ec"),
  tree: 2,
  data: {
    heal: 10
  }
}]

export const createdBy = 'Aluxes'
