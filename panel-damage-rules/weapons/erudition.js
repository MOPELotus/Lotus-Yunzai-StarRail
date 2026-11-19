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
  }
}
