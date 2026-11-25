import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.boothill.text_5da6ea551c"),
  params: { eBuff: true },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.boothill.text_b6a5fc7f30"),
  params: { eBuff: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.boothill.text_9b6820133c"),
  dmg: ({ talent, cons }, { reaction }) => {
    let extraTd = cons < 6 ? 0 : 0.4
    return {
      avg: reaction('physicalBreak').avg / 0.9 * (10 + 2) / 4 * (talent.t!['2层伤害']! + extraTd)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_271c1ed194"),
  dmg: ({ talent, cons }, { reaction }) => {
    let extraTd = cons < 6 ? 0 : 0.4
    return {
      avg: reaction('physicalBreak').avg / 0.9 * (16 + 2) / 4 * (talent.t!['2层伤害']! + extraTd)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_1f3955e8d4"),
  dmg: ({ talent, cons }, { reaction }) => {
    let extraTd = cons < 6 ? 0 : 0.4
    return {
      avg: reaction('physicalBreak').avg / 0.9 * (10 + 2) / 4 * (talent.t!['3层伤害']! + extraTd)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_5e9c278389"),
  dmg: ({ talent, cons }, { reaction }) => {
    let extraTd = cons < 6 ? 0 : 0.4
    return {
      avg: reaction('physicalBreak').avg / 0.9 * (16 + 2) / 4 * (talent.t!['3层伤害']! + extraTd)
    }
  }
}]

export const defDmgIdx = 5
export const mainAttr = 'atk,stance,cpct,cdmg,dmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.boothill.text_599c2e0696"),
  check: ({ params }) => params.eBuff === true,
  data: {
    enemydmg: ({ talent }) => talent.e!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_a6eabadc92"),
  tree: 1,
  sort: 9,
  data: {
    cpct: ({ attr }) => Math.min(attr.stance! * 0.1, 30),
    cdmg: ({ attr }) => Math.min(attr.stance! * 0.5, 150)
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_2706684de8"),
  cons: 1,
  data: {
    ignore: 16
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_c3c1aa8d22"),
  check: ({ params }) => params.eBuff === true,
  cons: 2,
  data: {
    stance: 30
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_ba012fcd4d"),
  check: ({ params }) => params.eBuff === true,
  cons: 4,
  data: {
    enemydmg: 12
  }
}, {
  title: $t("panel-damage-rules.characters.boothill.text_dcb1c5b3f7"),
  cons: 6
}]

export const createdBy = 'Aluxes'
