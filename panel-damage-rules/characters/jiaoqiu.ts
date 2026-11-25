import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.jiaoqiu.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_ef9a46e334"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_f647479cc6"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_de88c1d7d2"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['持续伤害']!, 'dot', 'skillDot')
}]

export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.jiaoqiu.text_515dd5c97b"),
  data: {
    qEnemydmg: ({ talent }) => talent.q!['终结技伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_7f0d0c8fc7"),
  data: {
    enemydmg: ({ talent, cons }) => {
      let num = cons < 6 ? 4 : 8
      return (talent.t!['1层伤害提高']! + talent.t!['叠加伤害提高']! * num) * 100
    }
  }
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_89826de49d"),
  tree: 2,
  data: {
    atkPct: ({ calc, attr }) => {
      let num = Math.min(Math.floor((calc(attr.effPct!) - 80) / 15), 4)
      if (num > 0) {
        return num * 60
      } else {
        return 0
      }
    }
  }
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_331134d6f9"),
  cons: 1,
  data: {
    dmg: 40
  }
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_2011c29010"),
  cons: 2,
  data: {
    dotPct: 300
  }
}, {
  title: $t("panel-damage-rules.characters.jiaoqiu.text_89d86a9f66"),
  cons: 6,
  data: {
    kx : 9 * 3
  }
}]

export const createdBy = $t("panel-damage-rules.characters.jiaoqiu.text_08cd8017cf")
