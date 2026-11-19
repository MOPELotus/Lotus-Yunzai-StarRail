export default function (staticIdx, keyIdx) {
  return {
    胜利只在朝夕间: [
      staticIdx(1, 'cdmg'),
      keyIdx('造成的伤害提高[dmg]%', 'dmg', 2)
    ],
    '多流汗，少流泪': [
      staticIdx(1, 'cpct'),
      keyIdx('造成的伤害提高[dmg]%', 'dmg', 2)
    ],
    将光阴织成黄金: [
      staticIdx(1, 'speed'),
      (tables) => {
        return {
          title: '暴击伤害提高[cdmg]%，普攻伤害提高[aDmg]%',
          data: {
            cdmg: tables[2] * 6,
            aDmg: tables[3] * 6
          }
        }
      }
    ],
    '让告别，更美一些': [
      staticIdx(1, 'hpPct'),
      keyIdx('无视目标[ignore]%的防御力', 'ignore', 2)
    ],
    致长夜的星光: [
      staticIdx(1, "hpPct"),
      (tables) => {
        return {
          check: ({ params }) => params.Memosprite,
          title: "【夜色】状态：忆灵无视[meIgnore]%防御，自身与忆灵增伤[dmg]%",
          data: {
            meIgnore: tables[2],
            mtIgnore: tables[2],
            dmg: tables[3]
          }
        }
      }
    ],
  }
}
