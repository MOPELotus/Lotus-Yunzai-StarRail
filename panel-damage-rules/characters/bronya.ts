import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.bronya.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.bronya.text_01d445b181"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.e!['伤害提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.bronya.text_b2d52a186a"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['攻击力提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.bronya.text_7edfea4df1"),
  dmg: ({ attr, calc, talent }) => {
    return {
      avg: Format.percent(calc(attr.cdmg!) * talent.q!['百分比暴伤']! / 100 + talent.q!['固定暴伤']!),
      type: 'text'
    }
  }
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.bronya.text_bdddce31fa"),
  tree: 3,
  data: {
    dmg: 10
  }
}, {
  title: $t("panel-damage-rules.characters.bronya.text_7f2f192db3"),
  tree: 1,
  data: {
    aCpct: 100
  }
}]
