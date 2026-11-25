import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.sparxie.text_c3a2ab0783"),
  params: { punchline: 80 },
  dmg: ({ talent }, dmg) => {
    let a2Normal = talent.a2!['强化普攻目标伤害']! * 2 * (1 + talent.e2!['强化普攻目标倍率提升']! / talent.a2!['强化普攻目标伤害']! * 10)
    let a2Xe = talent.t!['强化普攻目标欢愉伤害']! * 2 * (1 + talent.e2!['强化普攻目标倍率提升']! / talent.t!['强化普攻目标欢愉伤害']! * 10)
    let eXe = talent.t!['强化普攻弹射欢愉伤害']! * 10
    return {
      dmg: dmg(a2Normal, 'a2').dmg! + dmg(a2Xe + eXe, 'xe', 'elation').dmg!,
      avg: dmg(a2Normal, 'a2').avg + dmg(a2Xe + eXe, 'xe', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_b6a5fc7f30"),
  dmg: ({ talent, attr }, dmg) => {
    let qNormal = talent.q!['终结技']! + (attr.joy!.base! + attr.joy!.pct!) / 100 * 0.6
    let qXe = talent.t!['终结技欢愉伤害']!
    return {
      dmg: dmg(qNormal, 'q').dmg! + dmg(qXe, 'xe', 'elation').dmg!,
      avg: dmg(qNormal, 'q').avg + dmg(qXe, 'xe', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_902f89d4bd"),
  params: { punchline: 80 },
  dmg: ({ talent }, dmg) => dmg(talent.xe!['群攻']! + talent.xe!['弹射']! * 20, 'xe', 'elation')
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.sparxie.text_b5bd96de5c"),
  tree: 1,
  data: {
    joy: ({ attr }) => Math.min(Math.trunc((attr.atk! - 2000) / 100 * 5), 80)
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_9774ddfc5b"),
  tree: 3,
  data: {
    cdmg: 80
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_d4facb9a06"),
  tree: 2,
  data: {
    cdmg: 60
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_76c960e299"),
  data: {
    punchline: ({ params }) => params.punchline
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_3575b0b8fd"),
  cons: 1,
  data: {
    kx: 15
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_05a98f4f26"),
  cons: 2,
  data: {
    cdmg: 40
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_7df8de617f"),
  cons: 4,
  data: {
    joy: 36
  }
}, {
  title: $t("panel-damage-rules.characters.sparxie.text_3f3c775a44"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.sparxie.text_7ad80046cc")
