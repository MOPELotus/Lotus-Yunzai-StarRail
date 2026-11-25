import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DynamicIndex, StaticIndex, WeaponRules } from "../types.ts";

export default function (staticIdx: StaticIndex, keyIdx: DynamicIndex): WeaponRules {
  return {
    于夜色中: [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_1a88d23c52"),
          data: {
            _count: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed!) - 100) / 10)) + '',
            aDmg: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed!) - 100) / 10)) * tables[2]!,
            eDmg: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed!) - 100) / 10)) * tables[2]!,
            qCdmg: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed!) - 100) / 10)) * tables[3]!
          }
        }
      }],
    唯有沉默: [
      staticIdx(1, 'atkPct'),
      keyIdx($t("panel-damage-rules.weapons.hunt.text_488f7a5ee1"), 'cpct', 2)
    ],
    如泥酣眠: [
      staticIdx(1, 'cdmg')
    ],
    星海巡航: [
      staticIdx(1, 'cpct'),
      keyIdx($t("panel-damage-rules.weapons.hunt.text_64dbf7b203"), { cpct: 2, atkPct: 3 })
    ],
    春水初生: [
      keyIdx($t("panel-damage-rules.weapons.hunt.text_216cbc2e73"), { speedPct: 1, dmg: 2 })
    ],
    '点个关注吧！': [(tables) => {
      return {
        title: $t("panel-damage-rules.weapons.hunt.text_8fe566a3fc"),
        data: {
          aDmg: tables[1]! * 2,
          eDmg: tables[1]! * 2
        }
      }
    }],
    相抗: [
      keyIdx($t("panel-damage-rules.weapons.hunt.text_4a4b5e95bd"), 'speedPct', 1)
    ],
    离弦: [
      keyIdx($t("panel-damage-rules.weapons.hunt.text_14986ec386"), 'atkPct', 1)
    ],
    论剑: [(tables) => {
      return {
        title: $t("panel-damage-rules.weapons.hunt.text_67e511cccf"),
        data: {
          dmg: tables[1]! * 5
        }
      }
    }],
    重返幽冥: [
      staticIdx(1, 'cpct')
    ],
    锋镝: [
      keyIdx($t("panel-damage-rules.weapons.hunt.text_53ab8f3f1c"), 'cpct', 1)
    ],
    '烦恼着，幸福着': [
      staticIdx(1, 'cpct'),
      keyIdx($t("panel-damage-rules.weapons.hunt.text_6719170fb7"), 'tDmg', 2),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_f104d7f840"),
          data: {
            cdmg: tables[3]! * 2
          }
        }
      }
    ],
    纯粹思维的洗礼: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_fd37f648d2"),
          data: {
            cdmg: tables[2]! * 3
          }
        }
      },
      keyIdx($t("panel-damage-rules.weapons.hunt.text_b65e1fa66f"), { dmg: 3, tIgnore: 4 })
    ],
    最后的赢家: [
      staticIdx(1, 'atkPct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_23f1ed6256"),
          data: {
            cdmg: tables[2]! * 4
          }
        }
      }
    ],
    驶向第二次生命: [
      staticIdx(1, 'stance'),
      keyIdx($t("panel-damage-rules.weapons.hunt.text_ba2e740985"), 'breakIgnore', 2),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_085c1f0e24"),
          check: ({ attr }) => attr.stance! >= 150,
          data: {
            speedPct: tables[3]!
          }
        }
      }
    ],
    黑夜如影随行: [
      staticIdx(1, 'stance'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_b184d894dd"),
          data: {
            speedPct: tables[2]!
          }
        }
      }
    ],
    '我将，巡征追猎': [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_e19a6449f8"),
          data: {
            qIgnore: tables[2]! * 2
          }
        }
      }
    ],
    理想燃烧的地狱: [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_a880f4bf37"),
          data: {
            atkPct: tables[2]! + tables[3]! * 4
          }
        }
      }
    ],
    于那终点再见: [
      staticIdx(1, "cdmg"),
      keyIdx($t("panel-damage-rules.weapons.hunt.text_25ce42bfda"), { eDmg: 2, tDmg: 2 })
    ],
    一场谎言的终幕: [
      staticIdx(1, "cpct"),
      keyIdx($t("panel-damage-rules.weapons.hunt.text_35d8db34f3"), { atkPct: 2, enemydmg: 3 })
    ],
    向着地平线的终点: [
      staticIdx(1, "atkPct"),
      (tables) => {
        return {
          title: $t("panel-damage-rules.weapons.hunt.text_552d670b03"),
          data: {
            cdmg: tables[2]! * 10
          }
        }
      }
    ]
  }
}
