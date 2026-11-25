import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.mortenax-blade.text_a900baa1d0"),
  dmg: ({ talent, attr, calc }, { basic }) => {
    const hp = calc(attr.hp!)
    const hpDmg = (talent.a!['技能伤害']!) * hp
    return basic(hpDmg, 'a')
  }
}, {
  title: $t("panel-damage-rules.characters.mortenax-blade.text_aef3538851"),
  params: { q: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const hp = calc(attr.hp!)
    const hpDmg = (talent.e!['技能伤害']! + talent.e!['弹射伤害']! * 4) * hp
    return basic(hpDmg, 'e')
  }
}, {
  title: $t("panel-damage-rules.characters.mortenax-blade.text_3c62b8771b"),
  params: { q: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const hp = calc(attr.hp!)
    const hpDmg = (talent.e!['技能伤害']! + talent.e!['弹射伤害']! * 4) * hp
    return basic(hpDmg, 't')
  }
}, {
  title: $t("panel-damage-rules.characters.mortenax-blade.text_b6a5fc7f30"),
  params: { q: true },
  dmg: ({ talent, attr, calc }, { basic }) => {
    const hp = calc(attr.hp!)
    const hpDmg = (talent.q2!['技能伤害']!) * hp
    return basic(hpDmg, 'q2')
  }
}]

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.mortenax-blade.text_b041eaf7bd"),
  data: {
    enemyDef: ({ talent }) => talent.q!['防御力降低']! * 100,
    enemydmg: ({ talent }) => talent.q!['易伤提高']! * 100,
    cdmg: ({ talent }) => talent.q!['暴击伤害提高']! * 100,
    cpct: 20
  }
}, {
  check: ({ params }) => params.q === true,
  title: $t("panel-damage-rules.characters.mortenax-blade.text_4ab02c1cb6"),
  tree: 3,
  data: {
    dmg: ({ cons }) => { return cons >= 4 ? 100 : 50 },
    q2Dmg: ({ cons }) => { return cons >= 4 ? 125 : 75 }
  }
}, {
  check: ({ params }) => params.q === true,
  title: $t("panel-damage-rules.characters.mortenax-blade.text_90b48579d8"),
  cons: 2,
  data: {
    kx: 20
  }
}, {
  title: $t("panel-damage-rules.characters.mortenax-blade.text_1006299ead"),
  cons: 2,
  data: {
    q2Dmg: 75,
    tDmg: 75
  }
}, {
  check: ({ params }) => params.q === true,
  title: $t("panel-damage-rules.characters.mortenax-blade.text_8b45ddfec0"),
  cons: 4,
  data: {
    dmg: 50
  }
}, {
  check: ({ params }) => params.q === true,
  title: $t("panel-damage-rules.characters.mortenax-blade.text_ab63f9caf1"),
  cons: 6,
  data: {
    qMulti: 150
  }
}]

export const defDmgIdx = 3
export const mainAttr = 'hp,cpct,cdmg,speed'
export const createdBy = $t("panel-damage-rules.characters.mortenax-blade.text_7ad80046cc")
