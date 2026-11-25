import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

// 强化战技 主目标3削韧，副目标1.5削韧

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_0882b21a9d"),
  params: { q: true },
  dmg: ({ talent, attr }, dmg) => {
    let td = talent.e2!['目标伤害']! + Math.min(attr.stance! * 0.2, 72) / 100
    return dmg(td, 'e')
  }
}, {
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_35498b7fd3"),
  params: { q: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let td = talent.e2!['目标伤害']! + Math.min(attr.stance! * 0.2, 72) / 100
    let atkDmg = dmg(td, 'e')
    let cost = 3 * (1 + 0.5 + (cons >= 6 ? 0.5 : 0))
    let base = 0
    if (attr.stance! >= 300) {
      base = 1.5
    } else if (attr.stance! >= 150) {
      base = 1
    }
    let superBreak = dmg.reaction('superBreak').avg / 0.9 * cost * base
    return {
      dmg: atkDmg.dmg! + superBreak,
      avg: atkDmg.avg + superBreak
    }
  }
}, {
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_a74bb45059"),
  params: { q: true },
  dmg: ({ talent, attr, cons }, dmg) => {
    let td = talent.e2!['相邻目标伤害']! + Math.min(attr.stance! * 0.1, 36) / 100
    let atkDmg = dmg(td, 'e')
    let cost = 1.5 * (1 + 0.5 + (cons >= 6 ? 0.5 : 0))
    let base = 0
    if (attr.stance! >= 300) {
      base = 1.5
    } else if (attr.stance! >= 150) {
      base = 1
    }
    let superBreak = dmg.reaction('superBreak').avg / 0.9 * cost * base
    return {
      dmg: atkDmg.dmg! + superBreak,
      avg: atkDmg.avg + superBreak
    }
  }
}]

export const mainAttr = 'atk,stance'
export const defDmgIdx = 1

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_161bfe9682"),
  check: ({ params }) => params.q === true,
  data: {
    speed: ({ talent }) => talent.q!['速度提高']!,
    breakEnemydmg: ({ talent }) => talent.q!['击破伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_d2d72252d8"),
  check: ({ params }) => params.q === true,
  tree: 1,
  data: {
    stance: 25
  }
}, {
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_6087b17212"),
  check: ({ params, attr }) => params.q === true && attr.atk! >= 1800,
  sort: 9,
  tree: 3,
  data: {
    stance: ({ attr }) => Math.floor((attr.atk! - 1800) / 10) * 0.8
  }
}, {
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_3141c6002e"),
  cons: 1,
  data: {
    ignore: 15
  }
}, {
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_af48438fe4"),
  cons: 4,
  check: ({ params }) => params.q === true,
  data: {
    effDef: 50
  }
}, {
  title: $t("panel-damage-rules.characters.firefly-enhanced.text_437ebd45a0"),
  cons: 6,
  check: ({ params }) => params.q === true,
  data: {
    kx: 20
  }
}]

export const createdBy = 'Aluxes'
