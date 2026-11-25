import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.jing-yuan.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_a172bb7309"),
  check: ({ cons, exCons }) => !exCons && cons < 6,
  dmgKey: 't',
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']! * 10, 't')
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_a172bb7309"),
  check: ({ cons, exCons }) => !exCons && cons >= 6,
  dmgKey: 't',
  dmg: ({ talent }, { dynamic }) => {
    const dynamicEnemydmg = 12
    let t1dmg = dynamic(talent.t!['技能伤害']!, 't')
    let t2dmg = dynamic(talent.t!['技能伤害']!, 't', { dynamicEnemydmg })
    let t3dmg = dynamic(talent.t!['技能伤害']!, 't', { dynamicEnemydmg: dynamicEnemydmg * 2 })
    let t4dmg = dynamic(talent.t!['技能伤害']!, 't', { dynamicEnemydmg: dynamicEnemydmg * 3 })
    return {
      dmg: t1dmg.dmg! + t2dmg.dmg! + t3dmg.dmg! + t4dmg.dmg! * 7,
      avg: t1dmg.avg + t2dmg.avg + t3dmg.avg + t4dmg.avg * 7
    }
  }
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_43bd06e435"),
  check: ({ cons, exCons }) => !!exCons && cons < 6,
  dmgKey: 't',
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']! * 30, 't')
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_43bd06e435"),
  check: ({ cons, exCons }) => !!exCons && cons >= 6,
  dmgKey: 't',
  dmg: ({ talent }, { dynamic }) => {
    const dynamicEnemydmg = 12
    let t1dmg = dynamic(talent.t!['技能伤害']!, 't')
    let t2dmg = dynamic(talent.t!['技能伤害']!, 't', { dynamicEnemydmg })
    let t3dmg = dynamic(talent.t!['技能伤害']!, 't', { dynamicEnemydmg: dynamicEnemydmg * 2 })
    let t4dmg = dynamic(talent.t!['技能伤害']!, 't', { dynamicEnemydmg: dynamicEnemydmg * 3 })
    return {
      dmg: t1dmg.dmg! + t2dmg.dmg! + t3dmg.dmg! + t4dmg.dmg! * 27,
      avg: t1dmg.avg + t2dmg.avg + t3dmg.avg + t4dmg.avg * 27
    }
  }
}]

export const defParams = { tArtisBuffCount: 8 }
export const defDmgKey = 't'
export const mainAttr = 'atk,cpct,cdmg,speed'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.jing-yuan.text_ffd5cc340d"),
  cons: 2,
  data: {
    aDmg: 20,
    eDmg: 20,
    qDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_41ca74d201"),
  cons: 6
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_a579f67aea"),
  check: ({ exCons }) => !!exCons,
  data: {
    dmg: 240
  }
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_42bb041d5c"),
  tree: 1,
  data: {
    tCdmg: 25
  }
}, {
  title: $t("panel-damage-rules.characters.jing-yuan.text_976c23f1de"),
  tree: 3,
  data: {
    cpct: 10
  }
}]
