import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    花花世界迷人眼: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.elation.text_34854709cf"),
          data: {
            ignore: tables[2]! * 4,
            joy: tables[3]!
          }
        }
      }
    ],
    当她决定看见: [
      staticIdx(1, 'speedPct'),
      keyIdx($t("panel-damage-rules.weapons.elation.text_637893cfda"), {
        cpct: 2, cdmg: 3
      })
    ],
    今日好手气: [
      staticIdx(1, 'cpct')
    ],
    菇菇嘎嘎历险记: [
      staticIdx(1, 'joy'),
      keyIdx($t("panel-damage-rules.weapons.elation.text_19efba809a"), 'xeEnemydmg', 2)
    ],
    '未来，有我们一起': [
      staticIdx(1, 'cdmg'),
      keyIdx($t("panel-damage-rules.weapons.elation.text_f408cd5a10"), 'joy', 2)
    ],
    欢愉满溢祝福: [
      staticIdx(1, 'atkPct')
    ],
    欢迎来到银河城: [
      staticIdx(1, 'speedPct'),
      keyIdx($t("panel-damage-rules.weapons.elation.text_024093b29e"), {
        xeIgnore: 2, punchline: 3
      })
    ],
    邂逅于下一个花季: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.elation.text_24055cdeb6"),
          data: {
            recharge: ({ attr }) => tables[2]! + (Math.min(attr.sp!, 480) - 120) / 10 * 0.3
          }
        }
      },
      keyIdx($t("panel-damage-rules.weapons.elation.text_4c7ba86e39"), 'enemydmg', 3)
    ],
    放个短假: [
      staticIdx(1, 'joyPct'),
      keyIdx($t("panel-damage-rules.weapons.elation.text_72b5aaf7be"), 'xeIgnore', 2)
    ],
    向浪花掷下盛夏: [
      staticIdx(1, 'cpct'),
      keyIdx($t("panel-damage-rules.weapons.elation.text_1adc06fea1"), {
        speedPct: 2, joyPct: 3
      })
    ],
    献给明日的色彩: [
      staticIdx(1, 'defPct'),
      keyIdx($t("panel-damage-rules.weapons.elation.text_6b9891255d"), {
        enemydmg: 2
      })
    ],
    '在世界尽头相会吧！': [
      (tables) => ({
        title: $t("panel-damage-rules.weapons.elation.text_b062c61853"),
        check: ({ weaponTypeName }) => weaponTypeName === '欢愉',
        data: {
          cdmg: ({ params }) => tables[1]! * Math.max(1, Math.min(4, Math.trunc(Number(params.elationCount) || 1)))
        }
      }),
      (tables) => ({
        title: $t("panel-damage-rules.weapons.elation.text_52dd94584d"),
        check: ({ characterName, weaponTypeName, params }) => weaponTypeName === '欢愉' && (characterName === '星神★阿哈' || params.ahaInTeam === true),
        data: { cdmg: tables[2]! }
      })
    ],
    '当第一声「阿哈」响起': [
      // 基础速度参与所有速度百分比加成，不能记作固定速度或速度百分比。
      staticIdx(1, 'speedBase'),
      (tables) => ({
        title: $t("panel-damage-rules.weapons.elation.text_01a393921d"),
        check: ({ weaponTypeName, params }) => weaponTypeName === '欢愉' && params.ahaLightconeSkillTriggered !== false,
        data: { ignore: tables[4]! }
      })
    ],
    // The fixed catalog includes these items without personal solver effects.
    嗤笑: [],
    残泪: []
  }
}
