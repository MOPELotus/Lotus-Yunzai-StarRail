import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.kafka.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['单体伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.kafka.text_d896ef4928"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['追加伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.kafka.text_d87fc52e97"),
  params: { isDot: true },
  dmg: ({ talent, cons, weapon }, dmg) => {
    let plusDot = cons >= 6 ? 1.56 : 0
    let weaponDot = weapon.name === '只需等待' ? (weapon.affix * 10 + 50) / 100 : 0
    let eDmg = dmg(talent.e!['单体伤害']!, 'e')
    let dotDmg = dmg((talent.q!['回合持续伤害']! + plusDot + weaponDot) * talent.e!['额外持续伤害']!, 'dot', 'skillDot')
    return {
      dmg: eDmg.dmg! + dotDmg.avg,
      avg: eDmg.avg + dotDmg.avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.kafka.text_b6a5fc7f30"),
  params: { isDot: true },
  dmg: ({ talent, cons, weapon }, dmg) => {
    let plusDot = cons >= 6 ? 1.56 : 0
    let weaponDot = weapon.name === '只需等待' ? (weapon.affix * 10 + 50) / 100 : 0
    let qDmg = dmg(talent.q!['技能伤害']!, 'q')
    let dotDmg = dmg((talent.q!['回合持续伤害']! + plusDot + weaponDot) * talent.q!['额外持续伤害']!, 'dot', 'skillDot')
    return {
      dmg: qDmg.dmg! + dotDmg.avg,
      avg: qDmg.avg + dotDmg.avg
    }
  }
}]

export const defParams = { tArtisBuffCount: 6 }
export const mainAttr = 'atk,cpct,cdmg'
export const defDmgIdx = 3

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.kafka.text_3fc05b0907"),
  cons: 1,
  data: {
    dotEnemydmg: 30
  }
}, {
  title: $t("panel-damage-rules.characters.kafka.text_2c5997437b"),
  cons: 2,
  data: {
    dotDmg: 25
  }
}, {
  title: $t("panel-damage-rules.characters.kafka.text_5a3a4cd5f2"),
  cons: 6
}, {
  title: $t("panel-damage-rules.characters.kafka.text_f7f0b0d9b6"),
  check: ({ weapon, params }) => (weapon.name === '只需等待' && params.isDot === true),
  data: {
    dotData: ({ weapon }) => weapon.affix * 10 + 50
  }
}]

export const createdBy = 'Aluxes'
