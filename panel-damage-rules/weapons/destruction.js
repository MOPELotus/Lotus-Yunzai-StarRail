export default function (staticIdx, keyIdx) {
  return {
    无可取代的东西: [
      staticIdx(1, 'atkPct'),
      keyIdx('受到攻击时提高造成伤害[dmg]%', 'dmg', 3)
    ],
    比阳光更明亮的: [
      staticIdx(1, 'cpct'),
      (tables) => {
        return {
          title: '2层Buff提高攻击力[atkPct]%，能量恢复效率提高[recharge]%',
          data: {
            atkPct: tables[2] * 2,
            recharge: tables[3] * 2
          }
        }
      }
    ],
    落日时起舞: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: '2层Buff使追加攻击造成的伤害提高[tDmg]%',
          data: {
            tDmg: tables[2] * 2
          }
        }
      }
    ],
  }
}
