import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.yunli.text_8cf7d05190"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['反击·目标伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.yunli.text_af4ce66320"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['反击·相邻目标伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.yunli.text_d3182b11b3"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['反击·目标伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.yunli.text_aeb639a0e6"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['反击·相邻目标伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.yunli.text_b38a6c356a"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['勘破灭·随机伤害']!, 'q')
}]

export const mainAttr = 'atk,cpct,cdmg'
export const defDmgIdx = 2

export const buffs: Buff[] = [{
  title: $t("panel-damage-rules.characters.yunli.text_2cd7f7916f"),
  tree: 3,
  data: {
    atkPct: 30
  }
}, {
  title: $t("panel-damage-rules.characters.yunli.text_e13dee5e05"),
  data: {
    cdmg: ({ talent }) => talent.q!['暴击伤害提高']! * 100
  }
}, {
  title: $t("panel-damage-rules.characters.yunli.text_68f76aa230"),
  cons: 1,
  data: {
    qDmg: 20
  }
}, {
  title: $t("panel-damage-rules.characters.yunli.text_45a85dfdb0"),
  cons: 2,
  data: {
    ignore: 20
  }
}, {
  title: $t("panel-damage-rules.characters.yunli.text_86363bbf97"),
  cons: 6,
  data: {
    qCpct: 15,
    kx: 20
  }
}]

export const createdBy = $t("panel-damage-rules.characters.yunli.text_08cd8017cf")
