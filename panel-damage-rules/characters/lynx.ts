import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.lynx.text_a900baa1d0"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(talent.a!['技能伤害']! * calc(attr.hp!), 'a')
}, {
  title: $t("panel-damage-rules.characters.lynx.text_789e7606e1"),
  dmg: ({ talent, calc, attr, cons }) => {
    const c6Plus = cons >= 6 ? 0.06 : 0
    const hpPctData = talent.e!['生命提高·百分比生命']! + c6Plus
    return {
      avg: calc(attr.hp!) * hpPctData + talent.e!['生命提高·固定值']!,
      metric: 'support'
    }
  }
}, {
  title: $t("panel-damage-rules.characters.lynx.text_f9bc6007f7"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.e!['治疗·百分比']! + talent.e!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.lynx.text_daafe329e2"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.q!['治疗·百分比生命']! + talent.q!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.lynx.text_8f77dd693c"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.t!['治疗·百分比生命']! + talent.t!['治疗·固定值']!)
}, {
  title: $t("panel-damage-rules.characters.lynx.text_0d6c71ab3b"),
  dmg: ({ talent, calc, attr }, { heal }) => heal(calc(attr.hp!) * talent.t!['额外治疗·百分比生命']! + talent.t!['额外治疗·固定值']!)
}]

export const mainAttr = 'cpct,cdmg,hp'
export const defDmgIdx = 2

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.lynx.text_624ae257d8"),
  cons: 1,
  data: {
    heal: 20
  }
}, {
  title: $t("panel-damage-rules.characters.lynx.text_996ce2e402"),
  cons: 6,
  data: {
    _hpPlus: ({ calc, attr }) => calc(attr.hp!) * 0.06
  }
}]

export const createdBy = 'Aluxes'
