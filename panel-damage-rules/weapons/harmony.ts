import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    与行星相会: [],
    但战斗还未结束: [
      staticIdx(1, 'recharge')
    ],
    '舞！舞！舞！': [],
    记忆中的模样: [
      staticIdx(1, 'stance')
    ],
    调和: [
      keyIdx($t("panel-damage-rules.weapons.harmony.text_9fc8b25d81"), 'speed', 1)
    ],
    轮契: [],
    过往未来: [],
    镂月裁云之意: [
      keyIdx($t("panel-damage-rules.weapons.harmony.text_bd68aaad42"), 'atkPct', 1)
    ],
    齐颂: [
      keyIdx($t("panel-damage-rules.weapons.harmony.text_3f2ecbe155"), 'atkPct', 1)
    ],
    镜中故我: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.harmony.text_2bda1b049a"), 'dmg', 2)
    ],
    游戏尘寰: [
      staticIdx(1, 'cdmg')
    ],
    美梦小镇大冒险: [
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.harmony.text_043714337a"),
          data: {
            _dmg: tables[1]!,
            aDmg: tables[1]!,
            eDmg: tables[1]!,
            qDmg: tables[1]!
          }
        }
      }
    ],
    为了明日的旅途: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.harmony.text_7769a97c6b"), 'dmg', 2)
    ],
    夜色流光溢彩: [
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.harmony.text_3a1b7055aa"),
          data: {
            recharge: tables[1]! * 5,
            atkPct: tables[2]!,
            dmg: tables[3]!
          }
        }
      }
    ],
    芳华待灼: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.harmony.text_984d60ec83"), 'cdmg', 2)
    ],
    如果时间是一朵花: [
      staticIdx(1, 'cdmg'),
      keyIdx($t("panel-damage-rules.weapons.harmony.text_9bf0537d35"), 'cdmg', 2)
    ],
    永远的迷境饭: [
      staticIdx(1, 'atkPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.harmony.text_838bf4c703"),
          data: {
            atkPct: tables[2]! * 3
          }
        }
      }
    ],
    金血铭刻的时代: [staticIdx(1, 'atkPct')],
    // The original catalog has these cones, but the personal damage engine has no effect definitions for them.
    追逐风的时候: [],
    回到大地的飞行: []
  }
}
