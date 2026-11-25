import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.qingque.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['门前清·伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.qingque.text_814f9a3860"),
  params: {
    eBuffCount: 0,
    hiddenHand: true
  },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['杠·伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.qingque.text_0752ba6620"),
  params: {
    eBuffCount: 0,
    hiddenHand: true
  },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['杠·相邻目标伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.qingque.text_f200f83db0"),
  params: {
    eBuffCount: 4,
    hiddenHand: true
  },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['杠·伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.qingque.text_ef4fd920f8"),
  params: {
    eBuffCount: 4,
    hiddenHand: true
  },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['杠·相邻目标伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.qingque.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.qingque.text_39c4fa8ad0"),
  params: {
    eBuffCount: 4,
    hiddenHand: true
  },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.qingque.text_0cf1a0928f"),
  cons: 4,
  params: {
    eBuffCount: 4,
    tAttack: true
  },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['杠·伤害']!, 't')
}]

export const mainAttr = 'atk,cpct,cdmg'
export const defDmgIdx = 3

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.qingque.text_5aecccf2df"),
  check: ({ params }) => params.eBuffCount,
  data: {
    _eBuffCount: ({ params }) => params.eBuffCount,
    dmg: ({ params, talent }) => talent.e!['伤害提高']! * 100 * (params.eBuffCount as number)
  }
}, {
  title: $t("panel-damage-rules.characters.qingque.text_74118f6716"),
  check: ({ params }) => params.hiddenHand,
  data: {
    atkPct: ({ talent }) => talent.t!['攻击力提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.qingque.text_e6c7cc8fd8"),
  tree: 2,
  check: ({ params }) => params.eBuffCount,
  data: {
    _eBuffCount: ({ params }) => params.eBuffCount,
    dmg: ({ params }) => 10 * (params.eBuffCount as number)
  }
}, {
  title: $t("panel-damage-rules.characters.qingque.text_46808da9a8"),
  tree: 3,
  data: {
    speedPct: 10
  }
}, {
  title: $t("panel-damage-rules.characters.qingque.text_d36234187a"),
  cons: 1,
  data: {
    qDmg: 10
  }
}, {
  title: $t("panel-damage-rules.characters.qingque.text_c46b1a2760"),
  check: ({ params }) => params.tAttack,
  cons: 4
}]

export const createdBy = 'Aluxes'
