import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.lingsha.text_e813c6666d"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.atk!) * talent.e!['回复·百分比攻击']! + talent.e!['回复·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.lingsha.text_c2aa73a5df"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.atk!) * talent.q!['回复·百分比攻击']! + talent.q!['回复·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.lingsha.text_6c58d98ff1"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.atk!) * talent.t!['回复·百分比攻击']! + talent.t!['回复·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.lingsha.text_76a243194a"),
  params: { qBuff: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg = dmg(talent.q!['技能伤害']!, 'q')
    let BreakAvg = dmg.reaction('fireBreak').avg / 0.9  * ( 2 + 2 ) / 4
    return {
      dmg: atkDmg.dmg! + BreakAvg,
      avg: atkDmg.avg + BreakAvg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.lingsha.text_8d4ff47cd2"),
  params: { qBuff: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg = dmg(talent.q!['技能伤害']!, 'q')
    let BreakAvg = dmg.reaction('fireBreak').avg / 0.9  * ( 10 + 2 ) / 4
    return {
      dmg: atkDmg.dmg! + BreakAvg,
      avg: atkDmg.avg + BreakAvg
    }
  }
}]

export const mainAttr = 'atk,stance'
export const defDmgIdx = 4

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.lingsha.text_98a6086daa"),
  check: ({ params }) => params.qBuff === true,
  data: {
    breakEnemydmg: ({ talent }) => talent.q!['受到击破伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.lingsha.text_cf9f26fcdd"),
  tree: 1,
  data: {
    atk: ({ attr }) => Math.min(attr.stance! * 0.25, 50),
    heal: ({ attr }) => Math.min(attr.stance! * 0.1, 20)
  }
}, {
  title: $t("panel-damage-rules.characters.lingsha.text_6e704249df"),
  cons: 1,
  data: {
    enemyDef: 20
  }
}, {
  title: $t("panel-damage-rules.characters.lingsha.text_f710460fa2"),
  cons: 2,
  data: {
    stance: 20
  }
},{
  title: $t("panel-damage-rules.characters.lingsha.text_4f0ccb2e0b"),
  cons: 6,
  check: ({ params }) => params.q === true,
  data: {
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.lingsha.text_12dc7e3fa4")
