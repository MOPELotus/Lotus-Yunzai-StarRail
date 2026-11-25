import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.feixiao.text_58bdfa81b4"),
  dmgKey: 'e',
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.feixiao.text_f07bf09266"),
  params: { cons1: true },
  dmgKey: 'q',
  dmg: ({ talent }, dmg) => dmg(talent.q!['最后造成伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.feixiao.text_bb89d234bd"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['最多造成伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.feixiao.text_8be2fbcd35"),
  dmg: ({ talent, cons }, dmg) => {
    let talentConfig = cons >= 6 ? 'q,t' : 't'
    let tdmg = dmg(talent.t!['追加攻击伤害']!, `${talentConfig}`)
    return tdmg
  }
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.feixiao.text_d5b9be5dd8"),
  data: {
    dmg: ({ talent }) => talent.t!['造成伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.feixiao.text_65b4de937c"),
  tree: 2,
  data: {
    tCdmg: 36
  }
}, {
  title: $t("panel-damage-rules.characters.feixiao.text_aedac2d793"),
  tree: 3,
  data: {
    atkPct: 48
  }
}, {
  check: ({ params }) => params.cons1 === true,
  title: $t("panel-damage-rules.characters.feixiao.text_5f17e3bd84"),
  cons: 1,
  data: {
    qPlus: ({ talent, attr, calc }) => calc(attr.atk!) * talent.q!['最后造成伤害']! * 10 / 100 * 5
  }
}, {
  title: $t("panel-damage-rules.characters.feixiao.text_8b20562d8c"),
  cons: 4,
  data: {
    speedPct: 8
  }
}, {
  title: $t("panel-damage-rules.characters.feixiao.text_f4afa9cd93"),
  cons: 6,
  data: {
    qKx: 20,
    tPlus: ({ attr, calc }) => calc(attr.atk!) * 140 / 100
  }
}]

export const createdBy = 'liangshi'
