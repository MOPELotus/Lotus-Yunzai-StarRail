import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.phainon.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.phainon.text_cc28ea2fbc"),
  params: ({ qBuff: true, Khaslana: true }),
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']!, 'a2')
}, {
  title: $t("panel-damage-rules.characters.phainon.text_c0cf586715"),
  params: ({ qBuff: true, Khaslana: true }),
  dmg: ({ talent }, dmg) => dmg(talent.a2!['相邻目标伤害']!, 'a2')
}, {
  title: $t("panel-damage-rules.characters.phainon.text_ef9a46e334"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.phainon.text_f647479cc6"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.phainon.text_a8349a4f7d"),
  params: ({ qBuff: true, Khaslana: true }),
  dmg: ({ talent }, dmg) => dmg(talent.e1!['技能伤害']! + talent.e1!['随机伤害']! * 4 + 0.2 * 4, 'e2')
}, {
  title: $t("panel-damage-rules.characters.phainon.text_3699b27105"),
  params: ({ qBuff: true, Khaslana: true }),
  dmg: ({ talent }, dmg) => dmg(talent.e2!['技能伤害']!, 'e2')
}, {
  title: $t("panel-damage-rules.characters.phainon.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 6
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.phainon.text_7a0721a5a3"),
  data: {
    cdmg: ({ talent }) => talent.t!['暴伤提高']! * 100,
  }
}, {
  check: ({ params }) => params.qBuff === true,
  title: $t("panel-damage-rules.characters.phainon.text_1a88214391"),
  data: {
    atkPct: ({ talent }) => talent.t2!['攻击力提高']! * 100,
  }
}, {
  title: $t("panel-damage-rules.characters.phainon.text_b9712d3bea"),
  tree: 2,
  data: {
    dmg: 45
  }
}, {
  title: $t("panel-damage-rules.characters.phainon.text_9ad6bf3007"),
  tree: 3,
  data: {
    atkPct: 50 * 2
  }
}, {
  title: $t("panel-damage-rules.characters.phainon.text_b3a23c69a6"),
  cons: 1,
  data: {
    cdmg: 50
  }
}, {
  check: ({ params }) => params.Khaslana === true,
  title: $t("panel-damage-rules.characters.phainon.text_0cfdafee62"),
  cons: 2,
  data: {
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.phainon.text_08cd8017cf")
