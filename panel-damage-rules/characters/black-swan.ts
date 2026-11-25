import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.black-swan.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_b6a5fc7f30"),
  params: { qBuff: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_0dc56a9c1a"),
  params: { qBuff: true },
  dmg: ({ talent }, dmg) => {
    const td = talent.t!['持续伤害']! + talent.t!['倍率提高']! * 3
    return dmg(td, 'dot', 'skillDot')
  }
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_2cdc56a385"),
  params: { ignoreDef: true, qBuff: true },
  dmg: ({ talent }, dmg) => {
    const td = talent.t!['持续伤害']! + talent.t!['倍率提高']! * 7
    return dmg(td, 'dot', 'skillDot')
  }
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_e5d3976483"),
  params: { ignoreDef: true, qBuff: true },
  dmg: ({ talent }, dmg) => {
    const td = talent.t!['持续伤害']! + talent.t!['倍率提高']! * 50
    return dmg(td, 'dot', 'skillDot')
  }
}]

export const mainAttr = 'atk,cpct,cdmg,dmg,effPct'
export const defDmgIdx = 4

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.black-swan.text_2f1f8d737e"),
  tree: 3,
  data: {
    dmg: ({ attr }) => Math.min(attr.effPct! * 0.6, 72),
  }
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_c96fda6346"),
  data: {
    enemyDef: ({ talent }) => talent.e!['防御力降低']! * 100,
  }
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_d4f2617eb9"),
  check: ({ params }) => params.qBuff === true,
  data: {
    enemydmg: ({ talent }) => talent.q!['伤害提高']! * 100,
  }
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_3b89f55743"),
  check: ({ params }) => params.ignoreDef === true,
  data: {
    dotIgnore: 20,
  }
}, {
  title: $t("panel-damage-rules.characters.black-swan.text_8fdc69f58a"),
  cons: 1,
  data: {
    kx: 25,
  }
}]

export const createdBy = 'Aluxes'
