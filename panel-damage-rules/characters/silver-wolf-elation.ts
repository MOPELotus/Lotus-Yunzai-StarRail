import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_89d734171b"),
  params: { punchline: 60 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.a!['技能伤害']!, 'a').dmg! + dmg(talent.t!['普攻战技技能伤害']!, 't', 'elation').dmg!,
      avg: dmg(talent.a!['技能伤害']!, 'a').avg + dmg(talent.t!['普攻战技技能伤害']!, 't', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_ac1f1bc2ed"),
  params: { punchline: 60 },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: dmg(talent.e!['技能伤害']!, 'e').dmg! + dmg(talent.t!['普攻战技技能伤害']!, 't', 'elation').dmg!,
      avg: dmg(talent.e!['技能伤害']!, 'e').avg + dmg(talent.t!['普攻战技技能伤害']!, 't', 'elation').avg
    }
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_b87648cf35"),
  params: { punchline: 120, q: true },
  dmg: ({ talent }, dmg) => dmg(talent.q!['盲盒伤害']!, 'q', 'elation')
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_3448b0c356"),
  params: { punchline: 120, a2: true, q: true },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: (dmg(talent.a2!['弹射伤害']!, 'a2', 'elation').dmg! + dmg(talent.q!['盲盒伤害']!, 'q', 'elation').dmg! +
      dmg(talent.a2!['均分伤害']!, 'a2', 'elation').dmg!) * 1.3,
      avg: (dmg(talent.a2!['弹射伤害']!, 'a2', 'elation').avg + dmg(talent.q!['盲盒伤害']!, 'q', 'elation').avg +
      dmg(talent.a2!['均分伤害']!, 'a2', 'elation').avg) * 1.3
    }
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_f3701b414f"),
  params: { punchline: 120, a2: true, q: true },
  dmg: ({ talent }, dmg) => {
    return {
      dmg: (dmg(talent.a2!['弹射伤害']! * 1.2, 'a2', 'elation').dmg! + dmg(talent.q!['盲盒伤害']! * 1.2, 'q', 'elation').dmg! +
      dmg(talent.a2!['均分伤害']!, 'a2', 'elation').dmg!) * 1.3,
      avg: (dmg(talent.a2!['弹射伤害']! * 1.2, 'a2', 'elation').avg + dmg(talent.q!['盲盒伤害']! * 1.2, 'q', 'elation').avg +
      dmg(talent.a2!['均分伤害']!, 'a2', 'elation').avg) * 1.3
    }
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_9237d5d6f0"),
  params: { punchline: 100, xe: true, q: true },
  dmg: ({ talent }, dmg) => dmg(talent.xe2!['弹射伤害']! * 6, 'xe2', 'elation')
}]

export const defDmgIdx = 5
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_c34ff018d2"),
  tree: 1,
  data: {
    joy: ({ attr }) => attr.speed! >= 160 ? 50 + Math.min(Math.trunc((attr.speed! - 160) * 2), 200) : 0
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_f80e269407")
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_76c960e299"),
  data: {
    punchline: ({ params }) => params.punchline
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_6b1c76ab4c"),
  check: ({ params }) => params.q === true,
  cons: 1,
  data: {
    enemydmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_4525606fb8"),
  check: ({ params }) => params.q && params.xe === true,
  cons: 4,
  data: {
    punchline: ({ params }) => (params.punchline as number) * 6
  }
}, {
  title: $t("panel-damage-rules.characters.silver-wolf-elation.text_faaa0d01fb"),
  check: ({ params }) => params.a2 === true,
  cons: 6,
  data: {
    merrymakes: 50,
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.silver-wolf-elation.text_7ad80046cc")
