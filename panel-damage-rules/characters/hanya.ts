import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.hanya.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.hanya.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.hanya.text_fc2b5de6d3"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['速度提升']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.hanya.text_c9a4ad6ba8"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['速度提升']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.hanya.text_be212d5675"),
  dmg: ({ talent, cons }) => {
    let extraTd = cons < 6 ? 0 : 0.1
    return {
      avg: Format.percent(talent.t!['伤害提高']! + extraTd),
      type: 'text'
    }
  }
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg,dmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.hanya.text_ec509f775e"),
  data: {
    _dmg: ({ talent }) => talent.t!['伤害提高']! * 100,
    aDmg: ({ talent }) => talent.t!['伤害提高']! * 100,
    eDmg: ({ talent }) => talent.t!['伤害提高']! * 100,
    qDmg: ({ talent }) => talent.t!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.hanya.text_1a1a3fb9aa"),
  cons: 2,
  data: {
    speedPct: 20
  }
}, {
  title: $t("panel-damage-rules.characters.hanya.text_ec3cfea7a4"),
  cons: 6,
  data: {
    _dmg: 10,
    aDmg: 10,
    eDmg: 10,
    qDmg: 10
  }
}]

export const createdBy = 'Aluxes'
