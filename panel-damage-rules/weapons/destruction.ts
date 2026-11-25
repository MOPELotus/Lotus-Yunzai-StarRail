import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    乐圮: [
      keyIdx($t("panel-damage-rules.weapons.destruction.text_6843ad053a"), 'dmg', 1)
    ],
    俱殁: [
      keyIdx($t("panel-damage-rules.weapons.destruction.text_7f7e7d251d"), 'cpct', 1)
    ],
    在蓝天下: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_02159a601d"), 'cpct', 2)
    ],
    天倾: [
      keyIdx($t("panel-damage-rules.weapons.destruction.text_7620c7bd55"), { aDmg: 1, eDmg: 1 })
    ],
    无可取代的东西: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_13b6824162"), 'dmg', 3)
    ],
    无处可逃: [
      staticIdx(1, 'atkPct')
    ],
    '汪！散步时间！': [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_584a904c3d"), 'dmg', 2)
    ],
    秘密誓心: [
      staticIdx(1, 'dmg'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_b47223a187"), 'dmg', 2)
    ],
    记一位星神的陨落: [(tables) => {
      return {
        title: $t("panel-damage-rules.weapons.destruction.text_1ad8f584cb"),
        data: {
          atkPct: tables[1]! * 4,
          dmg: tables[2]!
        }
      }
    }],
    鼹鼠党欢迎你: [(tables) => {
      return {
        title: $t("panel-damage-rules.weapons.destruction.text_69cd05cfd8"),
        data: {
          atkPct: tables[1]! * 3
        }
      }
    }],
    到不了的彼岸: [
      staticIdx(1, 'cpct'),
      staticIdx(2, 'hpPct'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_db63c10905"), 'dmg', 3)
    ],
    比阳光更明亮的: [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.destruction.text_85c862053f"),
          data: {
            atkPct: tables[2]! * 2,
            recharge: tables[3]! * 2
          }
        }
      }
    ],
    此身为剑: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.destruction.text_413d605c19"),
          data: {
            dmg: tables[2]! * 3,
            ignore: tables[3]!
          }
        }
      }
    ],
    在火的远处: [
      keyIdx($t("panel-damage-rules.weapons.destruction.text_9baf52f181"), 'dmg', 1)
    ],
    铭记于心的约定: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_ea0ed39535"), 'cpct', 2)
    ],
    梦应归于何处: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_ff8491ac35"), 'breakEnemydmg', 2)
    ],
    落日时起舞: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.destruction.text_b8aad68229"),
          data: {
            tDmg: tables[2]! * 2
          }
        }
      }
    ],
    '忍事录•音律狩猎': [
      staticIdx(1, 'hpPct'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_1555f1f41a"), 'cdmg', 2)
    ],
    '血火啊，燃烧前路': [
      staticIdx(1, 'hpPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.destruction.text_61be393cad"),
          data: {
            eDmg: ({ attr, calc }) => {
              return calc(attr.hp!) * tables[3]! / 100 > 500 ? tables[5]! + tables[4]! : tables[4]!
            },
            qDmg: ({ attr, calc }) => {
              return calc(attr.hp!) * tables[3]! / 100 > 500 ? tables[5]! + tables[4]! : tables[4]!
            }
          }
        }
      }
    ],
    黎明恰如此燃烧: [
      staticIdx(1, 'speed'),
      keyIdx($t("panel-damage-rules.weapons.destruction.text_4f1ad7148e"), 'ignore', 2),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.destruction.text_84339d1226"),
          data: {
            dmg: tables[3]!
          }
        }
      }
    ],
    没有回报的加冕: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.destruction.text_b039dc7f75"),
          data: {
            atkPct: tables[2]! + tables[3]!
          }
        }
      }
    ],
    一行往日的血: [
      keyIdx($t("panel-damage-rules.weapons.destruction.text_a9cf301f0d"), {
        cpct: 1, eDmg: 2, qDmg: 2
      })
    ],
    所见即我: [
      keyIdx($t("panel-damage-rules.weapons.destruction.text_d73231e266"), {
        atkPct: 1, recharge: 2
      }),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.destruction.text_6706092447"),
          data: {
            qDmg: ({ attr }) => {
              return attr.sp! >= 360 ? tables[4]! : tables[3]! * attr.sp!
            },
            cdmg: tables[5]!
          }
        }
      }
    ]
  }
}
