import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.pela.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.pela.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.pela.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.pela.text_ad6ea4e541"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['防御力降低']!),
      type: 'text'
    }
  }
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.pela.text_7568d4bc93"),
  data: {
    enemyDef: ({ talent }) => talent.q!['防御力降低']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.pela.text_550935bc41"),
  tree: 1,
  data: {
    dmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.pela.text_8cbaed8f4b"),
  tree: 2,
  data: {
    effPct: 10
  }
}, {
  title: $t("panel-damage-rules.characters.pela.text_d535304e21"),
  tree: 3,
  data: {
    dmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.pela.text_a100cb25b1"),
  cons: 2,
  data: {
    speedPct: 10
  }
}, {
  title: $t("panel-damage-rules.characters.pela.text_539bd4f538"),
  cons: 4,
  data: {
    kx: 12
  }
}]

export const createdBy = 'Aluxes'
