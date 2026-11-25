import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    一场术后对话: [
      staticIdx(1, 'recharge'),
      keyIdx($t("panel-damage-rules.weapons.abundance.text_c04800f25c"), 'qHeal', 2)
    ],
    同一种心情: [
      staticIdx(1, 'heal')
    ],
    嘉果: [],
    时节不居: [
      staticIdx(1, 'hpPct'),
      staticIdx(2, 'heal')
    ],
    暖夜不会漫长: [
      staticIdx(1, 'hpPct')
    ],
    此时恰好: [
      staticIdx(1, 'effDef'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.abundance.text_71413a236b"),
          data: {
            heal: ({ attr, calc }) => Math.min(tables[3]!, calc(attr.effDef!) * tables[2]! / 100)
          }
        }
      }
    ],
    物穰: [
      keyIdx($t("panel-damage-rules.weapons.abundance.text_d192d21f6b"), { eHeal: 1, qHeal: 1 })
    ],
    等价交换: [],
    蕃息: [],
    棺的回响: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.abundance.text_4a66e9567a"), 'speed', 3)
    ],
    '嘿，我在这儿': [
      staticIdx(1, 'hpPct'),
      keyIdx($t("panel-damage-rules.weapons.abundance.text_1db033064e"), 'heal', 2)
    ],
    惊魂夜: [
      staticIdx(1, 'recharge'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.abundance.text_001da3ceb6"),
          data: {
            atkPct: tables[3]! * 5
          }
        }
      }
    ],
    何物为真: [
      staticIdx(1, 'stance')
    ],
    唯有香如故: [
      staticIdx(1, 'stance'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.abundance.text_56fcdfbb3f"),
          sort: 9,
          data: {
            enemydmg: ({ attr, calc }) => calc(attr.stance!) >= 150 ? (tables[2]! + tables[3]!) : tables[2]!
          }
        }
      }
    ],
    梦的蒙太奇: [
      staticIdx(1, 'speedPct')
    ],
    直到明天的明天: [
      staticIdx(1, 'heal'),
      keyIdx($t("panel-damage-rules.weapons.abundance.text_e3d5971534"), 'dmg', 2)
    ]
  }
}
