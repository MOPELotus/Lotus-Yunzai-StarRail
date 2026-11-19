import { calculateLegacyPanelAttributeRows, damageAttribute } from "./panel-attributes.ts";
import type { readPanelDamageMetadata } from "./panel-card.ts";
import { object, starRailLegacySkillLevel, type PanelAvatar } from "./panel-model.ts";
import DmgAttr from "./panel-damage-rules/DmgAttr.js";
import DmgCalc from "./panel-damage-rules/DmgCalc.js";
import { attrMap } from "./panel-damage-rules/relic-attributes.js";
import relicRules from "./panel-damage-rules/relics.js";
import * as seele from "./panel-damage-rules/characters/seele.js";
import * as acheron from "./panel-damage-rules/characters/acheron.js";
import * as aventurine from "./panel-damage-rules/characters/aventurine.js";
import * as theHerta from "./panel-damage-rules/characters/the-herta.js";
import * as blackSwan from "./panel-damage-rules/characters/black-swan.js";
import * as kafka from "./panel-damage-rules/characters/kafka.js";
import * as kafkaEnhanced from "./panel-damage-rules/characters/kafka-enhanced.js";
import * as jingYuan from "./panel-damage-rules/characters/jing-yuan.js";
import * as feixiao from "./panel-damage-rules/characters/feixiao.js";
import * as lingsha from "./panel-damage-rules/characters/lingsha.js";
import * as yunli from "./panel-damage-rules/characters/yunli.js";
import * as boothill from "./panel-damage-rules/characters/boothill.js";
import * as drRatio from "./panel-damage-rules/characters/dr-ratio.js";
import * as imbibitorLunae from "./panel-damage-rules/characters/imbibitor-lunae.js";
import * as firefly from "./panel-damage-rules/characters/firefly.js";
import * as fireflyEnhanced from "./panel-damage-rules/characters/firefly-enhanced.js";
import * as fugue from "./panel-damage-rules/characters/fugue.js";
import * as ruanMei from "./panel-damage-rules/characters/ruan-mei.js";
import * as blade from "./panel-damage-rules/characters/blade.js";
import * as bladeEnhanced from "./panel-damage-rules/characters/blade-enhanced.js";
import * as tribbie from "./panel-damage-rules/characters/tribbie.js";
import * as bailu from "./panel-damage-rules/characters/bailu.js";
import * as welt from "./panel-damage-rules/characters/welt.js";
import * as weltEnhanced from "./panel-damage-rules/characters/welt-enhanced.js";
import * as silverWolf from "./panel-damage-rules/characters/silver-wolf.js";
import * as jiaoqiu from "./panel-damage-rules/characters/jiaoqiu.js";
import * as jingliu from "./panel-damage-rules/characters/jingliu.js";
import * as jingliuEnhanced from "./panel-damage-rules/characters/jingliu-enhanced.js";
import * as yanqing from "./panel-damage-rules/characters/yanqing.js";
import * as misha from "./panel-damage-rules/characters/misha.js";
import * as argenti from "./panel-damage-rules/characters/argenti.js";
import * as herta from "./panel-damage-rules/characters/herta.js";
import * as himeko from "./panel-damage-rules/characters/himeko.js";
import * as jade from "./panel-damage-rules/characters/jade.js";
import * as castorice from "./panel-damage-rules/characters/castorice.js";
import * as aglaea from "./panel-damage-rules/characters/aglaea.js";
import * as evernight from "./panel-damage-rules/characters/evernight.js";
import * as luocha from "./panel-damage-rules/characters/luocha.js";
import * as natasha from "./panel-damage-rules/characters/natasha.js";
import * as gallagher from "./panel-damage-rules/characters/gallagher.js";
import * as huohuo from "./panel-damage-rules/characters/huohuo.js";
import * as clara from "./panel-damage-rules/characters/clara.js";
import * as xueyi from "./panel-damage-rules/characters/xueyi.js";
import * as arlan from "./panel-damage-rules/characters/arlan.js";
import * as hook from "./panel-damage-rules/characters/hook.js";
import * as topaz from "./panel-damage-rules/characters/topaz.js";
import * as moze from "./panel-damage-rules/characters/moze.js";
import * as danHeng from "./panel-damage-rules/characters/dan-heng.js";
import * as sushang from "./panel-damage-rules/characters/sushang.js";
import * as archer from "./panel-damage-rules/characters/archer.js";
import * as marchHunt from "./panel-damage-rules/characters/march-hunt.js";
import * as luka from "./panel-damage-rules/characters/luka.js";
import * as guinaifen from "./panel-damage-rules/characters/guinaifen.js";
import * as sampo from "./panel-damage-rules/characters/sampo.js";
import * as hysilens from "./panel-damage-rules/characters/hysilens.js";
import * as serval from "./panel-damage-rules/characters/serval.js";
import hunt from "./panel-damage-rules/weapons/hunt.js";
import nihility from "./panel-damage-rules/weapons/nihility.js";
import erudition from "./panel-damage-rules/weapons/erudition.js";
import preservation from "./panel-damage-rules/weapons/preservation.js";
import abundance from "./panel-damage-rules/weapons/abundance.js";
import destruction from "./panel-damage-rules/weapons/destruction.js";
import harmony from "./panel-damage-rules/weapons/harmony.js";
import remembrance from "./panel-damage-rules/weapons/remembrance.js";

