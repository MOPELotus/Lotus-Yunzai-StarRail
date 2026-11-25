import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.dr-ratio.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.dr-ratio.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.dr-ratio.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.dr-ratio.text_3592a3c1a2"),
  dmg: ({ talent, cons }, dmg) => {
    const extraPct = cons >= 2 ? 60 : 0
    return {
      dmg: dmg(talent.t!['追加攻击伤害']!, 't').dmg! + dmg(extraPct / 100).dmg!,
      avg: dmg(talent.t!['追加攻击伤害']!, 't').avg + dmg(extraPct / 100).avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.dr-ratio.text_b1e29b0745"),
  params: { debuffCount: 5 },
  dmg: ({ talent, cons }, dmg) => {
    const extraPct = cons >= 2 ? 80 : 0
    return {
      dmg: dmg(talent.t!['追加攻击伤害']!, 't').dmg! + dmg(extraPct / 100).dmg!,
      avg: dmg(talent.t!['追加攻击伤害']!, 't').avg + dmg(extraPct / 100).avg
    }
  }
}]

export const defParams = { debuffCount: 3 }
export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.dr-ratio.text_9174d7c623"),
  tree: 2,
  data: {
    _count: ({ cons }) => cons < 1 ? 6 : 10,
    cpct: ({ cons }) => cons < 1 ? 15 : 25,
    cdmg: ({ cons }) => cons < 1 ? 30 : 50
  }
}, {
  title: $t("panel-damage-rules.characters.dr-ratio.text_8381c734b5"),
  tree: 3,
  data: {
    _count: ({ params }) => params.debuffCount,
    dmg: ({ params }) => (params.debuffCount as number) * 10
  }
}, {
  title: $t("panel-damage-rules.characters.dr-ratio.text_690e3f51a9"),
  cons: 2,
  data: {
    _atkPct: ({ params }) => Math.min((params.debuffCount as number) * 20, 80)
  }
}, {
  title: $t("panel-damage-rules.characters.dr-ratio.text_88aafb91c5"),
  cons: 6,
  data: {
    tDmg: 50
  }
}]

export const createdBy = 'Aluxes'
