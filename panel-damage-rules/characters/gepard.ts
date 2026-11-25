import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.gepard.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.gepard.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.gepard.text_2f5c203ac1"),
  dmg: ({ attr, calc, talent }, { shield }) => shield(calc(attr.def!) * talent.q!['百分比防御力']! + talent.q!['固定数值']!)
}, {
  title: $t("panel-damage-rules.characters.gepard.text_dd16ee5828"),
  dmg: ({ attr, calc }, { shield }) => shield(calc(attr.def!) * 0.24 + 150)
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg,def'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.gepard.text_cac1bd217d"),
  tree: 3,
  data: {
    atkPlus: ({ calc, attr }) => calc(attr.def!) * 0.35
  }
}]
