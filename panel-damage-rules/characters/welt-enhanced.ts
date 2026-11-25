import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.welt-enhanced.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']! * 1.8, 'a')
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_aef3538851"),
  dmg: ({ talent }, dmg, cons) => dmg(talent.e!['技能伤害']! * 6.2 + (cons! > 0 ? talent.q!['技能伤害']! * 0.4 : 0), 'e')
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg, cons) => dmg(talent.q!['技能伤害']! * (cons! > 0 ? 1.4 : 1), 'q')
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_81891586ea"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['附加伤害']!, 't')
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg,effPct'
export const createdBy = $t("panel-damage-rules.characters.welt-enhanced.text_7ad80046cc")

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.welt-enhanced.text_9e28bb96ac"),
  tree: 1,
  data: {
    dmg: 100
  }
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_e3cd89b9da"),
  tree: 2
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_fdb0d08ce6"),
  tree: 3,
  data: {
    atkPct: ({ attr }) => Math.min(Math.ceil(attr.effPct! - 40) / 10 * 20, 80)
  }
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_7ee8be8f0a"),
  data: {
    def: 40
  }
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_ee88777d2b"),
  cons: 1
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_62d896a5a0"),
  cons: 4,
  data: {
    kx: 30
  }
}, {
  title: $t("panel-damage-rules.characters.welt-enhanced.text_951ba20858"),
  cons: 6,
  data: {
    cpct: 30,
    cdmg: 60
  }
}]
