import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.castorice.text_a900baa1d0"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.castorice.text_ef9a46e334"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.castorice.text_f647479cc6"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.e!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.castorice.text_0df52ebdb5"),
  params: { cons1: true },
  dmg: ({ talent, cons, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.e2!['遐蝶伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.castorice.text_a12dcef4e8"),
  params: { cons1: true },
  dmg: ({ talent, cons, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.e2!['死龙伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.castorice.text_6d79479b4c"),
  params: { cons1: true },
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.mt2!['技能伤害']!, 'mt')
}, {
  title: $t("panel-damage-rules.characters.castorice.text_2286ea0882"),
  params: { cons1: true },
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.me!['技能伤害']!, 'me')
}, {
  title: $t("panel-damage-rules.characters.castorice.text_1c134e3d48"),
  params: { cons1: true },
  dmg: ({ talent, cons, attr, calc }, { basic }) => {
    let cost = cons > 1 ? 4 : 2
    let meDmg1 = basic(calc(attr.hp!) * talent.me2!["技能伤害"]!, "me", false, { dynamicDmg: 30 })
    let meDmg2 = basic(calc(attr.hp!) * talent.me2!["二次释放伤害"]!, "me", false, { dynamicDmg: 60 })
    let meDmg3 = basic(calc(attr.hp!) * talent.me2!["三次释放伤害"]!, "me", false, { dynamicDmg: 90 })
    for (let i = 1; i < cost; i++) {
      let dmg = basic(calc(attr.hp!) * talent.me2!["三次释放伤害"]!, "me", false, { dynamicDmg: 90 + 30 * i })
      meDmg3.dmg! += dmg.dmg!
      meDmg3.avg += dmg.avg
    }
    let meDmg4 = basic(calc(attr.hp!) * talent.me2!["灼掠幽墟的晦翼伤害"]! * (cons === 6 ? 9 : 6), "mt", false, { dynamicDmg: 60 + 30 * cost })
    return {
      dmg: meDmg1.dmg! + meDmg2.dmg! + meDmg3.dmg! + meDmg4.dmg!,
      avg: meDmg1.avg + meDmg2.avg + meDmg3.avg + meDmg4.avg
    }
  }
}]

export const defDmgIdx = 3
export const defParams = { Memosprite: true }
export const mainAttr = 'hp,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.castorice.text_440558c5ea"),
  data: {
    dmg: ({ talent }) => talent.t!['伤害提高']! * 100 * 3
  }
}, {
  title: $t("panel-damage-rules.characters.castorice.text_4e87152f41"),
  data: {
    kx: ({ talent }) => talent.q!['抗性降低']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.castorice.text_70658186e8"),
  data: {
    dmg: 10
  }
}, {
  check: ({ params }) => params.cons1 === true,
  title: $t("panel-damage-rules.characters.castorice.text_02554cc74d"),
  cons: 1,
  data: {
    multi: 40
  }
}, {
  title: $t("panel-damage-rules.characters.castorice.text_6ca3cc0e27"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.castorice.text_ca6c33df17")
