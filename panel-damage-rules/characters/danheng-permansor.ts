import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const mainAttr = 'atk,cpct,cdmg'
export const defParams = { comradeAtk: 3000 }

export const buffs: Buff[] = [
  {
    cons: 1,
    check: ({ params }) => params.isQ_Enhanced && params.isComradeDmg,
    title: $t("panel-damage-rules.characters.danheng-permansor.text_05ba3b7b3b"),
    data: {
      kx: 18
    }
  },
  {
    cons: 6,
    title: $t("panel-damage-rules.characters.danheng-permansor.text_2de6b9d615"),
    data: {
      enemydmg: 20
    }
  },
  {
    cons: 6,
    check: ({ params }) => params.isComradeDmg,
    title: $t("panel-damage-rules.characters.danheng-permansor.text_fcfd8916fa"),
    data: {
      ignore: 12
    }
  }
]

export const details: DamageDetail[] = [
  {
    title: $t("panel-damage-rules.characters.danheng-permansor.text_a900baa1d0"),
    dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
  },
  {
    title: $t("panel-damage-rules.characters.danheng-permansor.text_9953377f67"),
    dmg: ({ calc, attr, talent }, dmg) => dmg.shield(calc(attr.atk!) * talent.e!['护盾•百分比攻击']! + talent.e!['护盾•固定值']!)
  },
  {
    title: $t("panel-damage-rules.characters.danheng-permansor.text_b6a5fc7f30"),
    dmgKey: 'q',
    dmg: ({ talent }, dmg) => dmg(talent.q!['全体伤害']!, 'q')
  },
  {
    title: $t("panel-damage-rules.characters.danheng-permansor.text_2f5c203ac1"),
    dmg: ({ calc, attr, talent }, dmg) => dmg.shield(calc(attr.atk!) * talent.q!['护盾•百分比攻击']! + talent.q!['护盾•固定值']!)
  },
  {
    title: $t("panel-damage-rules.characters.danheng-permansor.text_9eff916f17"),
    params: { isQ_Enhanced: true },
    dmg: ({ calc, attr, talent, cons, params }, dmg) => {
      let shieldVal = calc(attr.atk!) * talent.t!['护盾•百分比攻击']! + talent.t!['护盾•固定值']!
      if (cons >= 2 && params.isQ_Enhanced) {
        shieldVal *= 2
      }
      return dmg.shield(shieldVal)
    }
  },
  {
    title: ({ cons, trees, params }) => $t("panel-damage-rules.characters.danheng-permansor.text_369c810a4d", { "comradeAtk": params.comradeAtk, "value2": cons >= 2 ? $t("panel-damage-rules.characters.danheng-permansor.text_a223a01491") : '', "value3": trees['103'] ? $t("panel-damage-rules.characters.danheng-permansor.text_da3e69b52d") : '' }),
    params: { isQ_Enhanced: true, isComradeDmg: true },
    dmg: (ds, dmg) => {
      const { talent, calc, attr, params, cons, trees } = ds
      const comradeAtk = (params.comradeAtk || 0) as number
      const selfDmgValue = calc(attr.atk!) * talent.q!['追加攻击伤害']!
      let comradePct = talent.q!['附加伤害']!
      if (cons >= 2) comradePct *= 2
      const comradeDmgValue = comradeAtk * comradePct
      const zhengrongDmgValue = trees['103'] ? comradeAtk * 0.40 : 0
      const finalSelfDmg = dmg.basic(selfDmgValue, 't')
      const finalComradeDmg = dmg.basic(comradeDmgValue + zhengrongDmgValue, 't')
      return {
        dmg: finalSelfDmg.dmg! + finalComradeDmg.dmg!,
        avg: finalSelfDmg.avg + finalComradeDmg.avg,
      }
    }
  },
  {
    title: ({ params }) => $t("panel-damage-rules.characters.danheng-permansor.text_82532557e5", { "comradeAtk": params.comradeAtk }),
    cons: 6,
    params: { isQ_Enhanced: true, isComradeDmg: true },
    dmg: (ds, dmg) => {
      const comradeAtk = (ds.params.comradeAtk || 0) as number
      const totalValue = comradeAtk * 3.30
      return dmg.basic(totalValue, 't')
    }
  }
]

export const defDmgKey = 'q'
