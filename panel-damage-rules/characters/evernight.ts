import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const mainAttr = 'hp,cpct,cdmg,dmg'
export const defParams = {
  Memosprite: true,
  enemyCount: 1,
  memoryCount: 1
}

export const buffs: Buff[] = [
  {
    title: $t("panel-damage-rules.characters.evernight.text_1ebe1bc401"),
    data: {
      cdmg: ({ talent }) => talent.t!['暴伤提高']! * 100
    }
  },
  {
    title: $t("panel-damage-rules.characters.evernight.text_c2818ded75"),
    data: {
      dmg: ({ talent }) => talent.mt!['造成的伤害提高']! * 100
    }
  },
  {
    check: ({ params }) => params.isZhiAn,
    title: $t("panel-damage-rules.characters.evernight.text_5c96dc4968"),
    data: {
      enemydmg: ({ talent }) => talent.q!['受到的伤害提高']! * 100,
      dmg: ({ talent }) => talent.q!['造成的伤害提高']! * 100
    }
  },
  {
    check: ({ params }) => params.skillActive,
    title: $t("panel-damage-rules.characters.evernight.text_7e4a0ce20a"),
    data: {
      meCdmg: ({ calc, attr, talent }) => calc(attr.cdmg!) * talent.e!['忆灵暴伤提高']!
    }
  },
  {
    tree: 1,
    title: $t("panel-damage-rules.characters.evernight.text_fa1a7f988b"),
    data: {
      cpct: 35,
      cdmg: 15
    }
  },
  {
    tree: 3,
    check: ({ params }) => params.skillActive,
    title: $t("panel-damage-rules.characters.evernight.text_ba251a1710"),
    data: {
      _memoryCount: ({ params }) => params.memoryCount || 1,
      meCdmg: ({ params }) => {
        const count = Math.min((params.memoryCount || 1) as number, 4);
        if (count >= 4) return 65; if (count === 3) return 50; if (count === 2) return 15; return 5
      }
    }
  },
  {
    cons: 1,
    title: $t("panel-damage-rules.characters.evernight.text_aa08f6bfad"),
    data: {
      _enemyCount: ({ params }) => params.enemyCount || 1,
      meDmg: ({ params }) => {
        const count = Math.max((params.enemyCount || 1) as number, 1);
        if (count === 1) return 50; if (count === 2) return 30; if (count === 3) return 25; return 20
      }
    }
  },
  {
    cons: 2,
    title: $t("panel-damage-rules.characters.evernight.text_92a346e6e1"),
    data: {
      cdmg: 40
    }
  },
  {
    cons: 6,
    title: $t("panel-damage-rules.characters.evernight.text_0616970a16"),
    data: {
      kx: 20
    }
  }
]

export const details: DamageDetail[] = [
  {
    title: $t("panel-damage-rules.characters.evernight.text_a900baa1d0"),
    dmg: ({ calc, attr, talent }, dmg) => {
      const basicDmg = calc(attr.hp!) * talent.a!['技能伤害']!
      return dmg.basic(basicDmg, 'a')
    }
  },
  {
    title: ({ params }) => $t("panel-damage-rules.characters.evernight.text_8c90af7095", { "yizhi": params.yizhi }),
    params: { yizhi: 16 },
    dmg: ({ calc, attr, talent, params }, dmg) => {
      const yilingHP = calc(attr.hp!) * 0.5
      const yizhiCount = Math.floor((params.yizhi as number) / 4)
      const pct = talent.me!['长夜伤害']! + talent.me!['长夜额外伤害']! * yizhiCount
      const basicDmg = yilingHP * pct
      return dmg.basic(basicDmg, 'me')
    }
  },
  {
    title: $t("panel-damage-rules.characters.evernight.text_7fda18c60f"),
    params: { isZhiAn: true, skillActive: true },
    dmg: ({ calc, attr, talent }, dmg) => {
      const yilingHP = calc(attr.hp!) * 0.5
      const basicDmg = yilingHP * talent.q!['长夜伤害']!
      return dmg.basic(basicDmg, 'me')
    }
  },
  {
    title: ({ params }) => $t("panel-damage-rules.characters.evernight.text_f58d7a57a6", { "yizhi": params.yizhi }),
    dmgKey: 'me',
    params: { yizhi: 16, isZhiAn: true, skillActive: true },
    dmg: ({ calc, attr, talent, params }, dmg) => {
      const yilingHP = calc(attr.hp!) * 0.5
      const pct = talent.me2!['主目标伤害']! * (params.yizhi as number)
      const basicDmg = yilingHP * pct
      return dmg.basic(basicDmg, 'me')
    }
  },
  {
    title: ({ params }) => $t("panel-damage-rules.characters.evernight.text_34172aa466", { "yizhi": params.yizhi }),
    params: { yizhi: 16, isZhiAn: true, skillActive: true },
    dmg: ({ calc, attr, talent, params }, dmg) => {
      const yilingHP = calc(attr.hp!) * 0.5
      const pct = talent.me2!['其他目标伤害']! * (params.yizhi as number)
      const basicDmg = yilingHP * pct
      return dmg.basic(basicDmg, 'me')
    }
  }
]

export const defDmgKey = 'me'
