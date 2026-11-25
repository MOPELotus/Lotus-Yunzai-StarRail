import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.argenti.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.argenti.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.argenti.text_b6a5fc7f30"),
  params: { q: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.argenti.text_3d13b9be64"),
  params: { q: true },
  dmg: ({ talent }, dmg) => {
    const td = talent.q2!['技能伤害']! + talent.q2!['额外随机伤害']! * 6
    return dmg(td, 'q')
  }
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.argenti.text_4c3859a4e0"),
  trees: 2,
  data: {
    dmg: 15
  }
}, {
  title: $t("panel-damage-rules.characters.argenti.text_bbfc73f7a9"),
  data: {
    _count: ({ cons }) => cons < 4 ? 10 : 12,
    cpct: ({ cons }) => cons < 4 ? 25 : 30
  }
}, {
  title: $t("panel-damage-rules.characters.argenti.text_8155ca6262"),
  cons: 1,
  data: {
    _count: ({ cons }) => cons < 4 ? 10 : 12,
    cdmg: ({ cons }) => cons < 4 ? 40 : 48
  }
}, {
  title: $t("panel-damage-rules.characters.argenti.text_7ab5e702a6"),
  cons: 2,
  check: ({ params }) => params.q === true,
  data: {
    atkPct: 40
  }
}, {
  title: $t("panel-damage-rules.characters.argenti.text_d31b831e7d"),
  cons: 4
}, {
  title: $t("panel-damage-rules.characters.argenti.text_97f8059600"),
  cons: 6,
  check: ({ params }) => params.q === true,
  data: {
    ignore: 30
  }
}]

export const createdBy = 'Aluxes'
