import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.anaxa.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_7459091160"),
  params: { Skill_SingleTarget: true },
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_3993998d7f"),
  params: { Skill_MultipleTarget: true },
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [ {
  check: ({ params }) => params.Skill_SingleTarget === true,
  title: $t("panel-damage-rules.characters.anaxa.text_a5278532ca"),
  data: {
    dmg: 20
  }
}, {
  check: ({ params }) => params.Skill_MultipleTarget === true,
  title: $t("panel-damage-rules.characters.anaxa.text_5affd26f6f"),
  data: {
    dmg: 100
  }
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_63c680c3fb"),
  data: {
    dmg: ({ talent }) => talent.t!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_c5ed59cee9"),
  tree: 2,
  data: {
    dmg: 50
  }
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_4d4a8aec8c"),
  tree: 3,
  data: {
    ignore: 28
  }
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_14c2df0a0f"),
  cons: 1,
  data: {
    enemyDef: 16
  }
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_2f49424ff1"),
  cons: 2,
  data: {
    kx: 20
  }
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_2713c4761d"),
  cons: 4,
  data: {
    atkPct: 60
  }
}, {
  title: $t("panel-damage-rules.characters.anaxa.text_b2b839e6b1"),
  cons: 6,
  data: {
    multi: 30,
    cdmg: 140
  }
}]

export const createdBy = $t("panel-damage-rules.characters.anaxa.text_08cd8017cf")
