import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

// 注意：天赋击破伤害减伤区为0.9，终结技和秘技击破伤害减伤区为1.0
export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.ruan-mei.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_cd6d581e0a"),
  params: { break: true },
  dmg: ({ talent }, { reaction }) => {
    return {
      avg: reaction('iceBreak').avg / 0.9 * (2 + 2) / 4 * 20
    }
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_6876e8eb43"),
  params: { break: true },
  dmg: ({ talent }, { reaction }) => {
    return {
      avg: reaction('iceBreak').avg / 0.9 * (10 + 2) / 4 * 20
    }
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_5dd38e93d5"),
  params: { break: true, qBuff: true },
  dmg: ({ talent }, { reaction }) => {
    return {
      avg: reaction('iceBreak').avg / 0.9 * (2 + 2) / 4 * talent.q!['击破伤害比例']!
    }
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_0151c8c0c3"),
  params: { break: true, qBuff: true },
  dmg: ({ talent }, { reaction }) => {
    return {
      avg: reaction('iceBreak').avg / 0.9 * (10 + 2) / 4 * talent.q!['击破伤害比例']!
    }
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_15dffef6e6"),
  params: { qBuff: true },
  dmg: ({ talent, cons }, { reaction }) => {
    const extraBreakTd = cons * 1 >= 6 ? 2 : 0
    return {
      avg: reaction('iceBreak').avg * (2 + 2) / 4 * talent.t!['击破伤害比例']! * (1 + extraBreakTd)
    }
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_466dd315b2"),
  params: { qBuff: true },
  dmg: ({ talent, cons }, { reaction }) => {
    const extraBreakTd = cons * 1 >= 6 ? 2 : 0
    return {
      avg: reaction('iceBreak').avg * (10 + 2) / 4 * talent.t!['击破伤害比例']! * (1 + extraBreakTd)
    }
  }
}]

export const defDmgIdx = 6
export const mainAttr = 'atk,stance'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.ruan-mei.text_9d6062374a"),
  tree: 1,
  data: {
    stance: 20
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_b3c8da87a4"),
  check: ({ params }) => params.qBuff === true,
  data: {
    kx: ({ talent }) => talent.q!['抗性穿透提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_240d55fbc4"),
  check: ({ params }) => params.qBuff === true,
  cons: 1,
  data: {
    ignore: 20
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_0ae1c1289f"),
  check: ({ params }) => params.break === true,
  cons: 4,
  data: {
    stance: 100
  }
}, {
  title: $t("panel-damage-rules.characters.ruan-mei.text_f8dde1b7d2"),
  cons: 6
}]

export const createdBy = 'Aluxes'
