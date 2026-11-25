import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.march-hunt.text_80a794cc80"),
  params: { EnhancedBasicAtk: true },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.march-hunt.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 0
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.march-hunt.text_a4ccab66a5"),
  cons: 1,
  data: {
    dmg: ({ talent }) => talent.t!['伤害提高']! * 100
  }
}, {
  check: ({ params }) => params.EnhancedBasicAtk === true,
  title: $t("panel-damage-rules.characters.march-hunt.text_c284105821"),
  cons: 6,
  data: {
    aCdmg: 50
  }
}]

export const createdBy = $t("panel-damage-rules.characters.march-hunt.text_08cd8017cf")
