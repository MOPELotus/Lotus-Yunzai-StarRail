export default function (staticIdx, keyIdx) {
  return {
    命运从未公平: [
      staticIdx(1, 'defPct'),
      (tables) => {
        return {
          title: '装备者为我方提供护盾时，暴击伤害提高[cdmg]%。追击命中敌方时，使敌方目标受到伤害提高[enemydmg]%',
          data: {
            cdmg: tables[2],
            enemydmg: tables[4]
          }
        }
      }
    ],
    两个人的演唱会: [
      staticIdx(1, 'defPct'),
      (tables) => {
        return {
          title: '基于场上持有护盾的角色数目，提高装备者造成的伤害[dmg]%',
          data: {
            dmg: tables[2] * 4
          }
        }
      }
    ],
    记忆的质料: [
      staticIdx(1, 'effDef')
    ],
    她已闭上双眼: [
      staticIdx(1, 'hpPct'),
      staticIdx(2, 'recharge'),
      keyIdx('装备者生命降低时，使我方全体造成的伤害提高[dmg]%', 'dmg', 3)
    ],
  }
}
