import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.fu-xuan.text_a900baa1d0"),
  dmg: ({ talent, attr, calc }, { basic }) => {
    const hp = calc(attr.hp!)
    return basic(talent.a!['技能伤害']! * hp, 'a')
  }
}, {
  title: $t("panel-damage-rules.characters.fu-xuan.text_789e7606e1"),
  dmg: ({ talent, attr, calc }) => {
    return {
      avg: calc(attr.hp!) * talent.e!['生命上限提高']!,
      metric: 'support'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fu-xuan.text_022e6a0c08"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.e!['暴击率提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fu-xuan.text_b6a5fc7f30"),
  dmg: ({ talent, attr, calc }, { basic }) => {
    const hp = calc(attr.hp!)
    return basic(talent.q!['技能伤害']! * hp, 'q')
  }
}, {
  title: $t("panel-damage-rules.characters.fu-xuan.text_062180fb29"),
  tree: 2,
  dmg: ({ attr, calc }, { heal }) => heal(calc(attr.hp!) * 0.05 + 133)
}]

export const mainAttr = 'cpct,cdmg,hp'
export const defDmgIdx = 4

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.fu-xuan.text_027897638a"),
  sort: 0,
  data: {
    hpPlus: ({ talent, attr, calc }) => calc(attr.hp!) * talent.e!['生命上限提高']!,
    cpct: ({ talent }) => talent.e!['暴击率提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.fu-xuan.text_051e203c2f"),
  cons: 1,
  data: {
    cdmg: 30
  }
}, {
  title: $t("panel-damage-rules.characters.fu-xuan.text_3a9744806a"),
  cons: 6,
  data: {
    qPlus: ({ attr, calc }) => calc(attr.hp!) * 1.2
  }
}]

export const createdBy = 'Aluxes'
