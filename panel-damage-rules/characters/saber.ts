import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.saber.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.saber.text_5da6ea551c"),
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']!, 'a2')
}, {
  title: $t("panel-damage-rules.characters.saber.text_78243e9fb1"),
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']! + talent.a2!['2目标伤害']!, 'a2')
}, {
  title: $t("panel-damage-rules.characters.saber.text_bcae8cfb51"),
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']! + talent.a2!['1目标伤害']!, 'a2')
}, {
  title: $t("panel-damage-rules.characters.saber.text_8491ca4cb5"),
  dmg: ({ cons, talent }, dmg) => {
    let num = cons < 2 ? 14 : 21
    return dmg(talent.e!['技能伤害']! + num * 4 / 100, 'e')
  }
}, {
  title: $t("panel-damage-rules.characters.saber.text_31ae21a94e"),
  dmg: ({ cons, talent }, dmg) => {
    let num = cons < 2 ? 14 : 21
    return dmg(talent.e!['相邻目标伤害']! + num * 4 / 100, 'e')
  }
}, {
  title: $t("panel-damage-rules.characters.saber.text_0492a4ca05"),
  params: { cons_6: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.saber.text_1be909234f"),
  params: { cons_6: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']! + talent.q!['随机伤害']! * 10, 'q')
}]

export const defDmgIdx = 6
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.saber.text_c6f2fa6efa"),
  data: {
    dmg: ({ talent }) => talent.t!['造成的伤害提高']! * 100,
  }
}, {
  title: $t("panel-damage-rules.characters.saber.text_9e98eb08f4"),
  tree: 1,
  data: {
    cpct: 20
  }
}, {
  title: $t("panel-damage-rules.characters.saber.text_fe7d2e8a4e"),
  tree: 3,
  data: {
    cdmg: 50 + 4 * 8
  }
}, {
  title: $t("panel-damage-rules.characters.saber.text_08c573603b"),
  cons: 1,
  data: {
    qDmg: 60
  }
}, {
  title: $t("panel-damage-rules.characters.saber.text_ffaadd3e37"),
  cons: 2,
  data: {
    ignore: 15
  }
}, {
  title: $t("panel-damage-rules.characters.saber.text_49e35f8c75"),
  cons: 4,
  data: {
    kx: 8 + 4 * 3
  }
}, {
  check: ({ params }) => params.cons_6 === true,
  title: $t("panel-damage-rules.characters.saber.text_b4bc51b734"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.saber.text_08cd8017cf")
