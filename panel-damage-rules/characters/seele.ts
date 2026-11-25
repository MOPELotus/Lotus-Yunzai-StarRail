import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.seele.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.seele.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.seele.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg,speed'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.seele.text_65d15126d6"),
  data: {
    dmg: ({ talent }) => talent.t!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.seele.text_78d34729ee"),
  maxCons: 1,
  data: {
    speedPct: 25
  }
}, {
  title: $t("panel-damage-rules.characters.seele.text_e26bb5bb3d"),
  cons: 1,
  data: {
    cpct: 15
  }
}, {
  title: $t("panel-damage-rules.characters.seele.text_56b97bf90d"),
  cons: 2,
  data: {
    speedPct: 50
  }
}, {
  title: $t("panel-damage-rules.characters.seele.text_28942da55e"),
  tree: 2,
  data: {
    kx: 20
  }
}]
