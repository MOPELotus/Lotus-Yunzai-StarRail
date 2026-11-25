import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.aventurine-elation.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_aef3538851"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_1ff95fd08f"),
  params: { punchline: 30 },
  dmg: ({ talent }, dmg) => dmg(talent.t!['战技额外伤害']!, 't', 'elation')
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_d57a7d9641"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_7d2d5012cf"),
  params: { punchline: 30 },
  dmg: ({ talent }, dmg) => dmg(talent.t!['终结技额外伤害']!, 't', 'elation')
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_9a6c2d3283"),
  params: { punchline: 20 },
  dmg: ({ talent }, dmg) => dmg(talent.xe!['技能伤害']! + talent.xe!['额外伤害']! * 10, 'xe', 'elation')
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_fe5a3a6d9f"),
  params: { punchline: 40 },
  // 热意按上限计算：2命前30点，2命后（含2命）50点
  dmg: ({ talent, cons }, dmg) => dmg(talent.xe2!['技能伤害']! + talent.xe2!['额外伤害']! * 10 + talent.xe2!['每点【热意】提升伤害']! * (cons >= 2 ? 50 : 30), 'xe2', 'elation')
}]

export const defDmgIdx = 5
export const mainAttr = 'hp,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.aventurine-elation.text_27f945ccf3"),
  tree: 1,
  data: {
    joy: ({ attr }) => attr.speed! >= 140 ? 30 + Math.min(attr.speed! - 140, 200) : 0
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_8c519708d2"),
  tree: 2,
  data: {
    joy: 100
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_ea797c1656"),
  tree: 3,
  data: {
    cdmg: 96
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_76c960e299"),
  data: {
    punchline: ({ params }) => params.punchline
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_c27c817a0f"),
  cons: 1,
  data: {
    kx: 24
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_f721e5df21"),
  cons: 4,
  data: {
    ignore: 18
  }
}, {
  title: $t("panel-damage-rules.characters.aventurine-elation.text_18bd8f1066"),
  cons: 6,
  data: {
    merrymakes: 25
  }
}]
