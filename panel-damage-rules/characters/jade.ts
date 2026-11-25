import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.jade.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['目标伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.jade.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.jade.text_3c62b8771b"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.jade.text_90b505b379"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['追加攻击倍率提高']! + talent.t!['技能伤害']!, 't')
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.jade.text_06654b2305"),
  data: {
    cdmg: ({ talent }) => talent.t!['每层爆伤提高']! * 50 * 100
  }
}, {
  title: $t("panel-damage-rules.characters.jade.text_47a414d7a2"),
  tree: 3,
  data: {
    atkPct: 0.5 * 50
  }
}, {
  title: $t("panel-damage-rules.characters.jade.text_952de7dbc0"),
  cons: 1,
  data: {
    tDmg: 32
  }
}, {
  title: $t("panel-damage-rules.characters.jade.text_0ca18ba9e1"),
  cons: 2,
  data: {
    cpct: 18
  }
}, {
  title: $t("panel-damage-rules.characters.jade.text_372c3d3305"),
  cons: 4,
  data: {
    ignore: 12
  }
}, {
  title: $t("panel-damage-rules.characters.jade.text_cf0b4937ae"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = 'Aluxes'
