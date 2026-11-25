import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.ashveil.text_a900baa1d0"),
  dmgKey: 'a',
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_aef3538851"),
  dmgKey: 'e',
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_ac46797bd9"),
  dmgKey: 'e',
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']! + talent.e!['额外伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_b6a5fc7f30"),
  dmgKey: 'q',
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_17395c1f02"),
  dmg: ({ talent, cons }, dmg) => {
    const gluttony = cons >= 2 ? 18 : 12
    const times = Math.floor(gluttony / 4)
    return dmg(talent.t!['追加攻击伤害']! + talent.q!['额外伤害']! * times, 't')
  }
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_8be2fbcd35"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['追加攻击伤害']!, 't')
}]

export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.ashveil.text_d36df9d21c"),
  tree: 2,
  data: {
    tCdmg: ({ cons }) => {
      const gluttony = cons >= 2 ? 18 : 12
      return 80 + 10 * gluttony
    }
  }
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_73a4748799"),
  tree: 3,
  data: {
    cdmgPct: 48,
    tCdmg: 80
  }
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_ca2f30c9b1"),
  cons: 1,
  data: {
    enemydmgPct: 36
 }
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_adb84949c3"),
  cons: 4,
  data: {
    atkPct: 40
 }
}, {
  title: $t("panel-damage-rules.characters.ashveil.text_6d1b9ec23d"),
  cons: 6,
  data: {
    kx: 20,
    dmg: 120
 }
}]

export const createdBy = $t("panel-damage-rules.characters.ashveil.text_562dac5589")
