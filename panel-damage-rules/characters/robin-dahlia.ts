import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

// 气氛值：2命前为44点，2命后（含2命）为70点
const getAtmosphere = (cons: number) => cons >= 2 ? 70 : 44

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.robin-dahlia.text_d2239bb62d"),
  dmg: ({ talent, cons, calc, attr }, { basic }) => basic(calc(attr.hp!) * 0.7 * talent.me!['技能伤害']! * (cons >= 6 ? 2 : 1), 'me')
}, {
  title: $t("panel-damage-rules.characters.robin-dahlia.text_563aceb11b"),
  dmg: ({ cons, calc, attr }) => {
    const avg = Math.round(calc(attr.hp!) * (0.16 + getAtmosphere(cons) * 0.004) * 10) / 10
    return { avg, display: String(avg), metric: 'support' }
  }
}, {
  title: $t("panel-damage-rules.characters.robin-dahlia.text_685bab63c5"),
  dmg: ({ cons }) => {
    return {
      avg: Format.percent(0.4 + getAtmosphere(cons) * 0.015),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.robin-dahlia.text_46530c3cb1"),
  dmg: ({ talent, cons }) => {
    return {
      avg: Format.percent(talent.t!['无视防御']! + getAtmosphere(cons) * 0.005),
      type: 'text'
    }
  }
}]

export const defDmgIdx = 0
export const defParams = { Memosprite: true }
export const mainAttr = 'hp,speed,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.robin-dahlia.text_e6a66eb69e"),
  tree: 3,
  data: {
    cpct: 50
  }
}, {
  title: $t("panel-damage-rules.characters.robin-dahlia.text_9cc80617c0"),
  data: {
    _atmosphere: ({ cons }) => getAtmosphere(cons),
    dmg: ({ talent, cons }) => (talent.mt!['伤害提高1']! + getAtmosphere(cons) * talent.mt!['伤害提高2']!) * 100
  }
}, {
  check: ({ params }) => params.Memosprite === true,
  title: $t("panel-damage-rules.characters.robin-dahlia.text_28bc433cd7"),
  data: {
    enemydmg: ({ talent }) => talent.mt!['受到的伤害提高3']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.robin-dahlia.text_e50ea80a91"),
  data: {
    _atmosphere: ({ cons }) => getAtmosphere(cons),
    ignore: ({ talent, cons }) => (talent.t!['无视防御']! + getAtmosphere(cons) * 0.005) * 100
  }
}, {
  title: $t("panel-damage-rules.characters.robin-dahlia.text_c8fecbf156"),
  cons: 2,
  data: {
    kx: 18
  }
}]
