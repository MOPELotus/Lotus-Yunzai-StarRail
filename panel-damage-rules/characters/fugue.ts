import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.fugue.text_d9539e2a91"),
  check: ({ cons }) => cons < 6,
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg1 = dmg(talent.a2!['技能伤害']!, 'a')
    let atkDmg2 = dmg(talent.a2!['相邻目标伤害']!, 'a')
    let BreakAvg = dmg.reaction('fireBreak').avg / 0.9  * ( 10 + 2 ) / 4 * (1 + (cons >= 6 ? 0.2 : 0))
    return {
      dmg: atkDmg1.dmg! + BreakAvg + 2 * (atkDmg2.dmg! + BreakAvg),
      avg: atkDmg1.avg + BreakAvg + 2 * (atkDmg2.avg + BreakAvg)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_d118433b2a"),
  params: { eBuff: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg1 = dmg(talent.a2!['技能伤害']!, 'a')
    let atkDmg2 = dmg(talent.a2!['相邻目标伤害']!, 'a')
    let BreakAvg = dmg.reaction('fireBreak').avg / 0.9  * ( 10 + 2 ) / 4 * (1 + (cons >= 4 ? 0.2 : 0))
    return {
      dmg: atkDmg1.dmg! + BreakAvg + 2 * (atkDmg2.dmg! + BreakAvg),
      avg: atkDmg1.avg + BreakAvg + 2 * (atkDmg2.avg + BreakAvg)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_be5706f948"),
  check: ({ cons }) => cons < 6,
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg1 = dmg(talent.a2!['技能伤害']!, 'a')
    let atkDmg2 = dmg(talent.a2!['相邻目标伤害']!, 'a')
    let cost1 = 1 * (1 + (cons >= 6 ? 1 : 0))
    let cost2 = 0.5 * (1 + (cons >= 6 ? 1 : 0))
    let base = talent.t!['超击破伤害']!
    let superBreak1 = dmg.reaction('superBreak').avg / 0.9 * cost1 * base
    let superBreak2 = dmg.reaction('superBreak').avg / 0.9 * cost2 * base
    return {
      dmg: atkDmg1.dmg! + superBreak1 + 2 * (atkDmg2.dmg! + superBreak2),
      avg: atkDmg1.avg + superBreak1 + 2 * (atkDmg2.avg + superBreak2)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_36fb6335fc"),
  params: { eBuff: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg1 = dmg(talent.a2!['技能伤害']!, 'a')
    let atkDmg2 = dmg(talent.a2!['相邻目标伤害']!, 'a')
    let cost1 = 1 * (1 + (cons >= 1 ? 0.5 : 0) + (cons >= 6 ? 0.5 : 0))
    let cost2 = 0.5 * (1 + (cons >= 1 ? 0.5 : 0) + (cons >= 6 ? 0.5 : 0))
    let base = talent.t!['超击破伤害']!
    let superBreak1 = dmg.reaction('superBreak').avg / 0.9 * cost1 * base
    let superBreak2 = dmg.reaction('superBreak').avg / 0.9 * cost2 * base
    return {
      dmg: atkDmg1.dmg! + superBreak1 + 2 * (atkDmg2.dmg! + superBreak2),
      avg: atkDmg1.avg + superBreak1 + 2 * (atkDmg2.avg + superBreak2)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_82d5db4189"),
  check: ({ cons }) => cons < 6,
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg = dmg(talent.q!['技能伤害']!, 'q')
    let BreakAvg = dmg.reaction('fireBreak').avg / 0.9  * ( 10 + 2 ) / 4 * (1 + (cons >= 6 ? 0.2 : 0))
    return {
      dmg: 3 * (atkDmg.dmg! + BreakAvg),
      avg: 3 * (atkDmg.avg + BreakAvg)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_d6e0b9a132"),
  params: { eBuff: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg = dmg(talent.q!['技能伤害']!, 'q')
    let BreakAvg = dmg.reaction('fireBreak').avg / 0.9  * ( 10 + 2 ) / 4 * (1 + (cons >= 4 ? 0.2 : 0))
    return {
      dmg: 3 * (atkDmg.dmg! + BreakAvg),
      avg: 3 * (atkDmg.avg + BreakAvg)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_4c1922dd0e"),
  check: ({ cons }) => cons < 6,
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg = dmg(talent.q!['技能伤害']!, 'q')
    let cost = 2 * (1 + (cons >= 6 ? 1 : 0))
    let base = talent.t!['超击破伤害']!
    let superBreak = dmg.reaction('superBreak').avg / 0.9 * cost * base
    return {
      dmg: 3 * (atkDmg.dmg! + superBreak),
      avg: 3 * (atkDmg.avg + superBreak)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_8d92107bcd"),
  params: { eBuff: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let atkDmg = dmg(talent.q!['技能伤害']!, 'q')
    let cost = 2 * (1 + (cons >= 1 ? 0.5 : 0) + (cons >= 6 ? 0.5 : 0))
    let base = talent.t!['超击破伤害']!
    let superBreak = dmg.reaction('superBreak').avg / 0.9 * cost * base
    return {
      dmg: 3 * (atkDmg.dmg! + superBreak),
      avg: 3 * (atkDmg.avg + superBreak)
    }
  }
}]

export const mainAttr = 'atk,stance'
export const defDmgIdx = 7

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.fugue.text_4d3e6d24f5"),
  check: ({ params }) => params.eBuff === true,
  data: {
    stance: ({ talent }) => talent.e!['击破特攻提高']! * 100,
    enemyDef: ({ talent }) => talent.e!['防御力降低']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_72727454b8"),
  tree: 2,
  data: {
    stance: 30
  }
}, {
  title: $t("panel-damage-rules.characters.fugue.text_fb09b0e415"),
  cons: 1
}, {
  title: $t("panel-damage-rules.characters.fugue.text_636159e985"),
  cons: 4
},{
  title: $t("panel-damage-rules.characters.fugue.text_ebb8619264"),
  cons: 6
}]

export const createdBy = $t("panel-damage-rules.characters.fugue.text_12dc7e3fa4")