type Metadata = NonNullable<Awaited<ReturnType<typeof readPanelDamageMetadata>>>;
type Attr = { base: number; plus: number; pct: number; inc?: number };
type Numbers = Record<string, number>;
type Params = Record<string, number | boolean>;
type SkillValues = Record<string, Numbers>;
type Variables = {
  attr: Readonly<Record<string, Attr>>;
  calc: (attr: Attr) => number;
  talent: SkillValues;
  cons: number;
  trees: Record<string, boolean>;
  params: Params;
};
type DamageMetric = "damage" | "shield" | "heal";
export const personalDamageMetricLabel: Readonly<Record<DamageMetric, string>> = { damage: "期望伤害", shield: "护盾量", heal: "治疗量" };
type DamageValue = { avg: number; dmg?: number; metric?: DamageMetric };
type DamageFn = ((multiplier: number, skill: string, effect?: string) => DamageValue) & {
  basic: (amount: number, skill: string) => DamageValue;
  shield: (amount: number) => DamageValue;
  heal: (amount: number) => DamageValue;
};
type Buff = {
  title?: string;
  data?: Record<string, number | string | ((variables: Variables) => string | number)>;
  isStatic?: boolean;
  sort?: number;
  cons?: number;
  tree?: number;
};
type Rule = {
  details: readonly {
    title: string | ((variables: Variables) => string);
    cons?: number;
    params?: Readonly<Params>;
    check?: (variables: Variables) => boolean;
    dmg: (variables: Variables, damage: DamageFn) => DamageValue;
  }[];
  buffs?: readonly Buff[];
  defDmgIdx?: number;
  mainAttr: string;
  defParams?: Params | ((variables: Variables) => Params);
};
type Character = {
  name: string;
  element: string;
  path: string;
  traces: readonly number[];
  stats?: readonly string[];
  rule: Rule;
  cones: Readonly<Record<string, string>>;
};
const setRules = relicRules as unknown as Readonly<Record<string, Readonly<Record<number, Buff | Buff[]>>>>;
const kafkaCones = { "23006": "只需等待", "23022": "重塑时光之忆", "24003": "孤独的疗愈" };
const fireflyCones = { "23025": "梦应归于何处", "21042": "铭记于心的约定" };
const bladeCones = { "23009": "到不了的彼岸", "21012": "秘密誓心" };
const weltCones = { "23004": "以世界之名", "21015": "决心如汗珠般闪耀" };
const jingliuCones = { "23014": "此身为剑", "21012": "秘密誓心" };
const eruditionCones = { "21020": "天才们的休憩", "21027": "早餐的仪式感" };
const remembranceCones = { "21050": "胜利只在朝夕间", "21052": "多流汗，少流泪" };
const huohuoCones = { "23017": "惊魂夜", "21007": "同一种心情" };

