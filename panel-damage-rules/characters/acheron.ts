import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.acheron.text_a900baa1d0"),
  dmg: ({ talent, cons }, dmg) => {
    return cons < 6 ? dmg(talent.a!['技能伤害']!, 'a') : dmg(talent.a!['技能伤害']!, 'a,q')
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_ef9a46e334"),
  dmg: ({ talent, cons }, dmg) => {
    return cons < 6 ? dmg(talent.e!['单体伤害']!, 'e') : dmg(talent.e!['单体伤害']!, 'e,q')
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_108fbe8b4d"),
  dmg: ({ talent, cons }, dmg) => {
    return cons < 6 ? dmg(talent.e!['相邻目标伤害']!, 'e') : dmg(talent.e!['相邻目标伤害']!, 'e,q')
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_45526723ba"),
  params: { q: true },
  dmg: ({ talent, trees }, dmg) => {
    let extraTd = trees['103'] ? 1.5 : 0
    return dmg(talent.q!['单体伤害']! + extraTd, 'q')
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_743b799e2b"),
  params: { q: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['相邻目标伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.acheron.text_9f009e3135"),
  check: ({ exCons }) => !!exCons,
  params: { q: true },
  dmg: ({ cons }, dmg) => {
    // 全体300% + 6次80%对单 = 780%攻击力，视为终结技伤害
    return dmg(3.0 + 0.8 * 6, 'q')
  }
}]

export const mainAttr = 'atk,cpct,cdmg,dmg'
export const defDmgIdx = 3

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.acheron.text_51ea7f39ee"),
  check: ({ params }) => params.q === true,
  data: {
    kx: ({ talent }) => talent.t!['全属性抗性降低']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_0afb75719c"),
  tree: 2,
  data: {
    multi: 60
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_01dc7b6e17"),
  tree: 3,
  data: {
    dmg: 90
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_782eeb3a3a"),
  cons: 1,
  data: {
    cpct: 18
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_96254221f6"),
  cons: 4,
  data: {
    qEnemydmg: 8
  }
}, {
  title: $t("panel-damage-rules.characters.acheron.text_76637f8b3c"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = 'Aluxes'
