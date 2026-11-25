import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [
  {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_a900baa1d0"),
    dmg: ({ talent, attr, calc }, { basic }) => basic(talent.a!["技能伤害"]! * calc(attr.hp!), "a")
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_aef3538851"),
    dmg: ({ talent, attr, calc }, { basic }) => basic(talent.e!["技能伤害"]! * calc(attr.hp!), "e")
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_a8b5ec058a"),
    params: { q: true },
    dmg: ({ talent, attr, calc }, { basic }) => basic((talent.q!["技能伤害"]! + talent.q!["相邻目标伤害"]! * 2) * calc(attr.hp!), "q")
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.jingliu-enhanced.text_e764eef249", { "moonlight": params.moonlight }),
    dmg: ({ talent, attr, calc }, { basic }) => basic((talent.e2!["技能伤害"]! + talent.e2!["相邻目标伤害"]! * 2) * calc(attr.hp!), "e")
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.jingliu-enhanced.text_8f2d6e6283", { "moonlight": params.moonlight }),
    dmgKey: "q_strength",
    dmg: ({ talent, attr, calc }, { basic }) => basic((talent.q!["技能伤害"]! + talent.q!["相邻目标伤害"]! * 2) * calc(attr.hp!), "q")
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_26423da6e6"),
    cons: 1,
    dmg: ({ attr, calc }, { basic }) => basic(0.8 * calc(attr.hp!))
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.jingliu-enhanced.text_70d90b3be0", { "moonlight": params.moonlight }),
    cons: 2,
    params: { afterQ: true },
    dmg: ({ talent, attr, calc }, { basic }) => basic((talent.e2!["技能伤害"]! + talent.e2!["相邻目标伤害"]! * 2) * calc(attr.hp!), "e")
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.jingliu-enhanced.text_50acdfe512", { "moonlight": params.moonlight }),
    tree: 3,
    params: { ignoreDef: true },
    dmg: ({ talent, attr, calc }, { basic }) => basic((talent.e2!["技能伤害"]! + talent.e2!["相邻目标伤害"]! * 2) * calc(attr.hp!), "e")
  }
]

export const defParams = {
  strength: true,  // 处于【转魄】状态
  moonlight: 5,    // 【月色】叠满5层
  q: true          // 计算终结技相关buff
}

export const defDmgKey = "q_strength"
export const mainAttr = "hp,cpct,cdmg"

export const buffs: Buff[] = [
  {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_a789007f5c"),
    tree: 1,
    check: ({ params }) => params.strength === true,
    data: {
      qDmg: 20
    }
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_0ed588930b"),
    tree: 3,
    check: ({ params }) => params.ignoreDef === true,
    data: {
      ignore: 25
    }
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_28d23a9698"),
    check: ({ params }) => params.strength === true,
    data: {
      cpct: ({ talent }) => talent.t!["暴击率提高"]! * 100
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.jingliu-enhanced.text_b6c9558f52", { "moonlight": params.moonlight }),
    check: ({ params }) => params.strength === true && (params.moonlight as number) > 0,
    data: {
      cdmg: ({ talent, params }) => (params.moonlight as number) * talent.t!["暴伤提高"]! * 100
    }
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_264aa98f49"),
    cons: 1,
    check: ({ params }) => params.q === true || params.strength === true,
    data: {
      cdmg: 36
    }
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_fd82a8f85a"),
    cons: 2,
    check: ({ params }) => params.strength === true && params.afterQ,
    data: {
      eDmg: 80
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.jingliu-enhanced.text_1f3201be53", { "moonlight": params.moonlight }),
    cons: 4,
    check: ({ params }) => params.strength === true && (params.moonlight as number) > 0,
    data: {
      cdmg: ({ params }) => (params.moonlight as number) * 20
    }
  }, {
    title: $t("panel-damage-rules.characters.jingliu-enhanced.text_c960f7c027"),
    cons: 6,
    check: ({ params }) => params.strength === true,
    data: {
      kx: 30
    }
  }
]
