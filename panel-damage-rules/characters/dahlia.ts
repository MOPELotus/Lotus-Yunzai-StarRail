import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [
  {
    title: $t("panel-damage-rules.characters.dahlia.text_2da6884cb4"),
    dmg: ({ talent }, dmg) => dmg(talent.e!["技能伤害"]!, "e")
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_f95f3d9911"),
    dmg: ({ talent }, dmg) => {
      let sb = dmg.reaction("superBreak")
      return {
        avg: Number((sb.avg * 9.0).toFixed(0))
      }
    }
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_b6a5fc7f30"),
    dmg: ({ talent }, dmg) => dmg(talent.q!["技能伤害"]!, "q")
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_1801cdc008"),
    dmg: ({ talent }, dmg) => dmg(talent.t!["追加攻击伤害"]! * 5, "t")
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_74004fd8ec"),
    dmg: ({ talent, cons }, dmg) => {
      let sb = dmg.reaction("superBreak")
      let mult = talent.t!["弱点状态超击破伤害"]! + (cons >= 1 ? 0.4 : 0)
      return {
        avg: Number((sb.avg * 11.25 * mult).toFixed(0))
      }
    }
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_b944f698a4"),
    dmg: ({ talent }, dmg) => {
      let eDmg = dmg(talent.e!["技能伤害"]!, "e")
      let sb = dmg.reaction("superBreak")
      let sbDmg = sb.avg * 9.0
      return {
        dmg: eDmg.dmg! + sbDmg,
        avg: eDmg.avg + sbDmg
      }
    }
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_831b7e937a"),
    dmg: ({ talent, cons }, dmg) => {
      let tDmg = dmg(talent.t!["追加攻击伤害"]! * 5, "t")
      let sb = dmg.reaction("superBreak")
      let mult = talent.t!["弱点状态超击破伤害"]! + (cons >= 1 ? 0.4 : 0)
      let sbDmg = sb.avg * 11.25 * mult
      return {
        dmg: tDmg.dmg! + sbDmg,
        avg: tDmg.avg + sbDmg
      }
    }
  }
]

export const defDmgIdx = 6
export const mainAttr = "atk,cpct,cdmg,stance"

export const buffs: Buff[] = [
  {
    title: $t("panel-damage-rules.characters.dahlia.text_a645bf7891"),
    data: {
      enemyDef: ({ talent }) => talent.q!["防御力降低"]! * 100
    }
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_3b2bbde145"),
    cons: 1
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_753fd6b960"),
    cons: 2,
    data: {
      kx: 20
    }
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_20eaf16697"),
    cons: 4,
    data: {
      enemydmg: 12
    }
  }, {
    title: $t("panel-damage-rules.characters.dahlia.text_60d402f0a3"),
    cons: 6,
    data: {
      stance: 150
    }
  }
]

export const createdBy = $t("panel-damage-rules.characters.dahlia.text_1382c29681")
