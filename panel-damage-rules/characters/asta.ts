import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.asta.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.asta.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']! * 5, 'e')
}, {
  title: $t("panel-damage-rules.characters.asta.text_8d06038abe"),
  tree: 3,
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']! * 0.5, 'dot', 'skillDot')
}, {
  title: $t("panel-damage-rules.characters.asta.text_80b8a95958"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.t!['攻击力提高']! * 5),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.asta.text_f4632f8fb4"),
  dmg: ({ talent }) => {
    return {
      avg: talent.q!['速度提高']!,
      metric: 'support'
    }
  }
}]

export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.asta.text_c07fc10116"),
  tree: 3,
  data: {
    dmg: 18
  }
}, {
  title: $t("panel-damage-rules.characters.asta.text_81e17219e7"),
  data: {
    atkPct: ({ talent }) => talent.t!['攻击力提高']! * 5 * 100
  }
}]

export const createdBy = 'Aluxes'
