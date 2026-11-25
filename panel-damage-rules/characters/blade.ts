import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.blade.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.blade.text_da52740a04"),
  params: { ebuff: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const td1 = talent.a2!['攻击倍率']!
    const td2 = talent.a2!['生命倍率']!
    const atk = calc(attr.atk!)
    const hp = calc(attr.hp!)
    return basic(td1 * atk + td2 * hp, 'a')
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_5194ebc2f0"),
  params: { ebuff: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const td1 = talent.a2!['攻击倍率']! + talent.a2!['攻击倍率·相邻目标']! * 2
    const td2 = talent.a2!['生命倍率']! + talent.a2!['生命倍率·相邻目标']! * 2
    const atk = calc(attr.atk!)
    const hp = calc(attr.hp!)
    return basic(td1 * atk + td2 * hp, 'a')
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_28960b911a"),
  params: { ebuff: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const td1 = talent.t!['攻击倍率']!
    const td2 = talent.t!['生命倍率']!
    const atk = calc(attr.atk!)
    const hp = calc(attr.hp!)
    return basic(td1 * atk + td2 * hp, 't')
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_b8ca1c28b8"),
  params: { ebuff: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const td1 = talent.q!['攻击倍率']!
    const td2 = talent.q!['生命倍率']!
    const td3 = talent.q!['已损失生命值倍率']!
    const atk = calc(attr.atk!)
    const hp = calc(attr.hp!)
    return basic(td1 * atk + td2 * hp + td3 * hp * 0.9, 'q')
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_a8b5ec058a"),
  params: { ebuff: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const td1 = talent.q!['攻击倍率']! + talent.q!['攻击倍率·相邻目标']! * 2
    const td2 = talent.q!['生命倍率']! + talent.q!['生命倍率·相邻目标']! * 2
    const td3 = talent.q!['已损失生命值倍率']! + talent.q!['已损失生命值倍率·相邻目标']! * 2
    const atk = calc(attr.atk!)
    const hp = calc(attr.hp!)
    return basic(td1 * atk + td2 * hp + td3 * hp * 0.9, 'q')
  }
}]

export const defDmgIdx = 3
export const mainAttr = 'hp,atk,cpct,cdmg,speed'

export const buffs: Buff[] = [{
  check: ({ params }) => params.ebuff === true,
  title: $t("panel-damage-rules.characters.blade.text_0933014910"),
  data: {
    dmg: ({ talent }) => talent.e!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_251243e78f"),
  tree: 2,
  data: {
    tDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_0afb9d0e3a"),
  cons: 1,
  data: {
    qPlus: ({ attr, calc }) => 1.5 * calc(attr.hp!) * 0.9
  }
}, {
  check: ({ params }) => params.ebuff === true,
  title: $t("panel-damage-rules.characters.blade.text_e45a9cb4f5"),
  cons: 2,
  data: {
    cpct: 15
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_2023197baa"),
  cons: 4,
  data: {
    hpPct: 40
  }
}, {
  title: $t("panel-damage-rules.characters.blade.text_2c5f82c039"),
  cons: 6,
  data: {
    tPlus: ({ attr, calc }) => calc(attr.hp!) * 0.5
  }
}]

export const createdBy = 'Aluxes'
