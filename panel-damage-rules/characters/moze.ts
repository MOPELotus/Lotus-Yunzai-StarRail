import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.moze.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.moze.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.moze.text_81891586ea"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['附加伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.moze.text_de6842a3c3"),
  params: { FollowUpAttack: true },
  dmg: ({ talent, cons }, dmg) => {
    let num = cons === 6 ? 0.25 : 0
    return dmg(talent.t!['追加攻击伤害']! + num, 't')
  }
}, {
  title: $t("panel-damage-rules.characters.moze.text_b6a5fc7f30"),
  params: { FollowUpAttack: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  check: ({ params }) => params.FollowUpAttack === true,
  title: $t("panel-damage-rules.characters.moze.text_06de7867b3"),
  tree: 3,
  data: {
    enemydmg: 25
  }
}, {
  title: $t("panel-damage-rules.characters.moze.text_96fc91f1af"),
  cons: 1,
  data: {
    cdmg: 40
  }
}, {
  title: $t("panel-damage-rules.characters.moze.text_0c70385ba5"),
  cons: 4,
  data: {
    dmg: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.moze.text_08cd8017cf")
