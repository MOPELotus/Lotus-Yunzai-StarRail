import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.pearl.text_44724be659"),
  dmg: ({ talent, attr, calc }, { heal }) => heal(calc(attr.def!) * talent.e!['治疗·百分比生命']! + talent.e!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.pearl.text_1ab830891b"),
  dmg: ({ talent, attr, calc }, { heal }) => heal(calc(attr.def!) * talent.a2!['治疗·百分比生命']! + talent.a2!['治疗·固定值']!)
}]

export const defDmgIdx = 1
export const defParams = { certifiedBanger: 50 }
export const mainAttr = 'def,heal,effDef,speed'
export const createdBy = $t("panel-damage-rules.characters.pearl.text_7ad80046cc")

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.pearl.text_051bd35646"),
  tree: 1,
  data: {
    joy: ({ attr }) => attr.def! >= 2400 ? 32 + Math.floor(Math.min(attr.def! - 2400, 3600)) / 10 * 3 : 0,
    heal: ({ attr }) => attr.joy! * 0.2
  }
}, {
  title: $t("panel-damage-rules.characters.pearl.text_76c960e299"),
  data: {
    punchline: ({ params }) => params.punchline
  }
}, {
  title: $t("panel-damage-rules.characters.pearl.text_e00723bd3e"),
  cons: 1,
  data: {
    joy: 60
  }
}, {
  title: $t("panel-damage-rules.characters.pearl.text_c0f102f746"),
  cons: 2,
  data: {
    merrymakes: 15
  }
}, {
  title: $t("panel-damage-rules.characters.pearl.text_61382d697b"),
  cons: 6,
  data: {
    kx: 20
  }
}]
