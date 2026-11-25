import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_a900baa1d0"),
  dmg: ({ talent, cons }, dmg) => {
    // 2段伤害，比例3:7
    let dynamicDmg = cons >= 1 ? talent.t!['伤害提高']! * 100 * 2 : talent.t!['伤害提高']! * 100
    let a1dmg = dmg(talent.a!['技能伤害']! * 0.3, 'a')
    let a2dmg = dmg.dynamic(talent.a!['技能伤害']! * 0.7, 'a', { dynamicDmg })

    return {
      dmg: a1dmg.dmg! + a2dmg.dmg!,
      avg: a1dmg.avg + a2dmg.avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_886f3909eb"),
  dmg: ({ talent, cons }, dmg) => {
    // 3段伤害，比例33:33:34
    let dynamicDmg = cons >= 1 ? talent.t!['伤害提高']! * 100 * 2 : talent.t!['伤害提高']! * 100
    let a1dmg = dmg(talent.a2!['瞬华·单体伤害']! * 0.33, 'a')
    let a2dmg = dmg.dynamic(talent.a2!['瞬华·单体伤害']! * 0.33, 'a', { dynamicDmg })
    let a3dmg = dmg.dynamic(talent.a2!['瞬华·单体伤害']! * 0.34, 'a', { dynamicDmg: dynamicDmg * 2 })

    return {
      dmg: a1dmg.dmg! + a2dmg.dmg! + a3dmg.dmg!,
      avg: a1dmg.avg + a2dmg.avg + a3dmg.avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_f3e5d5715f"),
  dmg: ({ talent, cons }, dmg) => {
    // 主目标5段伤害，比例20:20:20:20:20
    // 副目标2段伤害，比例50:50
    let dynamicDmg = cons >= 1 ? talent.t!['伤害提高']! * 100 * 2 : talent.t!['伤害提高']! * 100
    let dynamicCdmg = talent.e!['暴击伤害提高']! * 100
    let a1dmg = dmg(talent.a2!['天矢阴·单体伤害']! * 0.2, 'a')
    let a2dmg = dmg.dynamic(talent.a2!['天矢阴·单体伤害']! * 0.2, 'a', { dynamicDmg })
    let a3dmg = dmg.dynamic(talent.a2!['天矢阴·单体伤害']! * 0.2, 'a', { dynamicDmg: dynamicDmg * 2 })
    let a4dmg = dmg.dynamic(talent.a2!['天矢阴·单体伤害']! * 0.2, 'a', { dynamicDmg: dynamicDmg * 3, dynamicCdmg })
    let a5dmg = dmg.dynamic(talent.a2!['天矢阴·单体伤害']! * 0.2, 'a', { dynamicDmg: dynamicDmg * 4, dynamicCdmg: dynamicCdmg * 2 })

    let a1plusdmg = dmg.dynamic(talent.a2!['天矢阴·相邻目标伤害']! * 0.5, 'a', { dynamicDmg: dynamicDmg * 3, dynamicCdmg })
    let a2plusdmg = dmg.dynamic(talent.a2!['天矢阴·相邻目标伤害']! * 0.5, 'a', { dynamicDmg: dynamicDmg * 4, dynamicCdmg: dynamicCdmg * 2 })

    return {
      dmg: a1dmg.dmg! + a2dmg.dmg! + a3dmg.dmg! + a4dmg.dmg! + a5dmg.dmg! + (a1plusdmg.dmg! + a2plusdmg.dmg!) * 2,
      avg: a1dmg.avg + a2dmg.avg + a3dmg.avg + a4dmg.avg + a5dmg.avg + (a1plusdmg.avg + a2plusdmg.avg) * 2
    }
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_c14afb8a18"),
  params: { level3A: true },
  dmg: ({ talent, cons }, dmg) => {
    // 主目标7段伤害，前六段比例14.2，最后一段14.8
    // 副目标4段伤害，比例25:25:25:25
    let dynamicDmg = cons >= 1 ? talent.t!['伤害提高']! * 100 * 2 : talent.t!['伤害提高']! * 100
    let dynamicCdmg = talent.e!['暴击伤害提高']! * 100
    let a1dmg = dmg(talent.a2!['盘拏耀跃·单体伤害']! * 0.142, 'a')
    let a2dmg = dmg.dynamic(talent.a2!['盘拏耀跃·单体伤害']! * 0.142, 'a', { dynamicDmg })
    let a3dmg = dmg.dynamic(talent.a2!['盘拏耀跃·单体伤害']! * 0.142, 'a', { dynamicDmg: dynamicDmg * 2 })
    let a4dmg = dmg.dynamic(talent.a2!['盘拏耀跃·单体伤害']! * 0.142, 'a', { dynamicDmg: dynamicDmg * 3, dynamicCdmg })
    let a5dmg = dmg.dynamic(talent.a2!['盘拏耀跃·单体伤害']! * 0.142, 'a', { dynamicDmg: dynamicDmg * 4, dynamicCdmg: dynamicCdmg * 2 })
    let a6dmg = dmg.dynamic(talent.a2!['盘拏耀跃·单体伤害']! * 0.142, 'a', { dynamicDmg: dynamicDmg * 5, dynamicCdmg: dynamicCdmg * 3 })

    let a1plusdmg = dmg.dynamic(talent.a2!['盘拏耀跃·相邻目标伤害']! * 0.25, 'a', { dynamicDmg: dynamicDmg * 3, dynamicCdmg })
    let a2plusdmg = dmg.dynamic(talent.a2!['盘拏耀跃·相邻目标伤害']! * 0.25, 'a', { dynamicDmg: dynamicDmg * 4, dynamicCdmg: dynamicCdmg * 2 })
    let a3plusdmg = dmg.dynamic(talent.a2!['盘拏耀跃·相邻目标伤害']! * 0.25, 'a', { dynamicDmg: dynamicDmg * 5, dynamicCdmg: dynamicCdmg * 3 })

    dynamicDmg = cons >= 1 ? talent.t!['伤害提高']! * 100 * 10 : talent.t!['伤害提高']! * 100 * 6
    let a7dmg = dmg.dynamic(talent.a2!['盘拏耀跃·单体伤害']! * 0.148, 'a', { dynamicDmg, dynamicCdmg: dynamicCdmg * 4 })
    let a4plusdmg = dmg.dynamic(talent.a2!['盘拏耀跃·相邻目标伤害']! * 0.25, 'a', { dynamicDmg, dynamicCdmg: dynamicCdmg * 4 })

    return {
      dmg: a1dmg.dmg! + a2dmg.dmg! + a3dmg.dmg! + a4dmg.dmg! + a5dmg.dmg! + a6dmg.dmg! + a7dmg.dmg! + (a1plusdmg.dmg! + a2plusdmg.dmg! + a3plusdmg.dmg! + a4plusdmg.dmg!) * 2,
      avg: a1dmg.avg + a2dmg.avg + a3dmg.avg + a4dmg.avg + a5dmg.avg + a6dmg.avg + a7dmg.avg + (a1plusdmg.avg + a2plusdmg.avg + a3plusdmg.avg + a4plusdmg.avg) * 2
    }
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_a8b5ec058a"),
  dmg: ({ talent, cons }, dmg) => {
    // 3段伤害，比例3:3:4
    let dynamicDmg = cons >= 1 ? talent.t!['伤害提高']! * 100 * 2 : talent.t!['伤害提高']! * 100
    let a1dmg = dmg(talent.q!['目标伤害']! * 0.3, 'q')
    let a2dmg = dmg.dynamic(talent.q!['目标伤害']! * 0.3, 'q', { dynamicDmg })
    let a3dmg = dmg.dynamic(talent.q!['目标伤害']! * 0.4, 'q', { dynamicDmg: dynamicDmg * 2 })

    let a1plusdmg = dmg(talent.q!['相邻目标伤害']! * 0.3, 'q')
    let a2plusdmg = dmg.dynamic(talent.q!['相邻目标伤害']! * 0.3, 'q', { dynamicDmg })
    let a3plusdmg = dmg.dynamic(talent.q!['相邻目标伤害']! * 0.4, 'q', { dynamicDmg: dynamicDmg * 2 })

    return {
      dmg: a1dmg.dmg! + a2dmg.dmg! + a3dmg.dmg! + (a1plusdmg.dmg! + a2plusdmg.dmg! + a3plusdmg.dmg!) * 2,
      avg: a1dmg.avg + a2dmg.avg + a3dmg.avg + (a1plusdmg.avg + a2plusdmg.avg + a3plusdmg.avg) * 2
    }
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_b7aac5e6a9"),
  check: ({ exCons }) => !!exCons,
  dmg: ({ cons }, dmg) => {
    // 6段攻击全体500%攻击力，视为普攻伤害
    return dmg(5.0, 'a')
  }
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_fca9c14564"),
  check: ({ exCons }) => !!exCons,
  data: {
    dmg: 240
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_4572426354"),
  tree: 3,
  data: {
    cdmg: 24
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_ac27de7c10"),
  check: ({ cons }) => cons < 1,
  data: {
    _dmg: ({ talent }) => talent.t!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_c3b87e243b"),
  cons: 1,
  data: {
    _dmg: ({ talent }) => talent.t!['伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_c61c373e67"),
  data: {
    _cdmg: ({ talent }) => talent.e!['暴击伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.imbibitor-lunae.text_fad66efe0b"),
  cons: 6,
  check: ({ params }) => params.level3A === true,
  data: {
    kx: 60
  }
}]

export const createdBy = 'Aluxes'
