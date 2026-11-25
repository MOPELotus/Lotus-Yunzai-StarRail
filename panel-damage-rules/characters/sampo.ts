import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.sampo.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.sampo.text_aef3538851"),
  dmg: ({ talent, cons }, dmg) => {
    let count = cons >= 1 ? 6 : 5
    return dmg(talent.e!['技能伤害']! * count, 'e')
  }
}, {
  title: $t("panel-damage-rules.characters.sampo.text_25b29f823f"),
  check: ({ cons }) => cons >= 4,
  dmg: ({ talent, cons }, dmg) => {
    let eDmg = dmg(talent.e!['技能伤害']! * 6, 'e')
    let plusDot = cons >= 6 ? 0.15 : 0
    let dotDmg = dmg((talent.t!['回合开始受到伤害']! + plusDot) * 5, 'dot', 'skillDot')
    return {
      dmg: eDmg.dmg! + dotDmg.avg * 0.08,
      avg: eDmg.avg + dotDmg.avg * 0.08
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sampo.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.sampo.text_6f104bba52"),
  dmg: ({ talent, cons }, dmg) => {
    let plusDot = cons >= 6 ? 0.15 : 0
    return dmg((talent.t!['回合开始受到伤害']! + plusDot) * 5, 'dot', 'skillDot')
  }
}]

export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.sampo.text_9dbc21d0bf"),
  cons: 1
}, {
  title: $t("panel-damage-rules.characters.sampo.text_46a15b38ca"),
  cons: 4
}, {
  title: $t("panel-damage-rules.characters.sampo.text_f93fdda0ad"),
  cons: 6
}, {
  title: $t("panel-damage-rules.characters.sampo.text_1c7ba57ec5"),
  data: {
    dotEnemydmg: 30
  }
}]

export const createdBy = 'Aluxes'
