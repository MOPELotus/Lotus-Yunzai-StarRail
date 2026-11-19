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
  }
}
