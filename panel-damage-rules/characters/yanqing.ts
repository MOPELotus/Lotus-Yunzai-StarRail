import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.yanqing.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_3255f8ed04"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['追加攻击']!, 't')
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_81891586ea"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['回合附加伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}]

export const defDmgIdx = 4
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.yanqing.text_11f04f8f51"),
  data: {
    cpct: ({ talent }) => talent.t!['暴击率提高']! * 100,
    cdmg: ({ talent }) => talent.t!['爆伤提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_b316380e44"),
  data: {
    qCpct: 60,
    qCdmg: ({ talent }) => talent.q!['暴伤提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_44e173de4e"),
  cons: 4,
  data: {
    kx: 12
  }
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_9b2e99c605"),
  tree: 3,
  data: {
    speedPct: 10
  }
}, {
  title: $t("panel-damage-rules.characters.yanqing.text_9aa46d3adf"),
  tree: 1,
  data: {
    aPlus: ({ calc, attr }) => calc(attr.atk!) * 0.3,
    ePlus: ({ calc, attr }) => calc(attr.atk!) * 0.3,
    qPlus: ({ calc, attr }) => calc(attr.atk!) * 0.3,
    tPlus: ({ calc, attr }) => calc(attr.atk!) * 0.3
  }
}]
