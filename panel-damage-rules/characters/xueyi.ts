import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.xueyi.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_ef9a46e334"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['单体伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_108fbe8b4d"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_3c62b8771b"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['追加攻击单次伤害']! * 3, 't')
}]

export const mainAttr = 'atk,cpct,cdmg,stance'
export const defDmgIdx = 4

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.xueyi.text_07e6c14537"),
  data: {
    qDmg: ({ talent }) => talent.q!['伤害提高上限']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_e9706d7ce8"),
  tree: 1,
  sort: 9,
  data: {
    dmg: ({ attr }) => Math.min(attr.stance!, 240)
  }
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_aab9be3cd2"),
  tree: 2,
  data: {
    qDmg: 10
  }
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_d63cd9891c"),
  cons: 1,
  data: {
    tDmg: 40
  }
}, {
  title: $t("panel-damage-rules.characters.xueyi.text_825940359e"),
  cons: 4,
  data: {
    stance: 40
  }
}]

export const createdBy = 'Aluxes'
