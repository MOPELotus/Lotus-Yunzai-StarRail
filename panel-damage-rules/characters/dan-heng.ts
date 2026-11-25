import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.dan-heng.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.dan-heng.text_eb18acf178"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.dan-heng.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.dan-heng.text_4328ccc0e9"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']! + talent.q!['减速目标q伤害倍率提高']!, 'q')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.dan-heng.text_0d75409909"),
  data: {
    kx: ({ talent }) => talent.t!['风抗性穿透']!
  }
}, {
  title: $t("panel-damage-rules.characters.dan-heng.text_7670761756"),
  data: {
    atkPct: 40
  }
}, {
  title: $t("panel-damage-rules.characters.dan-heng.text_4ce75a1cc8"),
  cons: 1,
  data: {
    cpct: 12
  }
}, {
  title: $t("panel-damage-rules.characters.dan-heng.text_69a3c56bc7"),
  tree: 3,
  data: {
    aDmg: 40
  }
}]
