import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { BaseAttr, Buff, DamageMetadata, EngineAttr, Numbers, Params, Variables } from "./types.ts"
import { eleBaseDmg } from './DmgCalcMeta.ts'
import lodash from './compat.ts'
import DmgMastery from './DmgMastery.ts'
import { Format, Meta } from './compat.ts'
import AttrItem from './AttrItem.ts'

let DmgAttr = {
  getAttrValue (ds: Partial<BaseAttr> | number = {}) {
    return ((ds as Partial<BaseAttr>).base || 0) + ((ds as Partial<BaseAttr>).plus || 0) + (((ds as Partial<BaseAttr>).base || 0) * ((ds as Partial<BaseAttr>).pct || 0) / 100)
  },

  getAttr ({ originalAttr, attr = {}, weapon = {}, char = {}, game = 'gs' }: { originalAttr?: EngineAttr; attr?: Record<string, number | Record<string, BaseAttr> | undefined> & { staticAttr?: Record<string, BaseAttr> }; weapon?: Partial<Variables['weapon']>; char?: { elem?: string; sp?: number; weaponTypeName?: string }; game?: 'sr' | 'gs' }) {
    let ret = {} as EngineAttr
    if (originalAttr) {
      ret = lodash.merge({}, originalAttr)
    }

    lodash.forEach('atk,def,hp,speed'.split(','), (key) => {
      ret[key] = AttrItem.create((originalAttr?.[key] as BaseAttr | undefined) || {
        base: ((attr?.[`${key}Base`] as number | undefined) || 0) * 1,
        plus: ((attr?.[key] as number | undefined) || 0) * 1 - ((attr?.[`${key}Base`] as number | undefined) || 0) * 1,
        pct: 0
      })
    })

    lodash.forEach((game === 'gs' ? 'mastery,recharge,cpct,cdmg,heal,dmg,phy,coloringDmg' : 'recharge,cpct,cdmg,heal,dmg,enemydmg,effPct,effDef,stance,joy').split(','), (key) => {
      ret[key] = AttrItem.create((originalAttr?.[key] as BaseAttr | undefined) || {
        base: ((attr?.[key] as number | undefined) || 0) * 1,
        plus: 0,
        pct: 0,
        inc: 0
      })
    })

    lodash.forEach((game === 'gs' ? 'a,a2,a3,e,q,nightsoul' : 'a,a2,a3,e,e2,xe,xe2,q,q2,q3,t,t2,me,me2,mt,mt2,dot,break,elation').split(','), (key) => {
      ret[key] = ret[key] || {
        pct: 0,
        multi: 0,
        plus: 0,
        dmg: 0,
        enemydmg: 0,
        cpct: 0,
        cdmg: 0,
        elevated: 0,
        merrymakes: 0,
        def: 0,
        ignore: 0
      }
    })

    ret.enemy = ret.enemy || { def: 0, ignore: 0, phy: 0 }
    ret.shield = AttrItem.create(originalAttr?.shield || { base: 100, plus: 0, inc: 100 })

    if (!originalAttr) {
      ret.weapon = weapon
      ret.weaponTypeName = char.weaponTypeName
      ret.element = Format.elemName(char.elem)
      ret.refine = ((weapon.affix || ret.refine || 1) * 1 - 1) || 0
      ret.multi = 0
      ret.kx = 0
      ret.staticAttr = attr?.staticAttr || {}
      if (game === 'gs') {
        ret.elevated = 0 // 擢升
        ret.vaporize = 0 // 蒸发
        ret.melt = 0 // 融化
        ret.burning = 0 // 燃烧
        ret.crystallize = 0 // 结晶
        ret.superConduct = 0 // 超导
        ret.swirl = 0 // 扩散
        ret.electroCharged = 0 // 感电
        ret.shatter = 0 // 碎冰
        ret.overloaded = 0 // 超载
        ret.bloom = 0 // 绽放
        ret.burgeon = 0 // 烈绽放
        ret.hyperBloom = 0 // 超绽放
        ret.aggravate = 0 // 超激化
        ret.spread = 0 // 蔓激化
        ret.lunarCharged = 0 // 月感电
        ret.lunarBloom = 0 // 月绽放
        ret.lunarCrystallize = 0 // 月结晶
        ret.stellarConduct = 0 // 星超导
        ret.stellarSwirl = 0 // 星扩散
        ret.fykx = 0 // 敌人反应抗性降低
        ret.fyplus = 0 // 反应伤害值提升（数值/不受精通加成）
        ret.fypct = 0 // 反应基础伤害值提升（百分比/受精通加成）
      } else if (game === 'sr') {
        ret.sp = (char.sp || 0) * 1
        ret.superBreak = {
          ignore: 0
        }
        ret.merrymakes = 0 // 增笑
        ret.punchline = 0 // 笑点
      }
    }

    let { attrMap } = Meta.getMeta(game, 'arti')
    lodash.forEach(attrMap, (cfg, key) => {
      if (!ret[key]) {
        ret[key] = AttrItem.create({ base: 0, plus: 0, pct: 0, inc: 0 })
      }
    })

    return ret
  },

  getDs (attr: EngineAttr, meta: DamageMetadata, params: Params) {
    return {
      ...meta, attr, params, refine: attr.refine,
      weaponTypeName: attr.weaponTypeName,
      element: Format.elemName(attr.element) || attr.element,
      calc: DmgAttr.getAttrValue
    }
  },

  calcAttr ({ originalAttr, buffs, meta, artis, params = {}, incAttr = '', reduceAttr = '', talent = '', game = 'gs' }: { originalAttr: EngineAttr; buffs: readonly Buff[]; meta: DamageMetadata; artis: Numbers; params?: Params; incAttr?: string; reduceAttr?: string; talent?: string; game?: 'sr' | 'gs' }) {
    let attr = DmgAttr.getAttr({ originalAttr, game })
    attr.characterName = meta.characterName
    let msg: string[] = []
    let { attrMap } = Meta.getMeta(game, 'arti')

    if (incAttr && attrMap[incAttr]) {
      let aCfg = attrMap[incAttr]!
      attr[incAttr] = attr[incAttr] || AttrItem.create({ base: 0, plus: 0, pct: 0, inc: 0 })
      ;(attr[incAttr] as BaseAttr)[aCfg.calc!] += aCfg.value
    }
    if (reduceAttr && attrMap[reduceAttr]) {
      let aCfg = attrMap[reduceAttr]!
      attr[reduceAttr] = attr[reduceAttr] || AttrItem.create({ base: 0, plus: 0, pct: 0, inc: 0 })
      ;(attr[reduceAttr] as BaseAttr)[aCfg.calc!] -= aCfg.value
    }

    lodash.forEach(buffs, (buff) => {
      meta.mastery = meta.mastery || buff.mastery
    })
    lodash.forEach(buffs, (buff) => {
      let ds = DmgAttr.getDs(attr, meta, params) as unknown as Variables & { currentTalent: string }
      ds.currentTalent = talent
      ds.artis = artis

      if (buff.isStatic) return
      if (buff.check && !buff.check(ds)) return
      if (buff.cons && ds.cons * 1 < buff.cons * 1) return
      if (!lodash.isUndefined(buff.maxCons) && ds.cons * 1 > buff.maxCons * 1) return
      if (buff.tree && !ds.trees[`10${buff.tree}`]) return

      let title = typeof buff.title === 'function' ? buff.title(ds) : buff.title

      if (buff.mastery) {
        let mKey: Record<string, string> = { vaporize: $t("panel-damage-rules.DmgAttr.text_d8c812aa9f"), melt: $t("panel-damage-rules.DmgAttr.text_3ad2d041d4"), swirl: $t("panel-damage-rules.DmgAttr.text_46f1d54dc9") }
        let mKey2: Record<string, string> = { aggravate: $t("panel-damage-rules.DmgAttr.text_9278c673c4"), spread: $t("panel-damage-rules.DmgAttr.text_6e8c43a177") }
        let mastery = Math.max(0, (attr.mastery?.base || 0) + (attr.mastery?.plus || 0))
        buff.data = buff.data || {}
        let key = buff.mastery
        if (mKey[key]) {
          buff.data['_' + key] = DmgMastery.getMultiple(key, mastery) * 100
        } else if (mKey2[key]) {
          let eleNum = DmgMastery.getBasePct(key, attr.element, talent)
          let eleBase = 1 + ((attr[key] as number | undefined) || 0) / 100 + DmgMastery.getMultiple(key, mastery)
          eleBase *= eleBaseDmg[ds.level]!
          buff.data['_' + key] = DmgMastery.getMultiple(key, mastery) * 100
          buff.data['_' + key + 'num'] = eleNum * eleBase
        }
      }

      lodash.forEach(buff.data, (val, key) => {
        if (lodash.isFunction(val)) val = val(ds)
        if (!val && val !== 0) return
        title = title!.replace(`[${key}]`, Format.comma(val, 1))

        // 技能提高
        let tRet = /^(a|a2|a3|e|e2|q|q2|q3|t|t2|me|xe|xe2|mt|dot|break|nightsoul)(Def|Ignore|Dmg|Enemydmg|Plus|Pct|Cpct|Cdmg|Multi|Elevated|Merrymakes)$/.exec(key)
        if (tRet) {
          if (attr[tRet[1]!]) {
            (attr[tRet[1]!] as Record<string, number>)[tRet[2]!.toLowerCase()]! += (val as number) * 1 || 0
          }
          return
        }

        let aRet = /^(mastery|cpct|cdmg|heal|recharge|dmg|enemydmg|phy|coloringDmg|shield|speed|stance|joy)(Plus|Pct|Inc)?$/.exec(key)
        if (aRet) {
          if (attr[aRet[1]!]) {
            (attr[aRet[1]!] as Record<string, number>)[aRet[2] ? aRet[2].toLowerCase() : 'plus']! += (val as number) * 1 || 0
          }
          return
        }

        let bRet = /^(hp|def|atk)(Base|Plus|Pct|Inc)?$/.exec(key)
        if (bRet) {
          let bKey = bRet[1]!
          let bType = bRet[2] ? bRet[2].toLowerCase() : 'plus'
          if (attr[bKey]) {
            (attr[bKey] as Record<string, number>)[bType]! += (val as number) * 1 || 0
            if (bRet[2] === 'Base' && attr.staticAttr?.[bKey]) {
              (attr[bKey] as BaseAttr).plus += (val as number) * attr.staticAttr[bKey].pct / 100 || 0
            }
          }
          return
        }
        if (key === 'enemyDef') {
          attr.enemy.def += (val as number) * 1 || 0
          return
        }

        if (key === 'ignore' || key === 'enemyIgnore') {
          attr.enemy.ignore += (val as number) * 1 || 0
          return
        }

        if ([
          'vaporize', 'melt', 'crystallize', 'burning',
          'superConduct', 'swirl', 'electroCharged', 'shatter',
          'overloaded', 'bloom', 'burgeon', 'hyperBloom',
          'aggravate', 'spread', 'elevated',
          'lunarCharged', 'lunarBloom', 'lunarCrystallize',
          'stellarConduct', 'stellarSwirl',
          'kx', 'fykx', 'multi', 'fyplus', 'fypct',
          'merrymakes', 'punchline'
        ].includes(key)) {
          (attr[key] as number) += (val as number) * 1 || 0
          return
        }

        let sRet = /^(superBreak)(Ignore)$/.exec(key)
        if (sRet) {
          if (attr[sRet[1]!]) {
            (attr[sRet[1]!] as Record<string, number>)[sRet[2]!.toLowerCase()]! += (val as number) * 1 || 0
          }
        }
      })
      msg.push(title!)
    })

    return { attr, msg }
  }
}

export default DmgAttr
