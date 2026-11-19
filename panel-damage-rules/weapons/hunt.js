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
  }
}
