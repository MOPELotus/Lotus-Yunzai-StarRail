import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.sushang.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.sushang.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.sushang.text_b066459a31"),
  dmg: ({ talent }, dmg) => {
    let eDmg = dmg(talent.e!['技能伤害']!, 'e')
    let ePlusDmg = dmg.dynamic(talent.e!['附加伤害']!, 'e', { dynamicDmg: 20 })
    return {
      dmg: eDmg.dmg! + ePlusDmg.dmg!,
      avg: eDmg.avg + ePlusDmg.avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sushang.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.sushang.text_97d3c6501a"),
  dmg: ({ talent }, dmg) => {
    let eDmg = dmg(talent.e!['技能伤害']!, 'e')
    let ePlusDmg = dmg.dynamic(talent.e!['附加伤害']!, 'e', { dynamicDmg: 20 })
    return {
      dmg: eDmg.dmg! + ePlusDmg.dmg! * 2,
      avg: eDmg.avg + ePlusDmg.avg * 2
    }
  }
}]

export const mainAttr = 'atk,cpct,cdmg'
export const defDmgIdx = 4

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.sushang.text_b7f006c259"),
  data: {
    speedPct: ({ talent }) => talent.t!['速度提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.sushang.text_999dd49dbc"),
  tree: 1,
  data: {
    _dmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.sushang.text_851a9a466a"),
  cons: 4,
  data: {
    stance: 40
  }
}, {
  title: $t("panel-damage-rules.characters.sushang.text_892f47008c"),
  cons: 6,
  data: {
    speedPct: ({ talent }) => talent.t!['速度提高']! * 100
  }
}]

export const createdBy = 'Aluxes'
