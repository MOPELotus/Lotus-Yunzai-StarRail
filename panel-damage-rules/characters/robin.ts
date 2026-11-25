import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.robin.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.robin.text_2a6201ea3a"),
  dmg: ({ talent }, dmg) => {
    return {
      avg: Format.percent(talent.e!['伤害提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_0e2b024f0c"),
  dmg: ({ talent, attr }, dmg) => {
    return {
      avg: talent.q!['攻击力提高百分比']! * attr.atk! + talent.q!['攻击力提高固定值']!,
      metric: 'support'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_18c9e8f8d1"),
  params: { q: true },
  dmg: ({ talent, cons }, dmg) => {
    // 暴击伤害固定为150%（6命时为600%），且伤害必定暴击
    let cdmgNum = cons < 6 ? 1.5 : 6
    let { avg } = dmg(talent.q!['附加伤害']!, '', 'skillDot') // 无双爆区近似
    return {
      avg: avg * (1 + cdmgNum)
    }
  }
}]

export const mainAttr = 'atk,cpct,cdmg'
export const defDmgIdx = 3

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.robin.text_caf0bf04f4"),
  data: {
    cdmg: ({ talent }) => talent.t!['暴伤提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_40bb6dafda"),
  data: {
    dmg: ({ talent }) => talent.e!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_6782e52007"),
  check: ({ params }) => params.q === true,
  sort: 9,
  data: {
    atkPlus: ({ talent, attr }) => talent.q!['攻击力提高百分比']! * attr.atk! + talent.q!['攻击力提高固定值']!
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_6e96d8ee8e"),
  check: ({ params }) => params.q === true,
  cons: 1,
  data: {
    kx: 24
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_98ec7cdbba"),
  check: ({ params }) => params.q === true,
  cons: 2,
  data: {
    speedPct: 16
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_a5f2a26cd9"),
  cons: 4,
  data: {
    effDef: 50
  }
}, {
  title: $t("panel-damage-rules.characters.robin.text_97410f5aa0"),
  check: ({ params }) => params.q === true,
  cons: 6
}]

export const createdBy = 'Aluxes'
