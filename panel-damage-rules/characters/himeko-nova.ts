import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.himeko-nova.text_8b79df27ba"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_9382421c45"),
  params: { caijue: true },
  dmg: ({ talent, cons }, dmg) => dmg((talent.t2!['群体伤害']! + talent.t2!['弹射伤害']! * (cons >= 1 ? 5 : 4)) * (cons >= 2 ? 1.3 : 1), 't2')
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_b240150234"),
  params: { caijue: true },
  dmg: ({ talent, cons }, dmg) => {
    return {
      dmg: (dmg(talent.q3!['弹射伤害']! * 2 * 3, 'q3').dmg! + dmg(talent.q3!['群体伤害']!, 'q3').dmg! +
      dmg(talent.q2!['技能伤害']!, 'q2').dmg! + dmg(talent.q!['弹射伤害']! * 3, 'q').dmg!) * (cons >= 2 ? 1.3 : 1),
      avg: (dmg(talent.q3!['弹射伤害']! * 2 * 3, 'q3').avg + dmg(talent.q3!['群体伤害']!, 'q3').avg +
      dmg(talent.q2!['技能伤害']!, 'q2').avg + dmg(talent.q!['弹射伤害']! * 3, 'q').avg) * (cons >= 2 ? 1.3 : 1),
    }
  }
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_46258b4c84"),
  params: { jianpo: true },
  dmg: ({ talent, cons }, dmg) => dmg((talent.t2!['群体伤害']! + talent.t2!['弹射伤害']! * (cons >= 1 ? 5 : 4)) * (cons >= 2 ? 1.3 : 1), 't2')
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_acd35ff2a7"),
  params: { jianpo: true },
  dmg: ({ talent, cons }, dmg) => {
    return {
      dmg: (dmg(talent.q3!['弹射伤害']! * 2 * 3, 'q3').dmg! + dmg(talent.q3!['群体伤害']!, 'q3').dmg! +
      dmg(talent.q2!['技能伤害']!, 'q2').dmg! + dmg(talent.q!['弹射伤害']! * 3, 'q').dmg!) * (cons >= 2 ? 1.3 : 1),
      avg: (dmg(talent.q3!['弹射伤害']! * 2 * 3, 'q3').avg + dmg(talent.q3!['群体伤害']!, 'q3').avg +
      dmg(talent.q2!['技能伤害']!, 'q2').avg + dmg(talent.q!['弹射伤害']! * 3, 'q').avg) * (cons >= 2 ? 1.3 : 1),
    }
  }
}]

export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg,dmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.himeko-nova.text_e4e996a877"),
  data: {
    kx: 20,
    cdmg: 80
  }
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_f1587ca823"),
  data: {
    dmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_bb2d385d14"),
  check: ({ params }) => params.caijue === true,
  data: {
    dmg: 100,
    qDmg: 100
  }
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_5ee484b21a"),
  check: ({ params }) => params.jianpo === true,
  data: {
    cdmg: 200
  }
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_a88f9b6921"),
  cons: 1
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_ea218442c1"),
  cons: 2
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_40bc115f23"),
  cons: 4,
  data: {
    kx: 10
  }
}, {
  title: $t("panel-damage-rules.characters.himeko-nova.text_cb5d4de5aa"),
  cons: 6,
  data: {
    tDmg: 75,
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.himeko-nova.text_7ad80046cc")