// The original JS rules share DmgAttr's numeric AttrItem coercion and variable shape.
const characters: ReadonlyMap<string, Character> = new Map(Object.entries({
  "1102": { name: "希儿", element: "量子", path: "巡猎", traces: [102], rule: seele,
    cones: { "20000": "锋镝", "23001": "于夜色中", "23012": "如泥酣眠" } },
  "1308": { name: "黄泉", element: "雷", path: "虚无", traces: [102, 103], rule: acheron,
    cones: { "23024": "行于流逝的岸", "21044": "无边曼舞" } },
  "1401": { name: "大黑塔", element: "冰", path: "智识", traces: [101, 102, 103], rule: theHerta,
    cones: { "23037": "向着不可追问处" } },
  "1304": { name: "砂金", element: "虚数", path: "存护", traces: [102], stats: ["def"], rule: aventurine,
    cones: { "23023": "命运从未公平", "21043": "两个人的演唱会" } },
  "1307": { name: "黑天鹅", element: "风", path: "虚无", traces: [103], stats: ["effPct"], rule: blackSwan, cones: kafkaCones },
  "1005": { name: "卡芙卡", element: "雷", path: "虚无", traces: [], rule: kafka, cones: kafkaCones },
  "2005": { name: "卡芙卡Pro", element: "雷", path: "虚无", traces: [103], stats: ["effPct"], rule: kafkaEnhanced, cones: kafkaCones },
  "1204": { name: "景元", element: "雷", path: "智识", traces: [101, 103], rule: jingYuan,
    cones: { "23010": "拂晓之前", "21027": "早餐的仪式感" } },
  "1220": { name: "飞霄", element: "风", path: "巡猎", traces: [102, 103], rule: feixiao,
    cones: { "23031": "我将，巡征追猎", "23012": "如泥酣眠" } },
  "1222": { name: "灵砂", element: "火", path: "丰饶", traces: [101], stats: ["stance", "heal"], rule: lingsha,
    cones: { "23032": "唯有香如故" } },
  "1221": { name: "云璃", element: "物理", path: "毁灭", traces: [103], rule: yunli,
    cones: { "23030": "落日时起舞", "23002": "无可取代的东西" } },
  "1315": { name: "波提欧", element: "物理", path: "巡猎", traces: [101], stats: ["stance"], rule: boothill,
    cones: { "23027": "驶向第二次生命" } },
  "1305": { name: "真理医生", element: "虚数", path: "巡猎", traces: [102, 103], rule: drRatio,
    cones: { "23020": "纯粹思维的洗礼", "23016": "烦恼着，幸福着" } },
  "1213": { name: "丹恒•饮月", element: "虚数", path: "毁灭", traces: [103], rule: imbibitorLunae,
    cones: { "23015": "比阳光更明亮的", "23002": "无可取代的东西" } },
  "1310": { name: "流萤", element: "火", path: "毁灭", traces: [103], stats: ["stance"], rule: firefly,
    cones: fireflyCones },
  "2310": { name: "流萤Pro", element: "火", path: "毁灭", traces: [101, 103], stats: ["stance"], rule: fireflyEnhanced,
    cones: fireflyCones },
  "1225": { name: "忘归人", element: "火", path: "虚无", traces: [102], stats: ["stance"], rule: fugue,
    cones: { "23035": "长路终有归途", "24003": "孤独的疗愈" } },
  "1303": { name: "阮•梅", element: "冰", path: "同谐", traces: [101], stats: ["stance"], rule: ruanMei,
    cones: { "23019": "镜中故我", "21004": "记忆中的模样" } },
  "1205": { name: "刃", element: "风", path: "毁灭", traces: [102], stats: ["hp"], rule: blade, cones: bladeCones },
  "2205": { name: "刃Pro", element: "风", path: "毁灭", traces: [103], stats: ["hp"], rule: bladeEnhanced, cones: bladeCones },
  "1403": { name: "缇宝", element: "量子", path: "同谐", traces: [101, 102], stats: ["hp"], rule: tribbie,
    cones: { "23038": "如果时间是一朵花", "23019": "镜中故我" } },
  "1211": { name: "白露", element: "雷", path: "丰饶", traces: [], stats: ["hp", "heal"], rule: bailu,
    cones: { "23013": "时节不居", "21007": "同一种心情" } },
  "1004": { name: "瓦尔特", element: "虚数", path: "虚无", traces: [101, 103], rule: welt, cones: weltCones },
  "2004": { name: "瓦尔特Pro", element: "虚数", path: "虚无", traces: [101, 102, 103], stats: ["effPct"], rule: weltEnhanced, cones: weltCones },
  "1006": { name: "银狼", element: "量子", path: "虚无", traces: [102], stats: ["stance"], rule: silverWolf,
    cones: { "23007": "雨一直下", "22000": "新手任务开始前" } },
  "1218": { name: "椒丘", element: "火", path: "虚无", traces: [102], stats: ["effPct"], rule: jiaoqiu,
    cones: { "23029": "那无数个春天", "21015": "决心如汗珠般闪耀" } },
  "1212": { name: "镜流", element: "冰", path: "毁灭", traces: [103], rule: jingliu, cones: jingliuCones },
  "2212": { name: "镜流Pro", element: "冰", path: "毁灭", traces: [101, 103], stats: ["hp"], rule: jingliuEnhanced, cones: jingliuCones },
  "1209": { name: "彦卿", element: "冰", path: "巡猎", traces: [101, 103], rule: yanqing,
    cones: { "23012": "如泥酣眠", "21010": "论剑" } },
  "1312": { name: "米沙", element: "冰", path: "毁灭", traces: [102, 103], rule: misha,
    cones: { "21042": "铭记于心的约定", "21012": "秘密誓心" } },
  "1302": { name: "银枝", element: "物理", path: "智识", traces: [], rule: argenti,
    cones: { "23018": "片刻，留在眼底", ...eruditionCones } },
  "1013": { name: "黑塔", element: "冰", path: "智识", traces: [101, 103], rule: herta,
    cones: { "23000": "银河铁道之夜", ...eruditionCones } },
  "1003": { name: "姬子", element: "火", path: "智识", traces: [102, 103], rule: himeko,
    cones: { "23000": "银河铁道之夜", ...eruditionCones } },
  "1314": { name: "翡翠", element: "量子", path: "智识", traces: [103], rule: jade,
    cones: { "23028": "偏偏希望无价", ...eruditionCones } },
  "1407": { name: "遐蝶", element: "量子", path: "记忆", traces: [], stats: ["hp"], rule: castorice,
    cones: { "23040": "让告别，更美一些", ...remembranceCones } },
  "1402": { name: "阿格莱雅", element: "雷", path: "记忆", traces: [101], rule: aglaea,
    cones: { "23036": "将光阴织成黄金", ...remembranceCones } },
  "1413": { name: "长夜月", element: "冰", path: "记忆", traces: [101, 103], stats: ["hp"], rule: evernight,
    cones: { "23049": "致长夜的星光", ...remembranceCones } },
  "1203": { name: "罗刹", element: "虚数", path: "丰饶", traces: [], stats: ["heal"], rule: luocha,
    cones: { "23008": "棺的回响", "21007": "同一种心情" } },
  "1105": { name: "娜塔莎", element: "物理", path: "丰饶", traces: [102], stats: ["hp", "heal"], rule: natasha,
    cones: { "22001": "嘿，我在这儿", "23013": "时节不居" } },
  "1301": { name: "加拉赫", element: "火", path: "丰饶", traces: [101], stats: ["heal", "stance"], rule: gallagher,
    cones: { "21035": "何物为真", "21007": "同一种心情" } },
  "1217": { name: "藿藿", element: "风", path: "丰饶", traces: [], stats: ["hp", "heal"], rule: huohuo, cones: huohuoCones },
  "2217": { name: "藿藿Pro", element: "风", path: "丰饶", traces: [], stats: ["hp", "heal"], rule: huohuo, cones: huohuoCones },
  "1107": { name: "克拉拉", element: "物理", path: "毁灭", traces: [103], rule: clara,
    cones: { "23002": "无可取代的东西", "23030": "落日时起舞" } },
  "1214": { name: "雪衣", element: "量子", path: "毁灭", traces: [101, 102], stats: ["stance"], rule: xueyi,
    cones: { "21042": "铭记于心的约定", "24000": "记一位星神的陨落" } },
  "1008": { name: "阿兰", element: "雷", path: "毁灭", traces: [], rule: arlan,
    cones: { "21012": "秘密誓心", "24000": "记一位星神的陨落" } },
  "1109": { name: "虎克", element: "火", path: "毁灭", traces: [], rule: hook,
    cones: { "21026": "汪！散步时间！", "24000": "记一位星神的陨落" } },
  "1112": { name: "托帕&账账", element: "火", path: "巡猎", traces: [101, 102], rule: topaz,
    cones: { "23016": "烦恼着，幸福着", "21010": "论剑" } },
  "1223": { name: "貊泽", element: "雷", path: "巡猎", traces: [103], rule: moze,
    cones: { "23016": "烦恼着，幸福着", "21010": "论剑" } },
  "1002": { name: "丹恒", element: "风", path: "巡猎", traces: [103], rule: danHeng,
    cones: { "21003": "唯有沉默", "24001": "星海巡航" } },
  "1206": { name: "素裳", element: "物理", path: "巡猎", traces: [101], rule: sushang,
    cones: { "21010": "论剑", "23001": "于夜色中" } },
  "1015": { name: "Archer", element: "量子", path: "巡猎", traces: [102], rule: archer,
    cones: { "23046": "理想燃烧的地狱", "24001": "星海巡航" } },
  "1224": { name: "三月七·巡猎", element: "虚数", path: "巡猎", traces: [], rule: marchHunt,
    cones: { "21010": "论剑", "24001": "星海巡航" } },
  "1111": { name: "卢卡", element: "物理", path: "虚无", traces: [], rule: luka,
    cones: { "21001": "晚安与睡颜", "21015": "决心如汗珠般闪耀" } },
  "1210": { name: "桂乃芬", element: "火", path: "虚无", traces: [103], rule: guinaifen,
    cones: { "21001": "晚安与睡颜", "21008": "猎物的视线" } },
  "1108": { name: "桑博", element: "风", path: "虚无", traces: [], rule: sampo,
    cones: { "21008": "猎物的视线", "24003": "孤独的疗愈" } },
  "1410": { name: "海瑟音", element: "物理", path: "虚无", traces: [102, 103], stats: ["effPct"], rule: hysilens,
    cones: { "23047": "海洋为何而歌", "21008": "猎物的视线" } },
  "1103": { name: "希露瓦", element: "雷", path: "智识", traces: [103], rule: serval, cones: eruditionCones },
}) as unknown as [string, Character][]);
export const personalDamageNames = [...characters.values()].map(({ name }) => name).join("、");
export const personalDamageEnemyLevel = 80;
export const hasPersonalDamage = (id: string) => characters.has(id);

