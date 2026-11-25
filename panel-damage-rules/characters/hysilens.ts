import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const createdBy = $t("panel-damage-rules.characters.hysilens.text_e1b743d657")
export const defDmgIdx = 3
export const mainAttr = "atk,speed,effPct"
export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.hysilens.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!["技能伤害"]!, "a"),
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!["技能伤害"]!, "e"),
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_d2f095bfae"),
  dmg: ({ talent }, dmg) => dmg(talent.q!["技能伤害"]!, "q"),
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_9d3a13d4bd"),
  params: { isDot: true },
  dmg: ({ talent, attr, cons, calc }, { basic }) => {
    let other = basic((cons>0 ? 6 : 3) * talent.t!['持续伤害']! * calc(attr.atk!),'dot','skillDot',{ dynamicDmg: -attr.staticAttr!.dmg!.plus })
    let phy = basic((cons>0 ? 2 : 1) * talent.t!['持续伤害上限']! * calc(attr.atk!),'dot','skillDot')
    let td = talent.q!['持续伤害']! + (cons===6 ? 0.2 : 0)
    let trig = basic((cons===6 ? 12 : (cons>0 ? 8 : 5)) * td * calc(attr.atk!), 'dot', 'skillDot')
    return {avg: other.avg + phy.avg + trig.avg}
  },
}, {
  check: ({ trees }) => trees['102'] === true,
  title: $t("panel-damage-rules.characters.hysilens.text_93eb1d6cef"),
  params: { isDot: true, Ultimate: true },
  dmg: ({ talent, attr, cons, calc }, { basic }) => {
    let other = basic((cons>0 ? 6 : 3) * talent.t!['持续伤害']! * calc(attr.atk!),'dot','skillDot',{ dynamicDmg: -attr.staticAttr!.dmg!.plus })
    let phy = basic((cons>0 ? 2 : 1) * talent.t!['持续伤害上限']! * calc(attr.atk!),'dot','skillDot')
    let td = talent.q!['持续伤害']! + (cons===6 ? 0.2 : 0)
    let trig = basic((cons===6 ? 12 : (cons>0 ? 8 : 5)) * td * calc(attr.atk!), 'dot', 'skillDot')
    return {avg: 1.5*(other.avg + phy.avg + trig.avg)}
  },
},]
export const buffs: Buff[] = [{
  check: ({ attr, calc }) => calc(attr.effPct!) > 75,
  title: $t("panel-damage-rules.characters.hysilens.text_159336835c"),
  data: {
    atkPct: 100,
  },
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_39bfe80331"),
  data: {
    Enemydmg: ({ talent }) => talent.e!["受到的伤害提高"]! * 100,
  },
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_64f648d78c"),
  data: {
    enemyDef: ({ talent }) => talent.q!["防御力降低"]! * 100,
  },
}, {
  check: ({ params }) => params.Ultimate === true,
  title: $t("panel-damage-rules.characters.hysilens.text_3d59082451"),
  tree: 2,
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_84aaeda8e1"),
  tree: 3,
  data: {
    dmg: ({ attr, calc }) => Math.floor(Math.max(0, calc(attr.effPct!)-60)/10) * 15,
  },
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_638fd2b286"),
  cons: 1,
  data: {
    multi: 16,
  },
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_adfdfd4c6c"),
  cons: 4,
  data: {
    kx: 20,
  },
}, {
  title: $t("panel-damage-rules.characters.hysilens.text_14259621b9"),
  cons: 6,
},]
