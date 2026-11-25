import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_8b79df27ba"),
    dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_6d8c868f52"),
    dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_8e626818bc"),
    dmg: ({ talent }, dmg) => dmg(talent.e2!['群攻伤害']! + talent.e2!['弹射伤害']! * 10, 'e2')
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_b36d5d3502"),
    dmg: ({ talent }, dmg) => dmg(talent.q!['目标伤害']! + talent.q!['群攻伤害']! * 4, 'q')
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_3d39b02c9f"),
    dmg: ({ talent }, dmg) => dmg(talent.t2!['技能伤害']!, 't2')
  }]

  export const defDmgIdx = 3
  export const mainAttr = 'atk,cpct,cdmg,dmg'

  export const buffs: Buff[] = [{
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_6ed1faec4a"),
    tree: 1,
    data: {
      kx: 20,
      atkPct: 150
    }
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_fe16322d11"),
    data: {
      enemydmg: 20
    }
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_2cf79c2b4a"),
    data: {
      cdmg: 70
    }
  },{
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_d1faa3499e"),
    cons: 2,
    data: {
      eDmg: 30,
      e2Dmg: 30,
      eMulti: 130
    }
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_4582764127"),
    cons: 4,
    data: {
      cdmg: 70
    }
  }, {
    title: $t("panel-damage-rules.characters.tohsaka-rin.text_f33c683e88"),
    cons: 6,
    data: {
      kx: 20
    }
  }]

  export const createdBy = $t("panel-damage-rules.characters.tohsaka-rin.text_7ad80046cc")
