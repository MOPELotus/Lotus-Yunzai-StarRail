import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.march-preservation.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.march-preservation.text_9953377f67"),
  dmg: ({ talent, attr, calc }, { shield }) => shield(calc(attr.def!) * talent.e!['百分比防御']! + talent.e!['固定值']!)
}, {
  title: $t("panel-damage-rules.characters.march-preservation.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.march-preservation.text_9f3fe1e15f"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['冻结回合开始伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.march-preservation.text_8eb243b9d5"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['反击伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.march-preservation.text_4ae5ec77f9"),
  cons: 2,
  dmg: ({ attr, calc }, { shield }) => shield(calc(attr.def!) * 0.24 + 320)
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,def,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.march-preservation.text_d6e899caa0"),
  cons: 4,
  data: {
    tPlus: ({ calc, attr }) => calc(attr.def!) * 0.3
  }
}]

export const createdBy = 'Aluxes'
