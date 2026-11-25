import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    '「我」的诞生': [
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.erudition.text_a3a60ec2c0"),
          data: {
            tDmg: tables[1]! + tables[2]!
          }
        }
      }
    ],
    今日亦是和平的一日: (tables) => {
      return {
        title: $t("panel-damage-rules.weapons.erudition.text_8cf9a994d0"),
        data: {
          dmg: ({ attr }) => tables[1]! * Math.min(attr.sp!, 160)
        }
      }
    },
    别让世界静下来: [
      staticIdx(1, 'recharge'),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_252192ad3f"), 'qDmg', 2)
    ],
    天才们的休憩: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_2e6bbcd8c6"), 'cdmg', 2)
    ],
    拂晓之前: [
      staticIdx(1, 'cdmg'),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_8961929fd6"), { eDmg: 2, qDmg: 2, tDmg: 3 })
    ],
    早餐的仪式感: [
      staticIdx(1, 'dmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.erudition.text_28649b96f0"),
          data: {
            atkPct: tables[2]! * 3
          }
        }
      }
    ],
    智库: [
      keyIdx($t("panel-damage-rules.weapons.erudition.text_cd001069ef"), 'qDmg', 1)
    ],
    灵钥: [],
    睿见: [
      keyIdx($t("panel-damage-rules.weapons.erudition.text_d488bd6cfd"), 'atkPct', 1)
    ],
    银河铁道之夜: [
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.erudition.text_28a9fe191a"),
          data: {
            atkPct: tables[1]! * 3,
            dmg: tables[2]!
          }
        }
      }
    ],
    '片刻，留在眼底': [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.erudition.text_3e24bb40c9"),
          data: {
            qDmg: ({ attr }) => tables[2]! * Math.min(attr.sp!, 180)
          }
        }
      }
    ],
    银河沦陷日: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_492b532b25"), 'cdmg', 2)
    ],
    谐乐静默之后: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_e31def25f7"), 'speedPct', 2)
    ],
    不息的演算: [
      staticIdx(1, 'atkPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.erudition.text_aff73ef76c"),
          data: {
            atkPct: tables[2]! * 5,
            speedPct: tables[3]!
          }
        }
      }
    ],
    偏偏希望无价: [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          check: ({ attr }) => attr.cdmg! > 120,
          title: $t("panel-damage-rules.weapons.erudition.text_9ff070042c"),
          sort: 9,
          data: {
            tDmg: ({ attr }) => Math.min(Math.floor((attr.cdmg! - 120) / 20), 4) * tables[2]!,
            qIgnore: tables[3]!,
            tIgnore: tables[3]!
          }
        }
      }
    ],
    '忍法帖•缭乱破魔': [
      staticIdx(1, 'stance')
    ],
    向着不可追问处: [
      staticIdx(1, 'cpct'),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_44b4b477bb"), { eDmg: 2, qDmg: 2 })
    ],
    宇宙大生意: [
      staticIdx(1, 'atkPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.erudition.text_f22d04e139"),
          data: {
            dmg: tables[2]! * 7
          }
        }
      }
    ],
    生命当付之一炬: [
      keyIdx($t("panel-damage-rules.weapons.erudition.text_a5ae66ae03"), { dmg: 1, enemyDef: 2 })
    ],
    氤氲麦香的梦: [
      staticIdx(1, "cpct"),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_53344fa460"), { qDmg: 2, tDmg: 2 })
    ],
    当一颗星照亮夜空: [
      keyIdx($t("panel-damage-rules.weapons.erudition.text_4fac1fcb44"), { ignore: 2}),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.erudition.text_eb28397703"),
          data: {
            tDmg: tables[2]! * 3,
            qDmg: tables[3]! * 3
          }
        }
      }
    ],
    星火悄然闪耀: [
      staticIdx(1, "cpct"),
      keyIdx($t("panel-damage-rules.weapons.erudition.text_624efbca71"), { ignore: 2, eDmg: 2 })
    ]
  }
}
