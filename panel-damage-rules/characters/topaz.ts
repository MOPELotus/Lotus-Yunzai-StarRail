import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.topaz.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.topaz.text_22e862fb9b"),
  params: { debt: true },
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.topaz.text_c15b7b7f93"),
  params: { debt: true, qBuff: true },
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']! + talent.q!['伤害倍率提高']!, 't')
}, {
  title: $t("panel-damage-rules.characters.topaz.text_f9126d52ae"),
  params: { debt: true },
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.topaz.text_a3b94c4d92"),
  params: { debt: true, qBuff: true },
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']! + talent.q!['伤害倍率提高']!, 't')
}]

export const defParams = { tArtisBuffCount: 4 }
export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.topaz.text_6173a46cf9"),
  check: ({ params }) => params.debt === true,
  data: {
    tDmg: ({ talent }) => talent.e!['追加攻击伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.topaz.text_c211f94780"),
  check: ({ params }) => params.qBuff === true,
  data: {
    _pct: ({ talent }) => talent.q!['伤害倍率提高']! * 100,
    cdmg: ({ talent }) => talent.q!['暴击伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.topaz.text_82f157b320"),
  tree: 2,
  data: {
    dmg: 15
  }
}, {
  title: $t("panel-damage-rules.characters.topaz.text_0d0a4b7ca3"),
  tree: 1
}, {
  title: $t("panel-damage-rules.characters.topaz.text_2920d6b1b2"),
  cons: 1,
  data: {
    cdmg: 25
  }
}, {
  title: $t("panel-damage-rules.characters.topaz.text_a368104b16"),
  cons: 6,
  data: {
    kx: 10
  }
}]

export const createdBy = 'Aluxes'
