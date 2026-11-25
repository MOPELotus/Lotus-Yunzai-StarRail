import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_6486461627"),
  params: { punchline: 80 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.e!['技能伤害']!, 'e').dmg! + dmg(talent.t!['技能伤害']!, 'xe', 'elation').dmg!,
      avg: dmg(talent.e!['技能伤害']!, 'e').avg + dmg(talent.t!['技能伤害']!, 'xe', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_98cf6d7a0c"),
  params: { punchline: 80 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.e!['技能伤害']! * 3, 'e').dmg! + dmg(talent.t!['技能伤害']! * 3, 'xe', 'elation').dmg!,
      avg: dmg(talent.e!['技能伤害']! * 3, 'e').avg + dmg(talent.t!['技能伤害']! * 3, 'xe', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_b9ea3b8ed2"),
  params: { punchline: 900 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.e!['技能伤害']!, 'e').dmg! + dmg(talent.t!['技能伤害']!, 'xe', 'elation').dmg!,
      avg: dmg(talent.e!['技能伤害']!, 'e').avg + dmg(talent.t!['技能伤害']!, 'xe', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_55a32c5ccb"),
  params: { punchline: 900 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.e!['技能伤害']! * 3, 'e').dmg! + dmg(talent.t!['技能伤害']! * 3, 'xe', 'elation').dmg!,
      avg: dmg(talent.e!['技能伤害']! * 3, 'e').avg + dmg(talent.t!['技能伤害']! * 3, 'xe', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_1ec1aa0dbe"),
  params: { punchline: 50 },
  dmg: ({ talent }, dmg) => dmg(talent.xe!['技能单体伤害']! + talent.xe!['技能均分伤害']!, 'xe', 'elation')
}]

export const defDmgIdx = 1
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_c502953ea7"),
  tree: 1,
  data: {
    joy: ({ attr }) => Math.min(Math.trunc((attr.atk! - 1000) / 200 * 10), 60)
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_48c38bbc30"),
  tree: 2,
  data: {
    cpct: 15
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_76c960e299"),
  data: {
    punchline: ({ params }) => params.punchline
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_5b56798f58"),
  cons: 4,
  data: {
    enemydmg: 10
  }
}, {
  title: $t("panel-damage-rules.characters.elation-trailblazer.text_1de192ec93"),
  cons: 6,
  data: {
    cdmg: 100
  }
}]

export const createdBy = $t("panel-damage-rules.characters.elation-trailblazer.text_7ad80046cc")
