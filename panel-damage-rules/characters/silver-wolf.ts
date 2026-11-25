import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.silver-wolf.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_b6a5fc7f30"),
  dmg: ({ talent, cons }, dmg) => {
    let addDmg = (cons * 1 >= 4) ? 1 : 0
    return dmg(talent.q!['技能伤害']! + addDmg, 'q')
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_ae749d3fc4"),
  dmg: ({ calc, attr }, { reaction }) => {
    return {
      avg: reaction('entanglement').avg * 5 * (10 + 2) / 4
    }
  }
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.silver-wolf.text_362d7177af"),
  data: {
    enemyDef: ({ talent }) => talent.t!['防御力降低']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_3b8451d221"),
  data: {
    kx: 20
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_8c0060aa7f"),
  data: {
    enemyDef: ({ talent }) => talent.q!['防御力降低']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_9823c6ee37"),
  cons: 4,
  data: {}
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_667c08f8ce"),
  cons: 6,
  data: {
    dmg: 100
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf.text_45ccd60047"),
  tree: 2,
  data: {
    kx: 3
  }
}]

export const createdBy = 'Aluxes'
