import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.tingyun.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.tingyun.text_5564239ac1"),
  dmg: ({ attr, calc, talent }) => {
    return {
      avg: calc(attr.atk!) * talent.e!['攻击力上限']!,
      metric: 'support'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.tingyun.text_95c246490c"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['伤害提高']!),
      type: 'text'
    }
  }
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.tingyun.text_5d16c5e1f1"),
  tree: 2,
  data: {
    aDmg: 40
  }
}]
