import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
    title: $t("panel-damage-rules.characters.gilgamesh.text_8b79df27ba"),
    dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_6d8c868f52"),
    dmg: ({ talent, cons }, dmg) => dmg(talent.e!['单体伤害']! * 2 + (cons > 2 ? 2 : 0), 'e')
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_7c6bd561b3"),
    dmg: ({ talent }, dmg) => dmg(talent.q!['群攻伤害']! + talent.q!['弹射伤害']! * 10, 'q')
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_339e32244e"),
    dmg: ({ talent }, dmg) => dmg(talent.t2!['技能伤害']!, 't2')
  }]

  export const defDmgIdx = 3
  export const mainAttr = 'atk,cpct,cdmg,dmg'

  export const buffs: Buff[] = [{
    title: $t("panel-damage-rules.characters.gilgamesh.text_302d068017"),
    tree: 2,
    data: {
      cdmg: 150
    }
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_8de301b441"),
    tree: 3,
    data: {
      atkPct: ({ attr }) => { return attr.sp! > 140 ? attr.sp! > 240 ? 120 : attr.sp! - 120 : 0},
      cdmg: ({ attr }) => { return attr.sp! > 140 ? attr.sp! > 240 ? 120 : attr.sp! - 120 : 0},
    }
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_fe16322d11"),
    data: {
      enemydmg: 20
    }
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_d3f85e70ad"),
    data: {
      qDmg: 40
    }
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_4f1ad7148e"),
    data: {
      ignore: 30
    }
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_28dbd96543"),
    cons: 1,
    data: {
      atkPct: 60
    }
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_a3f4bc4b48"),
    cons: 2
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_8c7a9e5228"),
    cons: 4,
    data: {
      recharge: 20
    }
  }, {
    title: $t("panel-damage-rules.characters.gilgamesh.text_3c893b0479"),
    cons: 6,
    data: {
      kx: 20,
      qCdmg: 300
    }
  }]

  export const createdBy = $t("panel-damage-rules.characters.gilgamesh.text_7ad80046cc")
