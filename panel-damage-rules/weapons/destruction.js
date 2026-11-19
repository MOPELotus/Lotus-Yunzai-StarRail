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
    铭记于心的约定: [
      staticIdx(1, 'stance'),
      keyIdx('释放终结技时，暴击率提高[cpct]%', 'cpct', 2)
    ],
    梦应归于何处: [
      staticIdx(1, 'stance'),
      keyIdx('敌方受到装备者造成的击破伤害提高[breakEnemydmg]%', 'breakEnemydmg', 2)
    ],
    秘密誓心: [
      staticIdx(1, 'dmg'),
      keyIdx('对生命百分比高于角色的敌人的伤害提高[dmg]%', 'dmg', 2)
    ],
    到不了的彼岸: [
      staticIdx(1, 'cpct'),
      staticIdx(2, 'hpPct'),
      keyIdx('受到攻击或装备者消耗自身生命值，伤害提高[dmg]%', 'dmg', 3)
    ],
    此身为剑: [
      staticIdx(1, 'cdmg'),
      (tables) => {
        return {
          title: '3层Buff使装备者下一次攻击造成的伤害提高[dmg]%，使该次攻击无视目标[ignore]%的防御力',
          data: {
            dmg: tables[2] * 3,
            ignore: tables[3]
          }
        }
      }
    ],
  }
}
