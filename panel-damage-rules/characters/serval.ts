import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.serval.text_a900baa1d0"),
  dmg: ({ talent, cons }, dmg) => {
    let plusDmg = cons >= 1 ? 0.6 : 0
    return dmg(talent.a!['技能伤害']! * (1 + plusDmg), 'a')
  }
}, {
  title: $t("panel-damage-rules.characters.serval.text_eea83dab71"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.serval.text_cf98d7f7f9"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']! + talent.e!['相邻目标伤害']! * 2, 'e')
}, {
  title: $t("panel-damage-rules.characters.serval.text_256b3e2d3e"),
  dmg: ({ talent }, dmg) => dmg(0.5, 'dot', 'skillDot')
}, {
  title: $t("panel-damage-rules.characters.serval.text_a7dd064066"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['触电持续伤害']!, 'dot', 'skillDot')
}, {
  title: $t("panel-damage-rules.characters.serval.text_81891586ea"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.serval.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.serval.text_c8366d52e6"),
  cons: 1
}, {
  title: $t("panel-damage-rules.characters.serval.text_57ef9b3340"),
  cons: 6,
  data: {
    dmg: 30
  }
}, {
  title: $t("panel-damage-rules.characters.serval.text_207dece5c9"),
  tree: 3,
  data: {
    atkPct: 20
  }
}]

export const createdBy = 'Aluxes'
