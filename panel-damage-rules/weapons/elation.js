export default function (staticIdx, keyIdx) {
  return {
    花花世界迷人眼: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: '无视对方防御力[ignore]%，欢愉度提升[joy]%',
          data: {
            ignore: tables[2] * 4,
            joy: tables[3]
          }
        }
      }
    ],
    当她决定看见: [
      staticIdx(1, 'speedPct'),
      keyIdx('【上上签】增加[cpct]%暴击率,增加[cdmg]%暴击伤害', {
        cpct: 2, cdmg: 3
      })
    ],
    今日好手气: [
      staticIdx(1, 'cpct')
    ],
    菇菇嘎嘎历险记: [
      staticIdx(1, 'joy'),
      keyIdx('敌方全体受到的欢愉伤害提高[xeEnemydmg]%', 'xeEnemydmg', 2)
    ],
    '未来，有我们一起': [
      staticIdx(1, 'cdmg'),
      keyIdx('施放终结技后，使我方全体欢愉度提高[joy]%', 'joy', 2)
    ],
    欢愉满溢祝福: [
      staticIdx(1, 'atkPct')
    ],
    邂逅于下一个花季: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: '能量恢复效率提高[recharge]%',
          data: {
            recharge: ({ attr }) => tables[2] + (Math.min(attr.sp, 480) - 120) / 10 * 0.3
          }
        }
      },
      keyIdx('施放欢愉技时，使敌方目标受到的伤害提高[enemydmg]%', 'enemydmg', 3)
    ],
    献给明日的色彩: [
      staticIdx(1, 'defPct'),
      keyIdx('敌方全体受到的伤害提高[enemydmg]%', {
        enemydmg: 2
      })
    ],
  }
}
