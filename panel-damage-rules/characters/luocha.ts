import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.luocha.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.luocha.text_e813c6666d"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.atk!) * talent.e!['攻击力百分比']! + talent.e!['固定生命值']!)
}, {
  title: $t("panel-damage-rules.characters.luocha.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.luocha.text_280d176b1d"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.atk!) * talent.t!['攻击力百分比']! + talent.t!['固定生命值']!)
}, {
  title: $t("panel-damage-rules.characters.luocha.text_35c6d72bab"),
  dmg: ({ calc, attr }, { heal }) => heal(calc(attr.atk!) * 0.07 + 93)
}, {
  title: $t("panel-damage-rules.characters.luocha.text_4ae5ec77f9"),
  cons: 2,
  dmg: ({ calc, attr }, { shield }) => shield(calc(attr.atk!) * 0.18 + 240)
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.luocha.text_18cf7dfd7d"),
  cons: 1,
  data: {
    atkPct: 20
  }
}, {
  title: $t("panel-damage-rules.characters.luocha.text_ddda2e4d3f"),
  cons: 2,
  data: {
    heal: 30
  }
}, {
  title: $t("panel-damage-rules.characters.luocha.text_3835b9f1da"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = 'Aluxes'
