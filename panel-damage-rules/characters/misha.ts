import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.misha.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.misha.text_81d833c7dd"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['单体伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.misha.text_f647479cc6"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.misha.text_3f873c200d"),
  dmg: ({ talent, cons }, dmg) => {
    let extraTd = cons >= 4 ? 0.06 : 0
    let td = (talent.q!['每段攻击伤害']! + extraTd) * 10
    return dmg(td, 'q')
  }
}, {
  title: $t("panel-damage-rules.characters.misha.text_994c65133d"),
  check: ({ cons }) => cons >= 1,
  dmg: ({ talent, cons }, dmg) => {
    let extraTd = cons >= 4 ? 0.06 : 0
    let td = (talent.q!['每段攻击伤害']! + extraTd) * 15
    return dmg(td, 'q')
  }
}]

export const mainAttr = 'atk,cpct,cdmg,dmg'
export const defDmgIdx = 3

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.misha.text_4b25374b30"),
  tree: 2,
  data: {
    effPct: 60
  }
}, {
  title: $t("panel-damage-rules.characters.misha.text_dd4c8e3660"),
  tree: 3,
  data: {
    cdmg: 30
  }
}, {
  title: $t("panel-damage-rules.characters.misha.text_0f9efa993e"),
  cons: 2,
  data: {
    enemyDef: 16
  }
}, {
  title: $t("panel-damage-rules.characters.misha.text_a50b6536f0"),
  cons: 4
}, {
  title: $t("panel-damage-rules.characters.misha.text_7cd4164600"),
  cons: 6,
  data: {
    dmg: 30
  }
}]

export const createdBy = 'Aluxes'
