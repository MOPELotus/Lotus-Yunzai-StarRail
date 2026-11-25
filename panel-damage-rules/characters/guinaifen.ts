import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.guinaifen.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.guinaifen.text_cf98d7f7f9"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['目标伤害']! + talent.e!['相邻目标伤害']! * 2, 'e')
}, {
  title: $t("panel-damage-rules.characters.guinaifen.text_688cc847d0"),
  dmg: ({ talent, cons }, dmg) => {
    const dotPlus = cons >= 2 ? 0.4 : 0
    return dmg(talent.e!['持续伤害']! + dotPlus, 'dot', 'skillDot')
  }
}, {
  title: $t("panel-damage-rules.characters.guinaifen.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.guinaifen.text_b73ddfb516"),
  dmg: ({ talent, cons }, dmg) => {
    let qDmg = dmg(talent.q!['技能伤害']!, 'q')
    const dotPlus = cons >= 2 ? 0.4 : 0
    let dotDmg = dmg((talent.e!['持续伤害']! + dotPlus) * talent.q!['灼烧伤害比例']!, 'dot', 'skillDot')
    return {
      dmg: qDmg.dmg! + dotDmg.avg,
      avg: qDmg.avg + dotDmg.avg
    }
  }
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.guinaifen.text_3db6fc35e6"),
  check: ({ cons }) => cons < 6,
  data: {
    enemydmg: ({ talent }) => talent.t!['伤害提高']! * 100 * 3
  }
}, {
  title: $t("panel-damage-rules.characters.guinaifen.text_6f1fd34fa6"),
  cons: 6,
  data: {
    enemydmg: ({ talent }) => talent.t!['伤害提高']! * 100 * 4
  }
}, {
  title: $t("panel-damage-rules.characters.guinaifen.text_5b6d1e04a9"),
  tree: 3,
  data: {
    dmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.guinaifen.text_63f9ddd749"),
  cons: 2
}]

export const createdBy = 'Aluxes'
