import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.gallagher.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.gallagher.text_5da6ea551c"),
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.gallagher.text_f9bc6007f7"),
  dmg: ({ talent }, { heal }) => heal(talent.e!['生命值回复']!)
}, {
  title: $t("panel-damage-rules.characters.gallagher.text_9a669cf39a"),
  dmg: ({ talent }, { heal }) => heal(talent.t!['生命值回复']!)
}]

export const mainAttr = 'atk,heal,stance'
export const defDmgIdx = 3

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.gallagher.text_f7531e9f00"),
  tree: 1,
  sort: 9,
  data: {
    heal: ({ attr }) => Math.min(attr.stance! * 0.5, 75)
  }
}, {
  title: $t("panel-damage-rules.characters.gallagher.text_d0340bfe8b"),
  data: {
    breakEnemydmg: ({ talent }) => talent.t!['击破伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.gallagher.text_b77576504e"),
  cons: 1,
  data: {
    effDef: 50
  }
}, {
  title: $t("panel-damage-rules.characters.gallagher.text_6f184498af"),
  cons: 6,
  data: {
    stance: 20
  }
}]

export const createdBy = 'Aluxes'
