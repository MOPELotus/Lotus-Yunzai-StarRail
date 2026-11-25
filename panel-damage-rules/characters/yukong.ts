import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.yukong.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.yukong.text_f7955e3148"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.e!['攻击力提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.yukong.text_3096f6ec35"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['暴击率提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.yukong.text_fb0ce6ae38"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['暴击伤害提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.yukong.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const mainAttr = 'atk,cpct,cdmg'
export const defDmgIdx = 2

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.yukong.text_8a3e0e2eb9"),
  data: {
    atkPct: ({ talent }) => talent.e!['攻击力提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.yukong.text_361d6a45dd"),
  data: {
    cpct: ({ talent }) => talent.q!['暴击率提高']! * 100,
    cdmg: ({ talent }) => talent.q!['暴击伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.yukong.text_18dedf0b5d"),
  tree: 1,
  data: {
    dmg: 12
  }
}, {
  title: $t("panel-damage-rules.characters.yukong.text_ed378adf42"),
  cons: 1,
  data: {
    speedPct: 10
  }
}, {
  title: $t("panel-damage-rules.characters.yukong.text_19a4b1a6cc"),
  cons: 4,
  data: {
    dmg: 30
  }
}]

export const createdBy = 'Aluxes'
