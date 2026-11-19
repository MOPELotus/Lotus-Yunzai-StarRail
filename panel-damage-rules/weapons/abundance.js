export default function (staticIdx, keyIdx) {
  return {
    唯有香如故: [
      staticIdx(1, 'stance'),
      (tables) => {
        return {
          title: '终结技攻击敌方目标后，敌方目标受到的伤害提高[enemydmg]%',
          sort: 9,
          data: {
            enemydmg: ({ attr, calc }) => calc(attr.stance) >= 150 ? (tables[2] + tables[3]) : tables[2]
          }
        }
      }
    ],
    同一种心情: [
      staticIdx(1, 'heal')
    ],
    时节不居: [
      staticIdx(1, 'hpPct'),
      staticIdx(2, 'heal')
    ],
    棺的回响: [
      staticIdx(1, 'atkPct'),
      keyIdx('释放终结技后，速度提升[speed]', 'speed', 3)
    ],
    '嘿，我在这儿': [
      staticIdx(1, 'hpPct'),
      keyIdx('释放战技时，治疗量提高[heal]%', 'heal', 2)
    ],
    惊魂夜: [
      staticIdx(1, 'recharge'),
      (tables) => {
        return {
          title: '提供治疗时，5层提供目标攻击力[atkPct]%',
          data: {
            atkPct: tables[3] * 5
          }
        }
      }
    ],
    何物为真: [
      staticIdx(1, 'stance')
    ],
  }
}
