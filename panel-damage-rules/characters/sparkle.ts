import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.sparkle.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.sparkle.text_5b8030bf2b"),
  dmg: ({ talent, attr, cons }) => {
    let extraCdmg = cons >= 6 ? 0.3 * attr.cdmg! / 100 : 0
    return {
      avg: Format.percent(talent.e!['百分比爆伤']! * attr.cdmg! / 100 + talent.e!['额外爆伤']! + extraCdmg),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sparkle.text_ad6e782c35"),
  check: ({ cons }) => cons >= 2,
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(0.24),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sparkle.text_7d0e467806"),
  dmg: ({ talent }) => {
    let dmgNum = (talent.q!['天赋增伤每层额外提高']! + talent.t!['伤害提高']!) * 3
    return {
      avg: Format.percent(dmgNum),
      type: 'text'
    }
  }
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.sparkle.text_f626488eb3"),
  data: {
    atkPct: 20
  }
}, {
  title: $t("panel-damage-rules.characters.sparkle.text_63818e210a"),
  sort: 9,
  cons: 6,
  data: {
    _cdmg: ({ attr }) => attr.cdmg! * 0.3
  }
}]

export const createdBy = 'Aluxes'
