export default function (staticIdx, keyIdx) {
  return {
    记忆中的模样: [
      staticIdx(1, 'stance')
    ],
    镜中故我: [
      staticIdx(1, 'stance'),
      keyIdx('装备者释放终结技后，我方全体造成伤害提高[dmg]%', 'dmg', 2)
    ],
    如果时间是一朵花: [
      staticIdx(1, 'cdmg'),
      keyIdx('当装备者持有【谕示】时，我方全体目标的暴击伤害提高[cdmg]%', 'cdmg', 2)
    ],
    与行星相会: [],
    但战斗还未结束: [
      staticIdx(1, 'recharge')
    ],
    过往未来: [],
    镂月裁云之意: [
      keyIdx('攻击Buff下提高攻击力[atkPct]%', 'atkPct', 1)
    ],
    游戏尘寰: [
      staticIdx(1, 'cdmg')
    ],
    为了明日的旅途: [
      staticIdx(1, 'atkPct'),
      keyIdx('装备者释放终结技后，造成的伤害提高[dmg]%', 'dmg', 2)
    ],
    夜色流光溢彩: [
      (tables) => {
        return {
          title: '5层【歌咏】使装备者能量恢复效率提高[recharge]%，释放终结技后，装备者攻击力提高[atkPct]%，我方全体造成伤害提高[dmg]%',
          data: {
            recharge: tables[1] * 5,
            atkPct: tables[2],
            dmg: tables[3]
          }
        }
      }
    ],
    金血铭刻的时代: [staticIdx(1, 'atkPct')],
  }
}
