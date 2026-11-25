import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.hyacine.text_9b219881d5"),
  params: { AfterRain: true },
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_0c4e5596f6"),
  params: { AfterRain: true },
  dmg: ({ talent, attr, calc }, { heal }) => heal(calc(attr.hp!) * talent.e!['治疗·百分比生命']! + talent.e!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_c34fe22f02"),
  dmg: ({ talent, attr, calc }, { heal }) => heal(calc(attr.hp!) * talent.q!['治疗·百分比生命']! + talent.q!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_7be48f3624"),
  params: { AfterRain: true },
  dmg: ({ talent, attr, calc }, { heal }) => heal(calc(attr.hp!) * talent.mt!['治疗·百分比生命']! * 2 + talent.mt!['治疗·固定值']! * 2)
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_713ea250eb"),
  params: { AfterRain: true },
  dmg: ({ talent, attr, calc }, { heal }) => heal(calc(attr.hp!) * 0.08)
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_3cb6ccd030"),
  params: { AfterRain: true , ServantDmg: true},
  dmg: ({ talent, attr, cons, calc }, { heal, basic }) => {
    let dmg = 0
    let avg = 0
    // 小伊卡治疗单个其他单位治疗量
    let perHeal = heal(calc(attr.hp!) * talent.mt!['治疗·百分比生命']! + talent.mt!['治疗·固定值']!)
    let HealServant = perHeal.avg
    // 有专武情况下算上风堇放技能全队烧血治疗
    let cureDelta = 0
    if ( attr.weapon!.name! === '愿虹光永驻天空') {
      cureDelta += 11 * HealServant   // 11是因为, 我方一共6个目标的前提下, 天赋5次, 雨过天晴全体算6次
    }
    // 释放e
    let healE = heal(5 * (calc(attr.hp!) * talent.e!['治疗·百分比生命']! + talent.e!['治疗·固定值']!) + 1 * (calc(attr.hp!) * talent.e!['小伊卡治疗·百分比生命']! + talent.e!['小伊卡治疗·固定值']!))
    let nume = healE.avg + cureDelta
    // 释放q
    let healQ = heal(5 * (calc(attr.hp!) * talent.q!['治疗·百分比生命']! + talent.q!['治疗·固定值']!) + 1 * (calc(attr.hp!) * talent.q!['小伊卡治疗·百分比生命']! + talent.q!['小伊卡治疗·固定值']!))
    let numq = healQ.avg + cureDelta
    // 风堇技能平均治疗
    let numEQ = (nume * 2 + numq * 1) / 3
    // 受击治疗量
    let numHit = 7 * HealServant
    // 队友主动烧血治疗量
    let numConsume = 0
    // 1魂攻击附加治疗量
    let HealCon1 = cons > 0 ? heal(calc(attr.hp!) * 0.08) : {avg: 0}
    let numCon1 = 6 * HealCon1.avg
    // 治疗累积值
    let cureAmount = numEQ + numHit + numConsume + numCon1
    // 计算稳定累积治疗值并乘0.8以参考 (经验值, 以代替等比数列的循环求和计算, 可改)
    //let exprVal = cons === 6 ? 0.8 : 0.4
    //let cureMaxRate = cons === 6 ? 8.33 : 2    // 6 ? 1/(1-0.88) : １/(1-0.5)
    cureAmount *= (cons === 6 ? 3.4 : 1.6)
    // 计算伤害
    let tmp = basic(cureAmount * talent.me!['技能伤害']!, 'me')
    dmg += tmp.dmg!, avg += tmp.avg
    return {
      dmg: dmg,
      avg: avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_0adbb3a32b"),
  params: { AfterRain: true , ServantDmg: true },
  dmg: ({ talent, attr, cons, calc }, { heal, basic }) => {
    let dmg = 0
    let avg = 0
    // 小伊卡治疗单个其他单位治疗量
    let perHeal = heal(calc(attr.hp!) * talent.mt!['治疗·百分比生命']! + talent.mt!['治疗·固定值']!)
    let HealServant = perHeal.avg
    // 有专武情况下算上风堇放技能全队烧血治疗
    let cureDelta = 0
    if ( attr.weapon!.name! === '愿虹光永驻天空') {
      cureDelta += 13 * HealServant   // 13是因为, 我方一共7个目标的前提下, 天赋6次, 雨过天晴全体算7次
    }
    // 释放e
    let healE = heal(6 * (calc(attr.hp!) * talent.e!['治疗·百分比生命']! + talent.e!['治疗·固定值']!) + 1 * (calc(attr.hp!) * talent.e!['小伊卡治疗·百分比生命']! + talent.e!['小伊卡治疗·固定值']!))
    let nume = healE.avg + cureDelta
    // 释放q
    let healQ = heal(6 * (calc(attr.hp!) * talent.q!['治疗·百分比生命']! + talent.q!['治疗·固定值']!) + 1 * (calc(attr.hp!) * talent.q!['小伊卡治疗·百分比生命']! + talent.q!['小伊卡治疗·固定值']!))
    let numq = healQ.avg + cureDelta
    // 风堇技能平均治疗
    let numEQ = (nume * 2+numq * 1) / 3
    // 受击治疗量
    let numHit = 7 * HealServant
    // 队友主动烧血治疗量
    let numConsume = 11 * HealServant
    // 1魂攻击附加治疗量
    let HealCon1 = cons > 0 ? heal(calc(attr.hp!) * 0.08) : {avg: 0}
    let numCon1 = 6 * HealCon1.avg
    // 治疗累积值
    let cureAmount = numEQ + numHit + numConsume + numCon1
    // 计算稳定累积治疗值并乘0.8以参考 (经验值, 以代替等比数列的循环求和计算, 可改)
    //let exprVal = cons === 6 ? 0.8 : 0.4
    //let cureMaxRate = cons === 6 ? 8.33 : 2    // 6 ? 1/(1-0.88) : １/(1-0.5)
    cureAmount *= (cons === 6 ? 3.4 : 1.6)
    // 计算伤害
    let tmp = basic(cureAmount * talent.me!['技能伤害']!, 'me')
    dmg += tmp.dmg!, avg += tmp.avg
    return {
      dmg: dmg,
      avg: avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_4afe963acd"),
  params: { AfterRain: true },
  dmg: ({ talent, attr, calc }, { heal }) => {
    let perHeal = heal(calc(attr.hp!) * talent.e!['治疗·百分比生命']! + talent.e!['治疗·固定值']!)
    let num = 6 * perHeal.avg
    if ( attr.weapon!.name! === '愿虹光永驻天空') {
      let servantHeal = heal(calc(attr.hp!) * talent.mt!['治疗·百分比生命']! + talent.mt!['治疗·固定值']!)
      num += 11 * servantHeal.avg
    }
    num = Math.floor( num / 340 )
    return {
      avg: num,
      metric: 'support'
    }
  }
}]

export const mainAttr = 'hp,cpct,cdmg'
export const defParams = { Memosprite: true }
export const defDmgIdx = 5

export const buffs: Buff[] = [{
  check: ({ params }) => params.AfterRain === true,
  title: $t("panel-damage-rules.characters.hyacine.text_50e33b1947"),
  data: {
    hpPlus: ({ talent, attr, cons }) => {
      let num = cons > 0 ? 0.5 : 0
      return attr.hp!.base! * (talent.q!['生命提高·百分比生命']! + num) + talent.q!['生命提高·固定值']!
    }
  }
}, {
  check: ({ params }) => params.ServantDmg === true,
  title: $t("panel-damage-rules.characters.hyacine.text_6953dc4449"),
  data: {
    dmg: ({ talent }) => talent.t!['伤害提高']! * 100 * 3,
    _dmmgup: ({talent}) => talent.t!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_2cb4a19821"),
  tree: 1,
  data: {
    cpct: 100
  }
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_4f155f7201"),
  tree: 3,
  sort: 9,
  check: ({ attr, calc }) => calc(attr.speed!) > 200,
  data: {
    hpPct: 20,
    heal: ({ attr, calc }) => Math.min(calc(attr.speed!) - 200, 200),
    cdmg: ({ cons, attr, calc }) => cons > 3 ? (calc(attr.speed!) - 200) * 2 : 0
  }
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_d2984b2edd"),
  cons: 1
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_a5b6bcd0a8"),
  cons: 2,
  data: {
    speedPct: 30
  }
}, {
  title: $t("panel-damage-rules.characters.hyacine.text_1230a5be69"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.hyacine.text_8a82a515b6")