function tableValue(values: unknown, level: number | undefined) {
  const value: unknown = Array.isArray(values) && level && values[level - 1];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new MissingDamageData("缺少技能等级或叠影数据");
  return value;
}

class MissingDamageData extends Error {
  constructor(message: string, readonly scenarioCount?: number) {
    super(message);
  }
}

function talentValues(avatar: PanelAvatar, metadata: Metadata, rank: number): SkillValues {
  const current = new Map(avatar.skills.map(({ key, level }) => [key, level]));
  const cfg = object(metadata.character.talent);
  const upgrades = object(metadata.character.talentCons);
  return new Proxy(Object.create(null), {
    get(_, key: string) {
      const originalKey = key.replace(/^([aeqtx]|xe|me|mt)[123]$/u, "$1");
      const baseLevel = current.get(originalKey);
      if (!baseLevel || (avatar.legacy && !upgrades)) throw new MissingDamageData("缺少技能等级");
      const upgradeAt = upgrades?.[originalKey];
      const level = avatar.legacy ? starRailLegacySkillLevel(originalKey, baseLevel, rank, upgradeAt) : baseLevel;
      const tables = object(object(cfg?.[key])?.tables);
      const rows = Object.values(tables ?? {}).map(object);
      return new Proxy(Object.create(null), {
        get(_, name) {
          const row = rows.find(row => row?.name === name);
          return tableValue(row?.values, level);
        },
      });
    },
  });
}

