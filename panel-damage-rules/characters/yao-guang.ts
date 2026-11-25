import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.yao-guang.text_7d2d5012cf"),
  params: { punchline: 20 },
  dmg: ({ talent }, dmg) => dmg(talent.xe!['欢愉群攻']! + talent.xe!['欢愉弹射']! * 5, 'xe', 'elation')
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_902f89d4bd"),
  params: { punchline: 80 },
  dmg: ({ talent }, dmg) => dmg(talent.xe!['欢愉群攻']! + talent.xe!['欢愉弹射']! * 5, 'xe', 'elation')
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_63518668fb"),
  params: { punchline: 80 },
  dmg: ({ talent }, dmg) => dmg(talent.t!['附加伤害']!, 't', 'elation')
}]

export const defDmgIdx = 1
export const mainAttr = 'speed,cpct,cdmg'

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.yao-guang.text_6c89882fba"),
  data: {
    enemydmg: 16
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_62d370564f"),
  tree: 1,
  data: {
    joy: ({ attr }) => attr.speed! >= 120 ? Math.min(attr.speed! - 120 + 30, 230) : 0
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_7bc8d3ef1b"),
  data: {
    joy: ({ attr }) => (attr.joy!.base! + attr.joy!.pct!) * 0.2
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_d4facb9a06"),
  tree: 2,
  data: {
    cdmg: 80
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_6b95de7a32"),
  data: {
    kx: 20
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_76c960e299"),
  data: {
    punchline: ({ params }) => params.punchline
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_d9db072022"),
  cons: 1,
  data: {
    ignore: 20,
    punchline: 20
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_2d6b3271db"),
  cons: 2,
  data: {
    speedPct: 12,
    joy: 16
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_3720d6da8d"),
  cons: 4,
  data: {
    xeMulti: 100,
    tMulti: 10
  }
}, {
  title: $t("panel-damage-rules.characters.yao-guang.text_19f231d982"),
  cons: 6,
  data: {
    merrymakes: 25,
    xeMulti: 100
  }
}]

export const createdBy = $t("panel-damage-rules.characters.yao-guang.text_7ad80046cc")
