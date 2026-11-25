import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.the-herta.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.the-herta.text_aa10a3aec3"),
  params: { Enhanced_Skill: true },
  dmg: ({ talent, cons }, dmg) => {
    let num = cons < 1 ? 42 : 63
    let primaryDmg = dmg(talent.e2!['技能伤害']! * 3 + talent.e2!['所有目标伤害']! + talent.t!['主目标每层倍率']! * 2 * num, 'e')
    return {
      dmg: primaryDmg.dmg,
      avg: primaryDmg.avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.the-herta.text_b6a5fc7f30"),
  params: { Ultimate: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.the-herta.text_e6019d5e16"),
  params: { Ultimate: true },
  cons: 6,
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']! + 400 / 100, 'q')
}, {
  title: $t("panel-damage-rules.characters.the-herta.text_761db823f1"),
  params: { Ultimate: true },
  cons: 6,
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']! + 140 / 100, 'q')
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [ {
  check: ({ params }) => params.Enhanced_Skill === true,
  title: $t("panel-damage-rules.characters.the-herta.text_62561d40cf"),
  tree: 1,
  data: {
    dmg: 50
  }
}, {
  title: $t("panel-damage-rules.characters.the-herta.text_0d1232df1f"),
  tree: 2,
  data: {
    cdmg: 80
  }
}, {
  check: ({ params }) => params.Ultimate === true,
  title: $t("panel-damage-rules.characters.the-herta.text_0bcdeb8e18"),
  tree: 3,
  data: {
    qPct: 99
  }
}, {
  title: $t("panel-damage-rules.characters.the-herta.text_185a86e37e"),
  data: {
    atkPct: ({ talent }) => talent.q!['攻击力提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.the-herta.text_85d02c9a13"),
  cons: 6,
  data: {
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.the-herta.text_08cd8017cf")
