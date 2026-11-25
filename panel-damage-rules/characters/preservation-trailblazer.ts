import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.preservation-trailblazer.text_a900baa1d0"),
  dmg: ({ talent, cons, attr }, { basic }) => {
    let atkTd = talent.a!['技能伤害']!
    let defTd = cons >= 1 ? 0.25 : 0
    return basic(atkTd * attr.atk! + defTd * attr.def!, 'a')
  }
}, {
  title: $t("panel-damage-rules.characters.preservation-trailblazer.text_626e77491e"),
  dmg: ({ talent, cons, attr }, { basic }) => {
    let atkTd = talent.a2!['技能伤害']! + talent.a2!['相邻目标伤害']! * 2
    let defTd = cons >= 1 ? 0.5 * 3 : 0
    return basic(atkTd * attr.atk! + defTd * attr.def!, 'a')
  }
}, {
  title: $t("panel-damage-rules.characters.preservation-trailblazer.text_b6a5fc7f30"),
  dmg: ({ talent, attr }, { basic }) => {
    let atkTd = talent.q!['攻击力倍率']!
    let defTd = talent.q!['防御力倍率']!
    return basic(atkTd * attr.atk! + defTd * attr.def!, 'q')
  }
}, {
  title: $t("panel-damage-rules.characters.preservation-trailblazer.text_bf3f43a297"),
  dmg: ({ talent, attr, cons }, { shield }) => {
    let extraDefTd = cons >= 2 ? 0.02 : 0
    let extraConstTd = cons >= 2 ? 27 : 0
    let defTd = extraDefTd + talent.t!['百分比防御']!
    let constTd = extraConstTd + talent.t!['固定值']!
    return shield(defTd * attr.def! + constTd)
  }
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg,def'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.preservation-trailblazer.text_541dbf1960"),
  cons: 6,
  data: {
    defPct: 30
  }
}]

export const createdBy = 'Aluxes'
