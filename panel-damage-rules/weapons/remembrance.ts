import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    溯忆: [(tables) => {
      return {
        title: $t("panel-damage-rules.weapons.remembrance.text_839821ce52"),
        data: {
          dmg: tables[1]! * 4
        }
      }
    }],
    焚影: [],
    '多流汗，少流泪': [
      staticIdx(1, 'cpct'),
      keyIdx($t("panel-damage-rules.weapons.remembrance.text_a522f03e05"), 'dmg', 2)
    ],
    天才们的问候: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.remembrance.text_38107e73cc"), 'aDmg', 2)
    ],
    胜利只在朝夕间: [
      staticIdx(1, 'cdmg'),
      keyIdx($t("panel-damage-rules.weapons.remembrance.text_a522f03e05"), 'dmg', 2)
    ],
    将光阴织成黄金: [
      staticIdx(1, 'speed'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.remembrance.text_9b49c636e8"),
          data: {
            cdmg: tables[2]! * 6,
            aDmg: tables[3]! * 6
          }
        }
      }
    ],
    记忆永不落幕: [
      staticIdx(1, 'speedPct'),
      keyIdx($t("panel-damage-rules.weapons.remembrance.text_0756f38e07"), 'dmg', 2)
    ],
    '让告别，更美一些': [
      staticIdx(1, 'hpPct'),
      keyIdx($t("panel-damage-rules.weapons.remembrance.text_4fac1fcb44"), 'ignore', 2)
    ],
    愿虹光永驻天空: [
      staticIdx(1, 'speedPct'),
      keyIdx($t("panel-damage-rules.weapons.remembrance.text_1014435b79"), 'enemydmg', 4)
    ],
    故事的下一页: [
      staticIdx(1, "hpPct"),
      (tables) => {
        return {
          check: ({ params }) => params.Memosprite,
          title: $t("panel-damage-rules.weapons.remembrance.text_719635d9b0"),
          data: {
            heal: tables[2]!
          }
        }
      }
    ],
    花儿不会忘记: [
      staticIdx(1, "cdmg"),
      (tables) => {
        return {
          check: ({ params }) => params.Memosprite,
          title: $t("panel-damage-rules.weapons.remembrance.text_b6e8442f9a"),
          data: {
            meCdmg: tables[2]!
          }
        }
      }
    ],
    致长夜的星光: [
      staticIdx(1, "hpPct"),
      (tables) => {
        return {
          check: ({ params }) => params.Memosprite,
          title: $t("panel-damage-rules.weapons.remembrance.text_9609886632"),
          data: {
            meIgnore: tables[2]!,
            mtIgnore: tables[2]!,
            dmg: tables[3]!
          }
        }
      }
    ],
    爱如此刻永恒: [
      staticIdx(1, "speedPct"),
      (tables) => {
        return {
          check: ({ params }) => params.Memosprite,
          title: $t("panel-damage-rules.weapons.remembrance.text_994c52c5e9"),
          data: {
            enemydmg: tables[3]! * (100 + tables[4]!) / 100,
            cdmg: tables[2]! * (100 + tables[4]!) / 100
          }
        }
      }
    ],
    飞向粉色的明天: [
      staticIdx(1, "cdmg"),
      (tables) => {
        return {
          check: ({ charId }) => [8007, 8008].includes((charId as unknown as number) * 1),
          title: $t("panel-damage-rules.weapons.remembrance.text_957720f0ea"),
          data: {
            dmg: tables[2]!,
            a2Dmg: tables[3]!
          }
        }
      }
    ],
    你将起身歌唱: [
      staticIdx(1, "hpPct")
    ]
  }
}
