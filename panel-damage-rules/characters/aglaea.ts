import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.aglaea.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_cc28ea2fbc"),
  params: { Supreme_Stance: true, cons6_a2:true },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_c0cf586715"),
  params: { Supreme_Stance: true, cons6_a2:true },
  dmg: ({ talent }, dmg) => dmg(talent.a2!['相邻目标伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_6406d2e945"),
  params: { Supreme_Stance: true },
  dmg: ({ talent }, dmg) => dmg(talent.me!['技能伤害']!, 'me')
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_eeb6d0dac4"),
  params: { Supreme_Stance: true },
  dmg: ({ talent }, dmg) => dmg(talent.me!['相邻目标伤害']!, 'me')
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_8fe90a67bb"),
  params: { Supreme_Stance: true },
  dmg: ({ talent }, dmg) => dmg(talent.t!['附加伤害']!)
}]

export const defDmgIdx = 1
export const defParams = { Memosprite: true }
export const mainAttr = 'atk,cpct,cdmg,speed'

export const buffs: Buff[] = [ {
  check: ({ params }) => params.Supreme_Stance === true,
  title: $t("panel-damage-rules.characters.aglaea.text_3f6a99dbdb"),
  sort: 9,
  tree: 1,
  data: {
    atkPlus: ({ talent, attr, cons, calc }) => {
      let num = cons > 3 ? 7 : 6
      let plus = calc(attr.speed!) * (1 + talent.q!['速度提高']! * num) * 720 / 100 + (calc(attr.speed!) * 0.35 + talent.mt!['速度提高']! * num) * 360 / 100
      return plus
    }
  }
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_8ba3a5c01f"),
  cons: 1,
  data: {
    enemydmg: 15,
  }
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_b2f5c67c68"),
  cons: 2,
  data: {
    ignore: 42
  }
}, {
  title: $t("panel-damage-rules.characters.aglaea.text_c87453e2d9"),
  cons: 6,
  data: {
    kx: 20
  }
}, {
  check: ({ params }) => params.cons6_a2 === true,
  title: $t("panel-damage-rules.characters.aglaea.text_8414d34cb6"),
  cons: 6,
  data: {
    aDmg: 60
  }
}]

export const createdBy = $t("panel-damage-rules.characters.aglaea.text_08cd8017cf")
