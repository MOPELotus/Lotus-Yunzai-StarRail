import { createTranslator as createTextTranslator } from "../../../../packages/i18n/index.ts";
import messageCatalog from "../../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import type { DamageDetail, Buff } from "../types.ts";

export const details: DamageDetail[] = [{
  title: $t("panel-damage-rules.characters.cipher.text_a900baa1d0"),
  dmg: ({ talent }, dmg) => dmg(talent.a!['技能伤害']!, 'a')
}, {
  title: $t("panel-damage-rules.characters.cipher.text_ef9a46e334"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['技能伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.cipher.text_f647479cc6"),
  dmg: ({ talent }, dmg) => dmg(talent.e!['相邻目标伤害']!, 'e')
}, {
  title: $t("panel-damage-rules.characters.cipher.text_175c196412"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['技能伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.cipher.text_0348b7e1b8"),
  dmg: ({ talent }, dmg) => dmg(talent.q!['相邻目标伤害']!, 'q')
}, {
  title: $t("panel-damage-rules.characters.cipher.text_de6842a3c3"),
  dmg: ({ talent }, dmg) => dmg(talent.t!['技能伤害']!, 't')
}, {
  title: $t("panel-damage-rules.characters.cipher.text_6654ca39a3"),
  cons: 4,
  dmg: ({ talent }, dmg) => dmg(0.5)
}]

export const defDmgIdx = 3
export const mainAttr = 'atk,cpct,cdmg'

export const buffs: Buff[] = [ {
  title: $t("panel-damage-rules.characters.cipher.text_e99c46955d"),
  data: {
    atkPct: 30
  }
}, {
  check: ({ attr, calc }) => calc(attr.speed!) >= 140,
  title: $t("panel-damage-rules.characters.cipher.text_66f548be04"),
  sort: 9,
  tree: 1,
  data: {
    _speed: ({ attr, calc }) => calc(attr.speed!) >= 170 ? 170 : 140,
    cpct: ({ attr, calc }) => calc(attr.speed!) >= 170 ? 50 : 25
  }
}, {
  title: $t("panel-damage-rules.characters.cipher.text_81c7db3463"),
  tree: 3,
  data: {
    tCdmg: 100,
    enemydmg: 40
  }
}, {
  title: $t("panel-damage-rules.characters.cipher.text_38b27efe47"),
  cons: 1,
  data: {
    atkPct: 80
  }
}, {
  title: $t("panel-damage-rules.characters.cipher.text_1e9666bd08"),
  cons: 2,
  data: {
    enemydmg: 30
  }
}, {
  title: $t("panel-damage-rules.characters.cipher.text_0319314846"),
  cons: 6,
  data: {
    tDmg: 350
  }
}]

export const createdBy = $t("panel-damage-rules.characters.cipher.text_08cd8017cf")
