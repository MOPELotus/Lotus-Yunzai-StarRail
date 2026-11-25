import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.evanescia.text_697c60e320"),
  params: { punchline: 1000 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.e!['目标技能伤害']! * 2, 'e').dmg! + dmg(talent.t!['战技欢愉伤害']! * 3, 't', 'elation').dmg!,
      avg: dmg(talent.e!['目标技能伤害']! * 2, 'e').avg + dmg(talent.t!['战技欢愉伤害']! * 3, 't', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_325d0f2f67"),
  params: { punchline: 1000 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.q!['技能伤害']! + talent.q!['技能弹射伤害']! * 9, 'q').dmg! +
        dmg(talent.t!['大招欢愉伤害']! + talent.t!['大招欢愉弹射伤害']! * 9, 't', 'elation').dmg!,
      avg: dmg(talent.q!['技能伤害']! + talent.q!['技能弹射伤害']! * 9, 'q').avg +
        dmg(talent.t!['大招欢愉伤害']! + talent.t!['大招欢愉弹射伤害']! * 9, 't', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_58c6702b5b"),
  params: { punchline: 1000 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.q!['技能伤害']! * 3 + talent.q!['技能弹射伤害']! * 6, 'q').dmg! +
        dmg(talent.t!['大招欢愉伤害']! * 3 + talent.t!['大招欢愉弹射伤害']! * 6, 't', 'elation').dmg!,
      avg: dmg(talent.q!['技能伤害']! * 3 + talent.q!['技能弹射伤害']! * 6, 'q').avg +
        dmg(talent.t!['大招欢愉伤害']! * 3 + talent.t!['大招欢愉弹射伤害']! * 6, 't', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_03178e1b9e"),
  params: { punchline: 50 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.t!['追加攻击伤害']!, 't').dmg! + dmg(talent.t!['追加攻击欢愉伤害']!, 't', 'elation').dmg!,
      avg: dmg(talent.t!['追加攻击伤害']!, 't').avg + dmg(talent.t!['追加攻击欢愉伤害']!, 't', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_1d26acfc68"),
  params: { punchline: 50 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.t!['追加攻击伤害']! * 3, 't').dmg! + dmg(talent.t!['追加攻击欢愉伤害']! * 3, 't', 'elation').dmg!,
      avg: dmg(talent.t!['追加攻击伤害']! * 3, 't').avg + dmg(talent.t!['追加攻击欢愉伤害']! * 3, 't', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_902f89d4bd"),
  params: { punchline: 80 },
  dmg: ({ talent }, dmg) => dmg(talent.xe!['技能伤害']!, 'xe', 'elation')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg,recharge'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.evanescia.text_a2eff9d8f8"),
  data: {
    joy: ({ attr }) => attr.cdmg! * 0.2
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_c322aa53c9"),
  tree: 1,
  data: {
    cpct: 30
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_7e6d397d1e"),
  tree: 1,
  data: {
    enemydmg: 12
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_76c960e299"),
  data: {
    punchline: ({ params }) => params.punchline
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_5f826686dd"),
  cons: 1,
  data: {
    kx: 20
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_b68c66e5cf"),
  cons: 2,
  data: {
    cdmg: 36
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_fcafcb0932"),
  cons: 4,
  data: {
    ignore: 15
  }
}, {
  title: $t("panel-damage-rules.characters.evanescia.text_b6d948aa23"),
  cons: 6,
  data: {
    merrymakes: 35
  }
}]

export const createdBy = $t("panel-damage-rules.characters.evanescia.text_7ad80046cc")
