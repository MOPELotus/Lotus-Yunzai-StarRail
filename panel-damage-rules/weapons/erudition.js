export default function (staticIdx, keyIdx) {
  return {
    向着不可追问处: [
      staticIdx(1, 'cpct'),
      keyIdx('战技和终结技造成的伤害提高[eDmg]%', { eDmg: 2, qDmg: 2 })
    ],
    拂晓之前: [
      staticIdx(1, 'cdmg'),
      keyIdx('战技和终结技造成的伤害提高[eDmg]%，追加攻击造成的伤害提高[tDmg]%', { eDmg: 2, qDmg: 2, tDmg: 3 })
    ],
    早餐的仪式感: [
      staticIdx(1, 'dmg'),
      (tables) => {
        return {
          title: '3层Buff下提高攻击力[atkPct]%',
          data: {
            atkPct: tables[2] * 3
          }
        }
      }
    ],
    银河铁道之夜: [
      (tables) => {
        return {
          title: '3个敌方目标提高攻击力[atkPct]%，弱点击破时伤害提高[dmg]%',
          data: {
            atkPct: tables[1] * 3,
            dmg: tables[2]
          }
        }
      }
    ],
    '片刻，留在眼底': [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: '根据装备者的能量上限提高伤害[qDmg]%',
          data: {
            qDmg: ({ attr }) => tables[2] * Math.min(attr.sp, 180)
          }
        }
      }
    ],
    偏偏希望无价: [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          check: ({ attr }) => attr.cdmg > 120,
          title: '基于暴击伤害，追加攻击伤害提高[tDmg]%，终结技或追加攻击伤害无视[qIgnore]%防御',
          sort: 9,
          data: {
            tDmg: ({ attr }) => Math.min(Math.floor((attr.cdmg - 120) / 20), 4) * tables[2],
            qIgnore: tables[3],
            tIgnore: tables[3]
          }
        }
      }
    ],
    天才们的休憩: [
      staticIdx(1, 'atkPct'),
      keyIdx('消灭敌方目标后爆伤提高[cdmg]%', 'cdmg', 2)
    ],
  }
}
