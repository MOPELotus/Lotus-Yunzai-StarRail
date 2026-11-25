import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { Buff } from "./types.ts";

let attr = (key: string, val: number): Buff => {
  let data: Record<string, number> = {}
  data[key] = val
  return {
    isStatic: true,
    data
  }
}
export default {
  野穗伴行的快枪手: {
    2: attr('atkPct', 12),
    4: [attr('speedPct', 6), {
      title: $t("panel-damage-rules.relics.text_7f32363524"),
      data: {
        aDmg: 10
      }
    }]
  },
  净庭教宗的圣骑士: {
    2: attr('defPct', 15),
    4: {
      title: $t("panel-damage-rules.relics.text_a2d5cabb3c"),
      data: {
        shield: 20
      }
    }
  },
  密林卧雪的猎人: {
    2: attr('ice', 10),
    4: {
      title: $t("panel-damage-rules.relics.text_fc1ac2cd61"),
      data: {
        cdmg: 25
      }
    }
  },
  繁星璀璨的天才: {
    2: attr('quantum', 10),
    4: {
      title: $t("panel-damage-rules.relics.text_c9d5869c27"),
      data: {
        ignore: 20
      }
    }
  },
  太空封印站: {
    2: [attr('atkPct', 12), {
      title: $t("panel-damage-rules.relics.text_700369db01"),
      check: ({ calc, attr }) => calc(attr.speed!) > 120,
      data: {
        atkPct: 12
      }
    }]
  },
  停转的萨尔索图: {
    2: [attr('cpct', 8), {
      title: $t("panel-damage-rules.relics.text_8112200899"),
      check: ({ attr, calc }) => {
        return calc(attr.cpct!) > 50
      },
      data: {
        qDmg: 15,
        tDmg: 15
      }
    }]
  },
  繁星竞技场: {
    2: [attr('cpct', 8), {
      title: $t("panel-damage-rules.relics.text_999637f7d4"),
      check: ({ calc, attr }) => calc(attr.cpct!) >= 70,
      data: {
        aDmg: 20,
        eDmg: 20
      }
    }]
  },
  毁烬焚骨的大公: {
    2: {
      title: $t("panel-damage-rules.relics.text_6719170fb7"),
      data: {
        tDmg: 20
      }
    },
    4: {
      title: $t("panel-damage-rules.relics.text_6be6ea1778"),
      data: {
        _buffCount: ({ params }) => params.tArtisBuffCount || 3,
        atkPct: ({ params }) => ((params.tArtisBuffCount || 3) as number) * 6
      }
    }
  },
  苍穹战线格拉默: {
    2: [attr('atkPct', 12), {
      title: $t("panel-damage-rules.relics.text_6237e2f925"),
      check: ({ attr }) => attr.speed! >= 135,
      data: {
        _speed: ({ attr }) => attr.speed! < 160 ? 135 : 160,
        dmg: ({ attr }) => attr.speed! < 160 ? 12 : 18
      }
    }]
  },
  死水深潜的先驱: {
    2: {
      title: $t("panel-damage-rules.relics.text_0257da6f76"),
      data: {
        dmg: 12
      }
    },
    4: [attr('cpct', 4), {
      title: $t("panel-damage-rules.relics.text_92c8c8c288"),
      data: {
        cpct: 4,
        cdmg: 24
      }
    }]
  },
  奔狼的都蓝王朝: {
    2: {
      title: $t("panel-damage-rules.relics.text_9ad22d21b0"),
      data: {
        tDmg: 25,
        cdmg: 25
      }
    }
  },
  识海迷坠的学者: {
    2: attr('cpct', 8),
    4: {
      title: $t("panel-damage-rules.relics.text_d7e8fa7181"),
      data: {
        eDmg: 45,
        qDmg: 20
      }
    }
  },
  盗贼公国塔利亚: {
    2: [attr('stance', 16), {
      title: $t("panel-damage-rules.relics.text_d9ec33b353"),
      check: ({ calc, attr }) => calc(attr.speed!) > 145,
      data: {
        stance: 20
      }
    }]
  },
  幽锁深牢的系囚: {
    2: attr('atkPct', 12),
    4: {
      title: $t("panel-damage-rules.relics.text_79975881b4"),
      data: {
        ignore: 18
      }
    }
  },
  荡除蠹灾的铁骑: {
    2: attr('stance', 16),
    4: [{
      title: $t("panel-damage-rules.relics.text_a36a4393b2"),
      sort: 9,
      data: {
        breakIgnore: ({ attr }) => attr.stance! >= 150 ? 10 : 0
      }
    }, {
      title: $t("panel-damage-rules.relics.text_43b2fdf7e9"),
      sort: 9,
      data: {
        superBreakIgnore: ({ attr }) => attr.stance! >= 250 ? 15 : 0
      }
    }]
  },
  风举云飞的勇烈: {
    2: attr('atkPct', 12),
    4: [attr('cpct', 6), {
      title: $t("panel-damage-rules.relics.text_cfe1e98369"),
      data: {
        qDmg: 36
      }
    }]
  },
  劫火莲灯铸炼宫: {
    2: [attr('speedPct', 6), {
      title: $t("panel-damage-rules.relics.text_bb70287dac"),
      data: {
        stance: 40
      }
    }]
  },
  街头出身的拳王: {
    2: attr('phy', 10),
    4: {
      title: $t("panel-damage-rules.relics.text_b1a3b4adf0"),
      data: {
        atkPct: 25
      }
    }
  },
  盗匪荒漠的废土客: {
    2: attr('imaginary', 10),
    4: {
      title: $t("panel-damage-rules.relics.text_11d909bb92"),
      data: {
        cpct: 10
      }
    }
  },
  流星追迹的怪盗: {
    2: attr('stance', 16),
    4: attr('stance', 16)
  },
  机心戏梦的钟表匠: {
    2: attr('stance', 16),
    4: {
      title: $t("panel-damage-rules.relics.text_f8fc895eb7"),
      data: {
        stance: 30
      }
    }
  },
  云无留迹的过客: {
    2: attr('heal', 10)
  },
  宝命长存的莳者: {
    2: attr('hpPct', 12),
    4: {
      title: $t("panel-damage-rules.relics.text_1d6727a9a3"),
      data: {
        cpct: 16
      }
    }
  },
  不老者的仙舟: {
    2: [attr('hpPct', 12), {
      title: $t("panel-damage-rules.relics.text_552cf65d81"),
      check: ({ calc, attr }) => calc(attr.speed!) > 120,
      data: {
        atkPct: 8
      }
    }]
  },
  谧宁拾骨地: {
    2: [attr('hpPct', 12), {
      title: $t("panel-damage-rules.relics.text_35b07c2523"),
      check: ({ calc, attr }) => calc(attr.hp!) >= 5000,
      data: {
        cdmg: 28
      }
    }]
  },
  泛银河商业公司: {
    2: [attr('effPct', 10), {
      title: $t("panel-damage-rules.relics.text_5480c350cc"),
      data: {
        atkPct: ({ calc, attr }) => Math.min(25, calc(attr.effPct!) / 4 || 0)
      }
    }]
  },
  凯歌祝捷的英豪: {
    2: attr('atkPct', 12),
    4: {
      title: $t("panel-damage-rules.relics.text_a77713d1f9"),
      data: {
        speedPct: 6,
        cdmg: 30
      }
    }
  },
  哀歌覆国的诗人: {
    2: attr('quantum', 10),
    4: [attr('speedPct', -8), {
      check: ({ attr, calc }) => calc(attr.staticAttr!.speed!) < 110,
      title: $t("panel-damage-rules.relics.text_544d1d109e"),
      data: {
        _speed: ({ attr, calc }) => calc(attr.staticAttr!.speed!) < 95 ? 95 : 110,
        cpct: ({ attr, calc }) => calc(attr.staticAttr!.speed!) < 95 ? 32 : 20
      }
    }]
  },
  渊思寂虑的巨树: {
    2: [attr('speedPct', 6), {
      title: $t("panel-damage-rules.relics.text_c7e37171e9"),
      check: ({ attr }) => attr.speed! >= 135,
      data: {
        _speed: ({ attr }) => attr.speed! >= 180 ? 180 : 135,
        heal: ({ attr }) => attr.speed! >= 180 ? 20 : 12
      }
    }]
  },
  熔岩锻铸的火匠: {
    2: attr('fire', 10),
    4: {
      title: $t("panel-damage-rules.relics.text_4d0df4633e"),
      data: {
        eDmg: 12,
        dmg: 12 // todo: 检查属性
      }
    }
  },
  骇域漫游的信使: {
    2: attr('speedPct', 6),
    4: {
      title: $t("panel-damage-rules.relics.text_dfee2e25b4"),
      data: {
        speedPct: 12
      }
    }
  },
  筑城者的贝洛伯格: {
    2: [attr('defPct', 15), {
      title: $t("panel-damage-rules.relics.text_8053869efb"),
      check: ({ calc, attr }) => calc(attr.effPct!) > 50,
      data: {
        defPct: 15
      }
    }]
  },
  零号关卡朋克洛德: {
    2: [attr('joy', 8), {
      check: ({ attr }) => attr.joy!.base! >= 40,
      title: $t("panel-damage-rules.relics.text_d782d23e90"),
      data: {
        joy: ({ attr, calc }) => {
          let _joy = calc(attr.joy!)
          return _joy < 80 ? 40 : 80
        },
        cdmg: ({ attr, calc }) => {
          let joy = calc(attr.joy!)
          return joy < 80 ? 20 : 32
        }
      }
    }]
  },
  神的瞬息欢愉: {
    2: [attr('speedPct', 6), {
      title: $t("panel-damage-rules.relics.text_eea55f7d7a"),
      sort: 10,
      check: ({ attr, calc, params }) => ((params.entryJoy ?? calc(attr.joy!)) as number) >= 40
    }]
  },
  贪噬禁果的异端: {
    2: attr('cdmg', 16),
    4: { title: $t("panel-damage-rules.relics.text_3a48d2e43f"), data: { aDmg: 36, atkPct: 20 } }
  },
  戏梦点星的伶人: {
    2: attr('speedPct', 6),
    4: { check: ({ params }) => Number(params.certifiedBanger) >= 10, title: $t("panel-damage-rules.relics.text_ad98af6126"), data: { cpct: 12 } }
  },
} satisfies Record<string, Record<number, Buff | Buff[]>>
