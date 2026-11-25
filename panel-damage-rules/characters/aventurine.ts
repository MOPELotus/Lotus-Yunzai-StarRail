import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff, Rule } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.aventurine.text_a900baa1d0"),
  dmg: ({ talent, attr }, { basic }) => basic(talent.a!['技能伤害']! * attr.def!, 'a')
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_9953377f67"),
  dmg: ({ talent, attr }, { shield }) => shield(talent.e!['防御力百分比']! * attr.def! + talent.e!['固定值']!)
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_b6a5fc7f30"),
  dmg: ({ talent, attr }, { basic }) => basic(talent.q!['技能伤害']! * attr.def!, 'q')
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_3c62b8771b"),
  dmg: ({ talent, attr, cons }, { basic }) => {
    let count = cons < 4 ? 7 : 10
    let td = talent.t!['每段伤害']! * count
    return basic(td * attr.def!, 't')
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_8db74ef7f6"),
  dmg: ({ attr }, { shield }) => shield(attr.def! * 0.07 + 96)
}]

export const mainAttr = 'cpct,cdmg,def'
export const defDmgIdx = 1
export const defParams: NonNullable<Rule["defParams"]> = ({ cons }) => cons < 4 ? { tArtisBuffCount: 4 } : { tArtisBuffCount: 5.5 }

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.aventurine.text_a44c30700c"),
  data: {
    cdmg: ({ talent }) => talent.q!['暴击伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_ac358fde96"),
  data: {
    effDef: ({ talent }) => talent.t!['效果抵抗提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_edac702486"),
  tree: 2,
  sort: 9,
  data: {
    cpct: ({ attr }) => attr.def! <= 1600 ? 0 : Math.min(Math.floor((attr.def! - 1600) / 100) * 2, 48)
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_a17edc57eb"),
  cons: 1,
  data: {
    cdmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_cf1d23da35"),
  cons: 2,
  data: {
    kx: 12
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_e2be6348db"),
  cons: 4,
  data: {
    defPct: 40
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine.text_b0456c0fd7"),
  cons: 6,
  data: {
    dmg: 150
  }
}]

export const createdBy = 'Aluxes'
