import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.sunday.text_8093f31f6c"),
  dmg: ({ talent, attr, cons }) => {
    return {
      avg: Format.percent(talent.e!['造成的伤害提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sunday.text_f2bc62a677"),
  dmg: ({ talent, attr, cons }) => {
    return {
      avg: Format.percent(talent.e!['造成的伤害提高']! * (1 + talent.e!['增伤额外提高']!)),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sunday.text_7c801fc5f7"),
  dmg: ({ talent, attr, cons }) => {
    return {
      avg: Format.percent(talent.t!['暴击率提高']! * (cons >= 6 ? 3 : 1)),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sunday.text_328c861aa3"),
  dmg: ({ talent, attr, cons }) => {
    return {
      avg: Format.percent(talent.q!['爆伤提高·百分比']! * attr.cdmg! / 100 + talent.q!['爆伤提高·固定值']!),
      type: 'text'
    }
  }
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const createdBy = $t("panel-damage-rules.characters.sunday.text_12dc7e3fa4")
