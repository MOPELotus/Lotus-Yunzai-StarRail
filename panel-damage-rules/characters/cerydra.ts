import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const createdBy = $t("panel-damage-rules.characters.cerydra.text_645a5284b2")
export const mainAttr = 'atk,cdmg,speed'
export const defDmgIdx = 2

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.cerydra.text_6d230c9e61"),
  dmg: () => {
    return { note: $t("panel-damage-rules.characters.cerydra.text_0497285012") }
  }
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!,'a')
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_b6a5fc7f30"),
  dmgKey: 'MARK',
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!,'q')
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_81891586ea"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['附加伤害']!,'t')
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_46b15dda2a"),
  dmg: ({ talent, calc, attr }) => {
    const avg = Math.floor(calc(attr.atk!) * talent.t!['攻击力']!)
    return { avg, display: $t("panel-damage-rules.characters.cerydra.text_35aed71258", { "avg": avg }), metric: 'support' }
  }
},]

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.cerydra.text_117bb6f67f"),
  tree: 1,
  data: {
    cdmg: ({ calc, attr }) => 18 * Math.min(Math.floor(Math.max(calc(attr.atk!) - 2000, 0) / 100), 20),
    }
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_f829fd3f75"),
  tree: 2,
  data: {
    cpct: 100,
  }
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_59220d5351"),
  tree: 3,
  data: {
    speedPlus: 20,
  }
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_6281fb6184"),
  cons: 2,
  data: {
    dmg: 160,
  }
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_0819c7145b"),
  cons: 4,
  data: {
    qPct: 240,
  }
}, {
  title: $t("panel-damage-rules.characters.cerydra.text_5428e24caf"),
  cons: 6,
  data: {
    tPct: 300,
    kx: 20,
  }
},]
