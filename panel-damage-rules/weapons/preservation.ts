import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    余生的第一天: [
      staticIdx(1, 'defPct')
    ],
    制胜的瞬间: [
      staticIdx(1, 'defPct'),
      staticIdx(2, 'effPct'),
      keyIdx($t("panel-damage-rules.weapons.preservation.text_3fd22073f1"), 'defPct', 3)
    ],
    宇宙市场趋势: [
      staticIdx(1, 'defPct')
    ],
    开疆: [],
    戍御: [],
    我们是地火: [],
    朗道的选择: [],
    琥珀: [
      staticIdx(1, 'defPct'),
      keyIdx($t("panel-damage-rules.weapons.preservation.text_1a7b9bac7a"), 'defPct', 2)
    ],
    记忆的质料: [
      staticIdx(1, 'effDef')
    ],
    '这就是我啦！': [
      staticIdx(1, 'defPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.preservation.text_e0c192e391"),
          data: {
            qInc: ({ calc, attr }) => calc(attr.def!) * tables[2]! / 100
          }
        }
      }
    ],
    她已闭上双眼: [
      staticIdx(1, 'hpPct'),
      staticIdx(2, 'recharge'),
      keyIdx($t("panel-damage-rules.weapons.preservation.text_a4cf254dd5"), 'dmg', 3)
    ],
    织造命运之线: [
      staticIdx(1, 'effDef'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.preservation.text_2549ddc39b"),
          data: {
            dmg: ({ calc, attr }) => Math.min(calc(attr.def!) * tables[2]! / 100, 32)
          }
        }
      }
    ],
    命运从未公平: [
      staticIdx(1, 'defPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.preservation.text_2fd5c75f2f"),
          data: {
            cdmg: tables[2]!,
            enemydmg: tables[4]!
          }
        }
      }
    ],
    两个人的演唱会: [
      staticIdx(1, 'defPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.preservation.text_8affb44ca5"),
          data: {
            dmg: tables[2]! * 4
          }
        }
      }
    ],
    愿旅途永远坦然: [
      keyIdx($t("panel-damage-rules.weapons.preservation.text_aba3c5bd19"), 'dmg', 2)
    ],
    纵然山河万程: [
      staticIdx(1, 'atkPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.preservation.text_716c31cbce"),
          data: {
            dmg: tables[4]!
          }
        }
      }
    ]
  }
}
