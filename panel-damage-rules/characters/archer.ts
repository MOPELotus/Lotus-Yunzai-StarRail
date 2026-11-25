import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.archer.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.archer.text_3896b19be0"),
  dmg: ({ talent }, dmg) => {
    let ret1 = dmg(talent.e!['技能伤害']!, 'e')
    let ret2 = dmg(talent.e!['技能伤害']!, 'e', false, 0, 'talent', { dynamicDmg: talent.e!['战技伤害提高']! * 100 })
    let ret3 = dmg(talent.e!['技能伤害']!, 'e', false, 0, 'talent', { dynamicDmg: talent.e!['战技伤害提高']! * 100 })
    return {
      dmg: ret1.dmg! + ret2.dmg! + ret3.dmg! * 3,
      avg: ret1.avg + ret2.avg + ret3.avg * 3,
    }
  }
}, {
  title: $t("panel-damage-rules.characters.archer.text_b6a5fc7f30"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.archer.text_de6842a3c3"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']!, 't')
}]

export const defDmgIdx = 2
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.archer.text_7525548d99"),
  tree: 2,
  data: {
    cdmg: 60
  }
}, {
  title: $t("panel-damage-rules.characters.archer.text_f87542bdeb"),
  cons: 2,
  data: {
    kx: 20
  }
}, {
  title: $t("panel-damage-rules.characters.archer.text_96991c4b1c"),
  cons: 4,
  data: {
    qDmg: 150
  }
}, {
  check: ({ params }) => params.cons6 === true,
  title: $t("panel-damage-rules.characters.archer.text_08f1fd7b0f"),
  cons: 6,
  data: {
    ignore: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.archer.text_08cd8017cf")
