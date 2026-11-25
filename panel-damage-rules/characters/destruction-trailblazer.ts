import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_aef3538851"),
  params: { buff: true },
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_9562ff6762"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['单体伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_865663ca7b"),
  params: { buff: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['扩散伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_d84ee1cece"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['扩散伤害·相邻目标']!, 'q')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_ea65e79484"),
  data: {
    atkPct: ({ talent }) => talent.t!['攻击力提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_27e49f5a46"),
  tree: 2,
  data: {
    defPct: 20
  }
}, {
  title: $t("panel-damage-rules.characters.destruction-trailblazer.text_6684c3f487"),
  tree: 3,
  check: ({ params }) => params.buff === true,
  data: {
    dmg: 25
  }
}]

export const createdBy = 'Aluxes'
