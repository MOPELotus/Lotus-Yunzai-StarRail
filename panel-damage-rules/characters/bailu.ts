import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.bailu.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.bailu.text_30714f70bf"),
  dmg: ({ calc, attr, talent }, { heal }) => heal(calc(attr.hp!) * talent.e!['百分比生命']! + talent.e!['固定值']!)
}, {
  title: $t("panel-damage-rules.characters.bailu.text_cfa9032508"),
  dmg: ({ calc, attr, talent }, { heal }) => heal(calc(attr.hp!) * talent.q!['百分比生命']! + talent.q!['固定值']!)
}, {
  title: $t("panel-damage-rules.characters.bailu.text_cbb454a322"),
  dmg: ({ calc, attr, talent }, { heal }) => heal(calc(attr.hp!) * talent.t!['生息·百分比生命']! + talent.t!['生息·固定值']!)
}]

export const mainAttr = 'atk,cpct,cdmg,hp'
export const defDmgIdx = 2

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.bailu.text_c0c17efe78"),
  cons: 2,
  data: {
    heal: 15
  }
}]
