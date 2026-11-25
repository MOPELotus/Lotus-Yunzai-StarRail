import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.himeko.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.himeko.text_eb18acf178"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['主目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.himeko.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.himeko.text_72c9e01999"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']!, 't')
}]

export const defParams = { tArtisBuffCount: 8 }
export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg,speed'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.himeko.text_dc84077fec"),
  data: {
    dmg: 10
  }
}, {
  title: $t("panel-damage-rules.characters.himeko.text_c388f8a8bf"),
  cons: 1,
  data: {
    dmg: 15
  }
}, {
  title: $t("panel-damage-rules.characters.himeko.text_38089f27e1"),
  tree: 2,
  data: {
    eDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.himeko.text_1a92a0c830"),
  tree: 3,
  data: {
    cpct: 15
  }
}]
