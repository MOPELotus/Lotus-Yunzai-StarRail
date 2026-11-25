import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [
  {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_8334b4e9d5"),
    dmg: ({ talent }, dmg) => dmg(talent.e!["技能伤害"]! + talent.e!["相邻目标伤害"]! * 2, "e")
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_57b2091c36"),
    dmg: ({ talent }, dmg) => dmg(talent.t!["技能伤害"]!, "t")
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_d2f095bfae"),
    dmg: ({ talent }, dmg) => dmg(talent.q!["技能伤害"]!, "q")
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_1dec26eaa5"),
    params: { isDot: true },
    dmg: ({ talent, cons }, dmg) => {
      const plusDot = cons >= 6 ? 1.56 : 0
      return dmg(talent.q!["持续伤害"]! + plusDot, "dot", "skillDot")
    }
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_0860cc3ed4"),
    tree: 3,
    params: { isDot: true },
    dmg: ({ talent, cons }, dmg) => {
      const tDmg = dmg(talent.t!["技能伤害"]!, "t")
      const plusDot = cons >= 6 ? 1.56 : 0
      // 荆棘行迹使追击能引爆80%的DOT伤害
      const dotDmg = dmg((talent.q!["持续伤害"]! + plusDot) * 0.8, "dot", "skillDot")

      return {
        dmg: tDmg.dmg! + dotDmg.avg,
        avg: tDmg.avg + dotDmg.avg
      }
    }
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_171432b491"),
    params: { isDot: true },
    dmg: ({ talent, cons }, dmg) => {
      const eDmg = dmg(talent.e!["技能伤害"]! + talent.e!["相邻目标伤害"]! * 2, "e")
      const plusDot = cons >= 6 ? 1.56 : 0
      const dotBase = talent.q!["持续伤害"]! + plusDot

      // 主目标引爆
      const mainDetonate = dmg(dotBase * talent.e!["单体持续伤害比例"]!, "dot", "skillDot")
      // 相邻目标引爆
      const adjDetonate = dmg(dotBase * talent.e!["相邻目标持续伤害比例"]!, "dot", "skillDot")

      return {
        dmg: eDmg.dmg! + mainDetonate.avg + adjDetonate.avg * 2,
        avg: eDmg.avg + mainDetonate.avg + adjDetonate.avg * 2
      }
    }
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_5dba19487f"),
    params: { isDot: true },
    dmg: ({ talent, cons }, dmg) => {
      const qDmg = dmg(talent.q!["技能伤害"]!, "q")
      const plusDot = cons >= 6 ? 1.56 : 0
      const dotDmg = dmg((talent.q!["持续伤害"]! + plusDot) * talent.q!["持续伤害比例"]!, "dot", "skillDot")

      return {
        dmg: qDmg.dmg! + dotDmg.avg,
        avg: qDmg.avg + dotDmg.avg
      }
    }
  }
]

export const mainAttr = "atk,cpct,cdmg,effPct"
export const defDmgIdx = 6

export const buffs: Buff[] = [
  {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_dfffaa1b2e"),
    tree: 3
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_28d823a6eb"),
    cons: 1,
    check: ({ params }) => params.isDot === true,
    data: {
      dotEnemydmg: 30
    }
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_d984187a00"),
    cons: 2,
    check: ({ params }) => params.isDot === true,
    data: {
      dotDmg: 33
    }
  }, {
    title: $t("panel-damage-rules.characters.kafka-enhanced.text_0ea3e285e2"),
    cons: 6
  }
]
