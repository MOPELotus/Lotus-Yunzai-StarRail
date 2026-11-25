import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.herta.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.herta.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.herta.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.herta.text_28960b911a"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']!, 't')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.herta.text_fa30a77d67"),
  data: {
    atkPct: 40
  }
}, {
  title: $t("panel-damage-rules.characters.herta.text_5ff5af69ad"),
  tree: 1,
  data: {
    eDmg: 25
  }
}, {
  title: $t("panel-damage-rules.characters.herta.text_09a19d8ae9"),
  tree: 3,
  data: {
    qDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.herta.text_ec71b4e376"),
  data: {
    eDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.herta.text_05104f3d7a"),
  cons: 2,
  data: {
    cpct: 15
  }
}, {
  title: $t("panel-damage-rules.characters.herta.text_f13ca55861"),
  cons: 4,
  data: {
    tDmg: 10
  }
}, {
  title: $t("panel-damage-rules.characters.herta.text_7934e2a5dd"),
  cons: 6,
  data: {
    atkPct: 25
  }
}]

export const createdBy = 'Aluxes'