function panelValues(avatar: PanelAvatar, metadata: Metadata, character: Character) {
  const attrs = avatar.legacy ? calculateLegacyPanelAttributeRows(avatar, metadata) : avatar.stats;
  if (!attrs) throw new MissingDamageData("面板属性不齐");
  const values: Numbers = Object.create(null);
  const flat: Record<string, Attr> = Object.create(null);
  const element = damageAttribute[character.element];
  for (const stat of attrs) {
    const key = stat.key === element ? "dmg" : stat.key;
    for (const field of ["value", "base"] as const) {
      const raw = stat[field];
      const number = typeof raw === "string" ? Number.parseFloat(raw) : raw;
      if (typeof number === "number" && Number.isFinite(number) && number >= 0) values[field === "base" ? key + "Base" : key] = number;
    }
  }
  for (const key of ["atk", "speed", ...["hp", "def"].filter(key => character.stats?.includes(key))]) {
    if (!values[key + "Base"] || values[key] === undefined) throw new MissingDamageData("缺少角色基础与综合属性");
  }
  for (const key of ["cpct", "cdmg", "dmg", ...(character.stats ?? [])]) {
    if (values[key] === undefined) throw new MissingDamageData("缺少计算所需的战斗属性");
  }
  for (const key of Object.keys(values)) {
    if (key.endsWith("Base")) continue;
    const base = values[key + "Base"] ?? 0;
    flat[key] = { base, plus: values[key]! - base, pct: 0 };
  }
  return { values, staticAttr: flat };
}

