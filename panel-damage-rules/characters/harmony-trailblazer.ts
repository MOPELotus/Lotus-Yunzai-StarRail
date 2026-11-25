import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

import { Format } from '../format.ts'

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_aef3538851"),
  dmg: ({ talent, cons }, dmg) => {
    let count = cons < 6 ? 5 : 7
    return dmg(talent.e!['技能伤害']! * count, 'e')
  }
}, {
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_daf719e52d"),
  dmg: ({ talent }) => {
    return {
      avg: Format.percent(talent.q!['击破特攻提高']!),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_65aa3d3c6a"),
  params: { q: true },
  cons: 4,
  dmg: ({ attr }) => {
    return {
      avg: Format.percent(attr.stance! / 100 * 0.15),
      type: 'text'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_51de53db91"),
  params: { q: true },
  dmg: ({ trees }, { reaction }) => {
    let extraDmg = trees['101'] ? 1.6 : 1
    return {
      avg: reaction('superBreak').avg / 0.9 * extraDmg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_410c28e0f7"),
  dmgKey: 'e',
  params: { q: true },
  dmg: ({ cons, trees }, { reaction }) => {
    let cost = (cons < 6 ? 3 : 4) + (trees['102'] ? 1 : 0)
    let extraDmg = trees['101'] ? 1.6 : 1
    return {
      avg: reaction('superBreak').avg / 0.9 * cost * extraDmg
    }
  }
}]

export const mainAttr = 'atk,stance'
export const defDmgKey = 'e'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_b23bfea281"),
  data: {
    stance: ({ talent }) => talent.q!['击破特攻提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_15a81e31f1"),
  tree: 1
}, {
  title: $t("panel-damage-rules.characters.harmony-trailblazer.text_0a1308028d"),
  cons: 6
}]

export const createdBy = 'Aluxes'
