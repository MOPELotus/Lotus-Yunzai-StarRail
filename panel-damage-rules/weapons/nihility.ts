import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    以世界之名: [
      keyIdx($t("panel-damage-rules.weapons.nihility.text_8529a3cd73"), { dmg: 1, atkPct: 3 })
    ],
    决心如汗珠般闪耀: [
      keyIdx($t("panel-damage-rules.weapons.nihility.text_a80e88a1ad"), 'enemyDef', 2)
    ],
    匿影: [],
    后会有期: [],
    幽邃: [
      keyIdx($t("panel-damage-rules.weapons.nihility.text_ff0d7f63c1"), 'effPct', 1)
    ],
    延长记号: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_a77bd2d791"), 'dmg', 2)
    ],
    晚安与睡颜: [
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_e3f4fe9d38"),
          data: {
            dmg: tables[1]! * 3
          }
        }
      }
    ],
    渊环: [
      keyIdx($t("panel-damage-rules.weapons.nihility.text_1c28b165fe"), 'dmg', 1)
    ],
    猎物的视线: [
      staticIdx(1, 'effPct')
    ],
    新手任务开始前: [
      staticIdx(1, 'effPct')
    ],
    雨一直下: [
      staticIdx(1, 'effPct'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_cb6d799b8a"), 'cpct', 2),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_da02b532a1"), 'dmg', 3)
    ],
    只需等待: [
      staticIdx(1, 'dmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_47b65456c6"),
          data: {
            speedPct: tables[2]! * 3
          }
        }
      }
    ],
    孤独的疗愈: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_efa6b60e4b"), 'dotDmg', 2)
    ],
    重塑时光之忆: [
      staticIdx(1, 'effPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_005a4d7afd"),
          data: {
            atkPct: tables[2]! * 4,
            dotIgnore: tables[3]! * 4
          }
        }
      }
    ],
    好戏开演: [
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_81dc6604fd"),
          data: {
            dmg: tables[1]! * 3
          }
        }
      },
      (tables) => {
        return {
          check: ({ attr, calc }) => calc(attr.effPct!) >= 80,
          title: $t("panel-damage-rules.weapons.nihility.text_01ce0ba4cf"),
          data: {
            atkPct: tables[2]!
          }
        }
      }
    ],
    行于流逝的岸: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_f8a2e9e7cc"),
          data: {
            dmg: tables[2]!,
            qDmg: tables[3]!
          }
        }
      }
    ],
    无边曼舞: [
      staticIdx(1, 'cpct'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_363039cf0e"), 'cdmg', 2)
    ],
    那无数个春天: [
      staticIdx(1, 'effPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_23bbbb7627"),
          data: {
            enemydmg: tables[2]! + tables[3]!
          }
        }
      }
    ],
    长路终有归途: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_ef236f7799"), 'breakEnemydmg', 2)
    ],
    谎言在风中飘扬: [
      staticIdx(1, 'speedPct'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_3ef6ecdbd3"), 'enemyDef', 2),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_a80f3ecbb5"),
          check: ({ attr, calc }) => calc(attr.speed!) >= 170,
          data: {
            enemyDef: tables[3]!
          }
        }
      }
    ],
    海洋为何而歌: [
      staticIdx(1, 'effPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_c410aa64ba"),
          data: {
            dotEnemydmg: tables[2]! * 6,
            speedPct: tables[3]!
          }
        }
      }
    ],
    假日浴场大冒险: [
      staticIdx(1, 'dmg'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_741866da45"), 'enemydmg', 2)
    ],
    勿忘她的火焰: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.nihility.text_7d34772c3a"), 'breakEnemydmg', 2)
    ],
    灼尽炼狱的新骸: [
      staticIdx(1, 'hpPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.nihility.text_cca0eed615"),
          data: {
            cdmgName: tables[2]!,
            _extraCdmg: tables[2]!,
            cdmg: tables[2]! * 2
          }
        }
      }
    ]
  }
}
