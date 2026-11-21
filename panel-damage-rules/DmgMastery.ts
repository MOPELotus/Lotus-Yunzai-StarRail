import type { Params as RuleParams } from "./types.ts"
import { erType } from './DmgCalcMeta.ts'

const defaultParams = {
  stellarConductCount : 12, // 星超导叠层计数，若相关calc.js未传入参数，则默认为最大12层
  stellarVortexCount : 6,   // 星辉风旋系数，若相关calc.js未传入参数，则默认为最大6层
}

let DmgMastery = {
  getMultiple (type: string, mastery = 0) {
    let typeCfg = erType[type]!
    if (typeCfg.type === 'pct') {
      return (25 / 9) * mastery / (mastery + 1400)
    } else if (typeCfg.type === 'fusion') {
      return 16 * mastery / (mastery + 2000)
    } else if (typeCfg.type === 'lunar' || typeCfg.type === 'stellar') {
      return 6 * mastery / (mastery + 2000)
    } else if (typeCfg.type === 'bonus') {
      return 5 * mastery / (mastery + 1200)
    } else if (typeCfg.type === 'shield') {
      return (40 / 9) * mastery / (mastery + 1400)
    }
    return 0
  },
  getBasePct (type: string, element: string | undefined, talent: string | false, params: RuleParams | false = {}) {
    let typeCfg = erType[type]
    if (typeCfg) {
      const args = {} as Parameters<typeof typeCfg.num>[0];
      args.element = element;
      args.talent = talent;
      args.params = { ...defaultParams, ...params as object };
      return typeCfg.num(args) || 1
    }
    return 1
  }
}
export default DmgMastery
