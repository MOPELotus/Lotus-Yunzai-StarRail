import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.tribbie.text_a900baa1d0"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_de6842a3c3"),
  params: { cons6: true },
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.t!['追加攻击伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_b6a5fc7f30"),
  dmg: ({ talent, calc, attr }, { basic }) => basic(calc(attr.hp!) * talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_f8909347ca"),
  dmg: ({ talent, cons, calc, attr }, { basic }) => {
    let num = cons > 1 ? 1.2 : 1
    return basic(calc(attr.hp!) * talent.q!['附加伤害']! * num, 'q')
  }
}]

export const defDmgIdx = 1
export const mainAttr = 'hp,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.tribbie.text_acd151de16"),
  data: {
    kx: ({ talent }) => talent.e!['抗性穿透提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_11f6697b3f"),
  data: {
    enemydmg: ({ talent }) => talent.q!['受到的伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_8c4f4bc50f"),
  tree: 1,
  data: {
    dmg: 72 * 3
  }
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_6d57d5c6e5"),
  tree: 2,
  data: {
    hpPlus: ({ calc, attr }) => calc(attr.hp!) * 9 / 100
  }
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_f6f1b4c891"),
  cons: 4,
  data: {
    ignore: 18
  }
}, {
  title: $t("panel-damage-rules.characters.tribbie.text_dfe5f8f7c4"),
  cons: 6,
  data: {
    tDmg: 729
  }
}]

export const createdBy = $t("panel-damage-rules.characters.tribbie.text_08cd8017cf")
