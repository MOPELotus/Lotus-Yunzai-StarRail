export default function (staticIdx, keyIdx) {
  return {
    唯有香如故: [
      staticIdx(1, 'stance'),
      (tables) => {
        return {
          title: '终结技攻击敌方目标后，敌方目标受到的伤害提高[enemydmg]%',
          sort: 9,
          data: {
            enemydmg: ({ attr, calc }) => calc(attr.stance) >= 150 ? (tables[2] + tables[3]) : tables[2]
          }
        }
      }
    ],
  }
}
