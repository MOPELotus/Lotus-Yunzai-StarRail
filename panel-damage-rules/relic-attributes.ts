import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { Format } from './format.ts'

export const mainAttr = {
  3: 'atk,def,hp,cpct,cdmg,heal,effPct'.split(','),
  4: 'atk,def,hp,speed'.split(','),
  5: 'atk,def,hp,dmg'.split(','),
  6: 'atk,def,hp,recharge,stance'.split(',')
}

export const subAttr = 'atk,atkPlus,def,defPlus,hp,hpPlus,speed,cpct,cdmg,effPct,effDef,stance'.split(',')

/**
 * 圣遗物词条配置
 * @[]value 副词条单次提升值（最大档位）
 * @[]valueMin 副词条单次提升最小值
 * @[]calc 伤害计算时变更的字段type
 * @[]type 词条的类型 normal:普通字段 plus:小词条
 * @[]base 词条类型为小词条时，对应的大词条
 * @[]text 展示文字
 */
type AttributeRule = {
  title: string;
  format: "pct" | "comma";
  calc?: "pct" | "plus";
  value: number;
  base?: string;
  type?: "plus" | "normal";
  text?: string;
};
const attrMap: Record<string, AttributeRule> = {
  atk: { title: $t("panel-damage-rules.relic-attributes.text_0d43934fdb"), format: 'pct', calc: 'pct', value: 4.32 },
  atkPlus: { title: $t("panel-damage-rules.relic-attributes.text_5085a8d5b4"), format: 'comma', value: 127 / 6 },
  def: { title: $t("panel-damage-rules.relic-attributes.text_aeed4dc439"), format: 'pct', calc: 'pct', value: 5.4 },
  defPlus: { title: $t("panel-damage-rules.relic-attributes.text_5a0e2465ee"), format: 'comma', value: 127 / 6 },
  hp: { title: $t("panel-damage-rules.relic-attributes.text_dd1fad216f"), format: 'pct', calc: 'pct', value: 4.32 },
  hpPlus: { title: $t("panel-damage-rules.relic-attributes.text_c2bb9b8f40"), format: 'comma', value: 254 / 6 },
  speed: { title: $t("panel-damage-rules.relic-attributes.text_0e14d148b4"), format: 'comma', calc: 'plus', value: 2.6 },
  cpct: { title: $t("panel-damage-rules.relic-attributes.text_d4b0baf955"), format: 'pct', calc: 'plus', value: 3.24 },
  cdmg: { title: $t("panel-damage-rules.relic-attributes.text_15bccc3951"), format: 'pct', calc: 'plus', value: 6.48 },
  recharge: { title: $t("panel-damage-rules.relic-attributes.text_4e061c7460"), format: 'pct', calc: 'plus', value: 3.11 },
  dmg: { title: $t("panel-damage-rules.relic-attributes.text_4da2b666c4"), format: 'pct', value: 6.22 },
  heal: { title: $t("panel-damage-rules.relic-attributes.text_6f2eca7102"), format: 'pct', calc: 'pct', value: 5.53 },
  stance: { title: $t("panel-damage-rules.relic-attributes.text_13d58c9c3a"), format: 'pct', value: 6.48, calc: 'pct' },
  effPct: { title: $t("panel-damage-rules.relic-attributes.text_84c7536950"), format: 'pct', value: 4.32, calc: 'pct' },
  effDef: { title: $t("panel-damage-rules.relic-attributes.text_c9a7dcf1f7"), format: 'pct', value: 4.32, calc: 'pct' }
}

Object.entries(attrMap).forEach(([key, attr]) => {
  // 设置value
  if (!attr.value) {
    return true
  }

  // 设置type
  attr.base = ({ hpPlus: 'hp', atkPlus: 'atk', defPlus: 'def' } as Record<string, string>)[key]
  attr.type = attr.base ? 'plus' : 'normal'

  // 设置展示文字
  attr.text = Format[attr.format](attr.value, 2)
})

export { attrMap }
