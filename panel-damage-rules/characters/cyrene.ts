import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff, DamageFn, DamageValue, Variables } from "../types.ts";

const addDmg = (...items: DamageValue[]) => {
  return items.reduce((ret, item) => {
    ret.dmg! += item.dmg || 0
    ret.avg += item.avg || 0
    return ret
  }, { dmg: 0, avg: 0 })
}

const scaleDmg = (item: DamageValue, scale: number) => ({
  dmg: (item.dmg || 0) * scale,
  avg: (item.avg || 0) * scale
})

const getEnhancedBasic = ({ talent, attr, calc }: Variables, { basic }: DamageFn) => {
  const hp = calc(attr.hp!)
  return basic(hp * (talent.a2!['单体伤害']! + talent.a2!['全体伤害']!), 'a')
}

const getTrueDmgRate = ({ talent, cons, params }: Variables) => {
  let rate = talent.e!['额外真实伤害比例']!
  if (cons >= 2) {
    rate += Math.min(Math.max((params.e2BuffCount || 0) as number, 0), 4) * 0.06
  }
  return rate
}

const addFieldDmg = (basicDmg: DamageValue, data: Variables) => {
  return addDmg(basicDmg, scaleDmg(basicDmg, getTrueDmgRate(data)))
}

const getTrueSelfDmg = ({ talent, attr, calc, cons, params }: Variables, { basic }: DamageFn) => {
  const hp = calc(attr.hp!)
  const teammateCount = Math.min(Math.max((params.teammateCount || 0) as number, 0), 3)
  const bounceCount = teammateCount + (cons >= 1 && params.trueSelfTriggered ? 12 : 0)
  const e4Stacks = cons >= 4 ? Math.min(Math.max((params.e4Stacks || 0) as number, 0), 24) : 0
  const bouncePct = talent.me2!['「真我」之诗•随机单体伤害']! + e4Stacks * 0.06
  return basic(hp * (talent.me!['技能伤害']! + bounceCount * bouncePct), 'me')
}

const getBounceCount = ({ cons, params }: Variables) => {
  const teammateCount = Math.min(Math.max((params.teammateCount || 0) as number, 0), 3)
  return teammateCount + (cons >= 1 && params.trueSelfTriggered ? 12 : 0)
}

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.cyrene.text_8b79df27ba"),
  params: { ripple: false, Memosprite: false, trueSelfTriggered: false, e2BuffCount: 0 },
  dmg: (data, { basic }) => {
    const basicDmg = basic(data.calc(data.attr.hp!) * data.talent.a!['技能伤害']!, 'a')
    return addFieldDmg(basicDmg, data)
  }
}, {
  title: $t("panel-damage-rules.characters.cyrene.text_3369b65b80"),
  params: { ripple: true, e2BuffCount: 4 },
  dmg: (data, dmg) => addFieldDmg(getEnhancedBasic(data, dmg), data)
}, {
  title: $t("panel-damage-rules.characters.cyrene.text_e06acc924f"),
  params: { ripple: true, e2BuffCount: 4 },
  dmg: (data, { basic }) => {
    const basicDmg = basic(data.calc(data.attr.hp!) * data.talent.a2!['全体伤害']!, 'a')
    return addFieldDmg(basicDmg, data)
  }
}, {
  title: (data) => $t("panel-damage-rules.characters.cyrene.text_5d7cbe2aa4", { "value1": getBounceCount(data) }),
  params: {
    ripple: true,
    Memosprite: true,
    trueSelfTriggered: false,
    teammateCount: 3,
    e2BuffCount: 4,
    e4Stacks: 24
  },
  dmg: (data, dmg) => {
    const basicDmg = getTrueSelfDmg(data, dmg)
    return addFieldDmg(basicDmg, data)
  }
}, {
  title: (data) => $t("panel-damage-rules.characters.cyrene.text_4063530088", { "value1": getBounceCount(data) }),
  dmgKey: 'me',
  params: { ripple: true, Memosprite: true, trueSelfTriggered: true, teammateCount: 3, e2BuffCount: 4, e4Stacks: 24 },
  dmg: (data, dmg) => {
    const basicDmg = getTrueSelfDmg(data, dmg)
    return addFieldDmg(basicDmg, data)
  }
}]

export const defDmgIdx = 4
export const defDmgKey = 'me'
export const defParams = {
  ripple: true,
  Memosprite: true,
  trueSelfTriggered: true,
  teammateCount: 3,
  e2BuffCount: 4,
  e4Stacks: 24
}
export const mainAttr = 'hp,cpct,cdmg,speed'
export const createdBy = 'starim00'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.cyrene.text_a6d2b7b3b0"),
  data: {
    dmg: ({ talent }) => talent.t!['造成的伤害提高']! * 100
  }
}, {
  check: ({ params }) => params.ripple === true,
  title: $t("panel-damage-rules.characters.cyrene.text_bdf078bcf5"),
  data: {
    cpct: ({ talent }) => talent.q!['暴击率提高']! * 100
  }
}, {
  check: ({ params }) => params.Memosprite === true,
  title: $t("panel-damage-rules.characters.cyrene.text_b398067b7c"),
  data: {
    hpPct: ({ talent }) => talent.mt!['生命上限提高']! * 100
  }
}, {
  tree: 3,
  check: ({ attr, calc }) => calc(attr.speed!) >= 180,
  title: $t("panel-damage-rules.characters.cyrene.text_6b6e0c1335"),
  sort: 9,
  data: {
    _speed: ({ attr, calc }) => calc(attr.speed!),
    dmg: 20,
    kx: ({ attr, calc }) => Math.min(Math.max(calc(attr.speed!) - 180, 0), 60) * 2
  }
}, {
  cons: 6,
  check: ({ params }) => params.trueSelfTriggered === true,
  title: $t("panel-damage-rules.characters.cyrene.text_4989e6336a"),
  data: {
    enemyDef: 20
  }
}]
