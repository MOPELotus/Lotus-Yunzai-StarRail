import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.clara.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.clara.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.clara.text_c0a4285d98"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']! * 2, 'e')
}, {
  title: $t("panel-damage-rules.characters.clara.text_8eb243b9d5"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['反击伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.clara.text_446d76af78"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['伤害倍率提高']! + talent.t!['反击伤害']!, 't')
}]

export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.clara.text_953f9b459f"),
  cons: 2,
  data: {
    atkPct: 30
  }
}, {
  title: $t("panel-damage-rules.characters.clara.text_022266e6b0"),
  tree: 3,
  data: {
    tDmg: 30
  }
}]
