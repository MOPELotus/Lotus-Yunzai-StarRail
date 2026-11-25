import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff, Rule } from "../types.ts";

export const details: DamageDetail[] = [
  {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_a900baa1d0"),
    dmg: ({ talent }, dmg) => dmg(talent.a!["技能伤害"]!, "a")
  }, {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_aef3538851"),
    dmg: ({ talent }, dmg) => dmg(talent.e!["技能伤害"]!, "e")
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.silver-wolf-enhanced.text_84f7e33cda", { "qTargetCount": params.qTargetCount }),
    dmg: ({ talent, params }, dmg) => dmg(talent.q!["技能伤害"]! * (params.qTargetCount as number), "q")
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.silver-wolf-enhanced.text_d573c70961", { "qTargetCount": params.qTargetCount, "debuffCount": params.debuffCount }),
    cons: 4,
    dmg: ({ talent, params }, dmg) => {
      const qMultiplier = talent.q!["技能伤害"]!;
      const c4Multiplier = Math.min((params.debuffCount as number), 5) * 0.2;
      const totalMultiplier = qMultiplier + c4Multiplier;
      return dmg(totalMultiplier * (params.qTargetCount as number), "q");
    }
  }, {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_ae749d3fc4"),
    dmg: ({ }, { reaction }) => {
      return {
        avg: reaction("entanglement").avg * 5 * (10 + 2) / 4
      }
    }
  }
]

export const defParams = {
  debuffCount: 5, // 敌人有5个负面buff
  qTargetCount: 3 // 终结技命中3个目标
}

export const defDmgIdx: NonNullable<Rule["defDmgIdx"]> = ({ cons }) => cons >= 4 ? 3 : 2
export const mainAttr = "atk,cpct,cdmg,effPct"

export const buffs: Buff[] = [
  {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_b82434cffb"),
    data: {
      enemyDef: ({ talent }) => talent.t!["防御力降低"]! * 100
    }
  }, {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_c994b94183"),
    data: {
      kx: ({ talent }) => 20 + talent.e!["抗性降低"]! * 100
    }
  }, {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_30d65d9b03"),
    data: {
      enemyDef: ({ talent }) => talent.q!["防御力降低"]! * 100
    }
  }, {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_2a2fcd69f7"),
    tree: 3,
    data: {
      atkPct: ({ attr, calc }) => Math.min(Math.floor(calc(attr.effPct!) / 10) * 10, 50)
    }
  }, {
    title: $t("panel-damage-rules.characters.silver-wolf-enhanced.text_82bdf38de0"),
    cons: 2,
    data: {
      enemydmg: 20
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.silver-wolf-enhanced.text_a3bf4a2e85", { "debuffCount": params.debuffCount }),
    cons: 6,
    data: {
      dmg: ({ params }) => Math.min((params.debuffCount as number) * 20, 100)
    }
  }
]
