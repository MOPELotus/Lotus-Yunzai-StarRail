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
  }
}
