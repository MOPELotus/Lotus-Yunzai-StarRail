export default function (staticIdx, keyIdx) {
  return {
    于夜色中: [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          title: '[_count]层Buff提高普攻与战技伤害[aDmg]%，终结技的暴击伤害[qCdmg]%',
          data: {
            _count: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed) - 100) / 10)) + '',
            aDmg: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed) - 100) / 10)) * tables[2],
            eDmg: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed) - 100) / 10)) * tables[2],
            qCdmg: ({ attr, calc }) => Math.min(6, Math.floor((calc(attr.speed) - 100) / 10)) * tables[3]
          }
        }
      }],
    如泥酣眠: [
      staticIdx(1, 'cdmg')
    ],
    锋镝: [
      keyIdx('战斗开始时暴击率提高[cpct]%', 'cpct', 1)
    ],
    '我将，巡征追猎': [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          title: '2层Buff使装备者造成的终结技伤害无视目标[qIgnore]%防御力',
          data: {
            qIgnore: tables[2] * 2
          }
        }
      }
    ],
    '烦恼着，幸福着': [
      staticIdx(1, 'cpct'),
      keyIdx('追加攻击造成的伤害提高[tDmg]%', 'tDmg', 2),
      (tables) => {
        return {
          title: '2层Buff时，造成的暴击伤害提高[cdmg]%',
          data: {
            cdmg: tables[3] * 2
          }
        }
      }
    ],
    纯粹思维的洗礼: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: '3层Buff提升装备者暴击伤害[cdmg]%',
          data: {
            cdmg: tables[2] * 3
          }
        }
      },
      keyIdx('释放终结技后，造成伤害提高[dmg]%，追加攻击无视目标防御力[tIgnore]%', { dmg: 3, tIgnore: 4 })
    ],
    驶向第二次生命: [
      staticIdx(1, 'stance'),
      keyIdx('造成的击破伤害无视目标[breakIgnore]%的防御力', 'breakIgnore', 2),
      (tables) => {
        return {
          title: '速度提高[speedPct]%',
          check: ({ attr }) => attr.stance >= 150,
          data: {
            speedPct: tables[3]
          }
        }
      }
    ],
  }
}