function relicEffects(avatar: PanelAvatar, metadata: Metadata) {
  const counts = new Map<string, number>();
  const slots = new Set<number>();
  for (const relic of avatar.relics) {
    const set = metadata.setForId(relic.id);
    if (!set || slots.has(relic.slot)) throw new MissingDamageData("遗器套装或位置不完整");
    slots.add(relic.slot);
    counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  const effects: Buff[] = [];
  const sets: Numbers = {};
  for (const [name, count] of counts) {
    if (count < 2) continue;
    const rule = Object.hasOwn(setRules, name) ? setRules[name] : undefined;
    if (!rule) throw new MissingDamageData(`「${name}」的套装规则尚未接入`);
    sets[name] = count >= 4 ? 4 : 2;
    for (const threshold of [2, 4]) {
      if (count < threshold) continue;
      for (const buff of [rule[threshold] ?? []].flat()) {
        if (!buff.isStatic) effects.push({ ...buff, title: `${name}${threshold}：${buff.title ?? ""}` });
      }
    }
  }
  return { effects, sets };
}

type IndexedBuff = Buff & { idx?: number; key?: string };
type WeaponRule = IndexedBuff | ((tables: Numbers) => IndexedBuff);
type WeaponRules = Readonly<Record<string, readonly WeaponRule[]>>;
const staticIndex = () => ({ isStatic: true });
function dynamicIndex(title: string, key: string | Numbers, idx?: number): WeaponRule {
  if (typeof key === "string") return { title, key, idx };
  return (tables) => ({ title, data: Object.fromEntries(Object.entries(key).map(([attr, index]) => [attr, tables[index]!])) });
}
const weaponRules: Readonly<Record<string, WeaponRules>> = {
  "巡猎": hunt(staticIndex, dynamicIndex), "虚无": nihility(staticIndex, dynamicIndex),
  "智识": erudition(staticIndex, dynamicIndex), "存护": preservation(staticIndex, dynamicIndex),
  "丰饶": abundance(staticIndex, dynamicIndex),
  "毁灭": destruction(staticIndex, dynamicIndex),
  "同谐": harmony(staticIndex, dynamicIndex),
  "记忆": remembrance(staticIndex, dynamicIndex),
};

function weaponEffects(avatar: PanelAvatar, metadata: Metadata, character: Character) {
  const cone = avatar.cone;
  if (!cone) return [];
  const energy = metadata.character.sp;
  if (cone.id === "23018" && (typeof energy !== "number" || !Number.isFinite(energy) || energy <= 0)) {
    throw new MissingDamageData("缺少光锥所需的角色能量上限");
  }
  const name = character.cones[cone.id];
  const configure = name && weaponRules[character.path]?.[name];
  if (!configure || !cone.rank || metadata.conePath !== character.path) {
    throw new MissingDamageData(`当前光锥「${cone.name || cone.id}」的伤害规则尚未接入或缺少叠影`);
  }
  const data = object(object(metadata.cone.skill)?.tables);
  const tables = new Proxy(Object.create(null), { get: (_, key: string) => tableValue(data?.[key], cone.rank) });
  return configure.flatMap(row => {
    const rule = typeof row === "function" ? row(tables) : row;
    if (rule.isStatic) return [];
    const title = rule.title?.includes("：") ? rule.title : `${name}：${rule.title ?? ""}`;
    return { ...rule, title, data: rule.idx && rule.key ? { [rule.key]: tables[rule.idx] } : rule.data };
  });
}

function originalDamage(
  avatar: PanelAvatar, metadata: Metadata, scenario: number | undefined,
  character: Character,
) {
  if (!avatar.level || avatar.rank === undefined || metadata.character.elem !== character.element ||
      (avatar.element && avatar.element !== character.element)) throw new MissingDamageData("缺少角色等级、星魂或元素资料");
  const { rule } = character;
  const rank = avatar.rank;
  const level = avatar.level;
  const knownTraces = new Map(avatar.traces.map(trace => [trace.id.match(/^1?\d{4}(\d{3})$/u)?.[1], trace.active]));
  if (!avatar.legacy && character.traces.some(trace => !knownTraces.has(String(trace)))) {
    throw new MissingDamageData("缺少对应的行迹状态");
  }
  const trees = Object.fromEntries([...knownTraces].filter(([id, active]) => id && active));
  const talent = talentValues(avatar, metadata, rank);
  const { values, staticAttr } = panelValues(avatar, metadata, character);
  const originalAttr = DmgAttr.getAttr({ game: "sr", originalAttr: undefined, attr: { ...values, staticAttr },
    char: { elem: character.element, sp: metadata.character.sp }, weapon: { affix: avatar.cone?.rank ?? 1 } });
  const weaponBuffs = weaponEffects(avatar, metadata, character);
  const relics = relicEffects(avatar, metadata);
  if (relics.sets["荡除蠹灾的铁骑"] === 4 && values.stance === undefined) throw new MissingDamageData("缺少击破特攻属性");
  if (relics.sets["谧宁拾骨地"] === 2 && values.hp === undefined) throw new MissingDamageData("缺少套装所需的生命属性");
  if (relics.sets["泛银河商业公司"] === 2 && values.effPct === undefined) throw new MissingDamageData("缺少套装所需的效果命中属性");
  const buffs = [...(rule.buffs ?? []), ...weaponBuffs, ...relics.effects].sort((a, b) => (a.sort ?? 1) - (b.sort ?? 1));
  const weapon = { ...avatar.cone, name: avatar.cone ? character.cones[avatar.cone.id] : "", affix: avatar.cone?.rank ?? 0 };
  const meta = { characterName: character.name, cons: rank, level, trees, talent, weapon };
  const defaultParams = (typeof rule.defParams === "function" ? rule.defParams(meta as unknown as Variables) : rule.defParams) ?? {};

  function calculate(detail: Rule["details"][number], incAttr = "", reduceAttr = "") {
    const params = { ...defaultParams, ...detail.params };
    const { attr, msg } = DmgAttr.calcAttr({
      originalAttr, buffs, meta: { ...meta }, artis: relics.sets, params, incAttr, reduceAttr, game: "sr",
    });
    const ds = { ...DmgAttr.getDs(attr, meta, params), artis: relics.sets };
    const variables = ds as unknown as Variables;
    if (detail.check && !detail.check(variables)) return;
    const damage = DmgCalc.getDmgFn({ ds, attr, level, enemyLv: personalDamageEnemyLevel, game: "sr", showDetail: false }) as unknown as DamageFn;
    const { heal, shield } = damage;
    damage.heal = amount => ({ ...heal(amount), metric: "heal" });
    damage.shield = amount => ({ ...shield(amount), metric: "shield" });
    const { dmg, avg, metric = "damage" } = detail.dmg(variables, damage);
    if (!Number.isFinite(avg) || (dmg !== undefined && !Number.isFinite(dmg))) throw new MissingDamageData("原规则所需数据不齐");
    const title = typeof detail.title === "function" ? detail.title(variables) : detail.title;
    return { title, critical: dmg, average: avg, metric, active: msg as string[] };
  }

  const scenarios = rule.details.flatMap((detail, index) => {
    if (detail.cons && detail.cons > rank) return [];
    const result = calculate(detail);
    return result ? [{ detail, index, row: result }] : [];
  });
  const defaultIndex = scenarios.findIndex(row => row.index === rule.defDmgIdx);
  const selected = scenario === undefined ? Math.max(0, defaultIndex) : scenario - 1;
  const current = scenarios[selected];
  if (!current || (scenario !== undefined && !Number.isInteger(scenario))) {
    throw new MissingDamageData("伤害场景序号无效", scenarios.length);
  }
  const statKeys = rule.mainAttr.split(",") as (keyof typeof attrMap)[];
  const swaps = statKeys.map(from => ({
    title: attrMap[from].title, amount: String(attrMap[from].value) + (from === "speed" ? "" : "%"),
    values: statKeys.map(to => {
      if (from === to) return;
      const result = calculate(current.detail, to, from);
      return result && { critical: result.critical, average: result.average };
    }),
  }));
  return { name: character.name, element: character.element, rows: scenarios.map(({ row }) => row), swaps, selected, buffs: current.row.active };
}

export function readStarRailPersonalDamage(avatar: PanelAvatar, metadata: Metadata, scenario?: number) {
  const character = characters.get(avatar.id);
  if (!character) return { reason: "该星铁角色的个人伤害规则尚未接入", scenarioCount: undefined } as const;
  try {
    return { damage: originalDamage(avatar, metadata, scenario, character) } as const;
  } catch (error) {
    if (!(error instanceof MissingDamageData)) throw error;
    return { reason: error.message, scenarioCount: error.scenarioCount } as const;
  }
}

export function calculateStarRailPersonalDamage(avatar: PanelAvatar, metadata: Metadata, scenario?: number) {
  return readStarRailPersonalDamage(avatar, metadata, scenario).damage;
}

export type StarRailPersonalDamage = ReturnType<typeof originalDamage>;
