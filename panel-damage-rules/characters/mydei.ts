import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.mydei.text_a900baa1d0"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.mydei.text_ef9a46e334"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.mydei.text_f647479cc6"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.e!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.mydei.text_0d7ffad197"),
  dmg: ({ talent, calc, attr, cons }, { basic }) => {
    let num = cons > 0 ? 30 / 100 : 0
    let primaryDmg = basic(calc(attr.hp!) * (talent.e2!['技能伤害']! + num), 'e')
    return {
      dmg: primaryDmg.dmg,
      avg: primaryDmg.avg
    }
  }
}, {
  check: ({ cons }) => cons < 1,
  title: $t("panel-damage-rules.characters.mydei.text_76ca265960"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.e2!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.mydei.text_b6a5fc7f30"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 3
export const mainAttr = 'hp,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.mydei.text_7a33a1c2ed"),
  sort: 2,
  data: {
    hpPlus: ({ calc, attr }) => calc(attr.hp!) * 50 / 100
  }
}, {
  title: $t("panel-damage-rules.characters.mydei.text_e7c6fdda52"),
  tree: 3,
  data: {
    cpct: ({ calc, attr }) => {
      let num = Math.min(Math.floor(calc(attr.hp!) - 4000) / 100, 40)
      if (num > 0) {
        return num * 1.2
      } else {
        return 0
      }
    }
  }
}, {
  title: $t("panel-damage-rules.characters.mydei.text_cf058f3e90"),
  cons: 2,
  data: {
    ignore: 15
  }
}, {
  title: $t("panel-damage-rules.characters.mydei.text_f23afa5137"),
  cons: 4,
  data: {
    cdmg: 30
  }
}]

export const createdBy = $t("panel-damage-rules.characters.mydei.text_08cd8017cf")
