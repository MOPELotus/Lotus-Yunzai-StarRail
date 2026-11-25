import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [
  {
    title: $t("panel-damage-rules.characters.blade-enhanced.text_a900baa1d0"),
    dmg: ({ talent, attr, calc }, { basic }) => {
      return basic(talent.a!["技能伤害"]! * calc(attr.hp!), "a")
    }
  }, {
    title: $t("panel-damage-rules.characters.blade-enhanced.text_842b25ed18"),
    params: { ebuff: true },
    dmg: ({ talent, attr, calc }, { basic }) => {
      const hp = calc(attr.hp!)
      const hpDmg = (talent.a2!["技能伤害"]! + talent.a2!["相邻目标伤害"]! * 2) * hp
      return basic(hpDmg, "a")
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.blade-enhanced.text_5277f770b4", { "tTargetCount": params.tTargetCount }),
    params: { ebuff: true },
    dmg: ({ talent, attr, calc, params }, { basic }) => {
      const hp = calc(attr.hp!)
      const hpDmg = talent.t!["追加攻击伤害"]! * hp * (params.tTargetCount as number)
      return basic(hpDmg, "t")
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.blade-enhanced.text_a50ec2c29f", { "value1": (params.lostHp as number) * 100 }),
    params: { ebuff: true },
    dmg: ({ talent, attr, calc, params }, { basic }) => {
      const hp = calc(attr.hp!)
      const hpDmg = (talent.q!["生命上限伤害"]! + talent.q!["相邻目标•生命上限伤害"]! * 2) * hp
      const lostHpDmg = (talent.q!["累计已损生命伤害"]! + talent.q!["相邻目标•累计已损生命伤害"]! * 2) * hp * (params.lostHp as number)
      return basic(hpDmg + lostHpDmg, "q")
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.blade-enhanced.text_35ed371280", { "value1": (params.lostHp as number) * 100 }),
    cons: 1,
    params: { ebuff: true },
    dmg: ({ talent, attr, calc, params }, { basic }) => {
        const hp = calc(attr.hp!)
        const hpDmg = (talent.a2!["技能伤害"]! + talent.a2!["相邻目标伤害"]! * 2) * hp
        const cons1Dmg = talent.q!["累计已损生命伤害"]! * 1.5 * hp * (params.lostHp as number)
        return basic(hpDmg + cons1Dmg, "a")
    }
  }
]

export const defParams = {
  ebuff: true,      // 处于【地狱变】状态
  lostHp: 0.9,      // 已损失生命值达到90%上限
  tTargetCount: 3,  // 追加攻击命中3个目标
  c4stacks: 2       // 4命吃到满层(2层)
}

export const defDmgIdx = 3
export const mainAttr = "hp,cpct,cdmg"

export const buffs: Buff[] = [
  {
    check: ({ params }) => params.ebuff === true,
    title: $t("panel-damage-rules.characters.blade-enhanced.text_f07bbc6839"),
    data: {
      dmg: ({ talent }) => talent.e!["造成的伤害提高"]! * 100
    }
  }, {
    title: $t("panel-damage-rules.characters.blade-enhanced.text_c133a657ab"),
    tree: 3,
    data: {
      tDmg: 20
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.blade-enhanced.text_1fcb69d6f8", { "value1": (params.lostHp as number) * 100 }),
    cons: 1,
    data: {
      aPlus: ({ attr, calc, talent, params }) => talent.q!["累计已损生命伤害"]! * 1.5 * calc(attr.hp!) * (params.lostHp as number),
      qPlus: ({ attr, calc, talent, params }) => talent.q!["累计已损生命伤害"]! * 1.5 * calc(attr.hp!) * (params.lostHp as number)
    }
  }, {
    check: ({ params }) => params.ebuff === true,
    title: $t("panel-damage-rules.characters.blade-enhanced.text_86ec7ed9a6"),
    cons: 2,
    data: {
      cpct: 15
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.blade-enhanced.text_f5acd50743", { "c4stacks": params.c4stacks }),
    cons: 4,
    data: {
      hpPct: ({ params }) => (params.c4stacks as number) * 20
    }
  }, {
    title: ({ params }) => $t("panel-damage-rules.characters.blade-enhanced.text_fd9c8e3250", { "tTargetCount": params.tTargetCount }),
    cons: 6,
    data: {
      tPlus: ({ attr, calc, params }) => calc(attr.hp!) * 0.5 * (params.tTargetCount as number)
    }
  }
]
