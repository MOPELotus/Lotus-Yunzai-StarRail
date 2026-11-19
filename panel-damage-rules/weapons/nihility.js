export default function (staticIdx, keyIdx) {
  return {
    行于流逝的岸: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: '造成的伤害提高[dmg]%，终结技伤害额外提高[qDmg]%',
          data: {
            dmg: tables[2],
            qDmg: tables[3]
          }
        }
      }
    ],
    无边曼舞: [
      staticIdx(1, 'cpct'),
      keyIdx('对处于防御降低或减速状态下的敌人暴击伤害提高[cdmg]%', 'cdmg', 2)
    ],
    只需等待: [
      staticIdx(1, 'dmg'),
      (tables) => {
        return {
          title: '释放攻击3层Buff提高速度[speedPct]%',
          data: {
            speedPct: tables[2] * 3
          }
        }
      }
    ],
    孤独的疗愈: [
      staticIdx(1, 'stance'),
      keyIdx('装备者造成的持续伤害提高[dotDmg]%', 'dotDmg', 2)
    ],
    重塑时光之忆: [
      staticIdx(1, 'effPct'),
      (tables) => {
        return {
          title: '4层Buff提高攻击力[atkPct]%，造成的持续伤害无视目标[dotIgnore]%的防御力',
          data: {
            atkPct: tables[2] * 4,
            dotIgnore: tables[3] * 4
          }
        }
      }
    ],
  }
}
