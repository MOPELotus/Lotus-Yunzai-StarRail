import type { TrialTitleMode } from "../../lib/panel-trial-display.ts";
import { calculateLegacyPanelAttributeRows, calculateManagedElation, damageAttribute, type PanelAttributeRows } from "./panel-attributes.ts";
import type { readPanelDamageMetadata } from "./panel-card.ts";
import { object, starRailLegacySkillLevel, type PanelAvatar } from "./panel-model.ts";
import DmgAttr from "./panel-damage-rules/DmgAttr.ts";
import DmgCalc from "./panel-damage-rules/DmgCalc.ts";
import { attrMap } from "./panel-damage-rules/relic-attributes.ts";
import relicRules from "./panel-damage-rules/relics.ts";
import * as seele from "./panel-damage-rules/characters/seele.ts";
import * as acheron from "./panel-damage-rules/characters/acheron.ts";
import * as aventurine from "./panel-damage-rules/characters/aventurine.ts";
import * as theHerta from "./panel-damage-rules/characters/the-herta.ts";
import * as blackSwan from "./panel-damage-rules/characters/black-swan.ts";
import * as kafka from "./panel-damage-rules/characters/kafka.ts";
import * as kafkaEnhanced from "./panel-damage-rules/characters/kafka-enhanced.ts";
import * as jingYuan from "./panel-damage-rules/characters/jing-yuan.ts";
import * as feixiao from "./panel-damage-rules/characters/feixiao.ts";
import * as lingsha from "./panel-damage-rules/characters/lingsha.ts";
import * as yunli from "./panel-damage-rules/characters/yunli.ts";
import * as boothill from "./panel-damage-rules/characters/boothill.ts";
import * as drRatio from "./panel-damage-rules/characters/dr-ratio.ts";
import * as imbibitorLunae from "./panel-damage-rules/characters/imbibitor-lunae.ts";
import * as firefly from "./panel-damage-rules/characters/firefly.ts";
import * as fireflyEnhanced from "./panel-damage-rules/characters/firefly-enhanced.ts";
import * as fugue from "./panel-damage-rules/characters/fugue.ts";
import * as ruanMei from "./panel-damage-rules/characters/ruan-mei.ts";
import * as blade from "./panel-damage-rules/characters/blade.ts";
import * as bladeEnhanced from "./panel-damage-rules/characters/blade-enhanced.ts";
import * as tribbie from "./panel-damage-rules/characters/tribbie.ts";
import * as bailu from "./panel-damage-rules/characters/bailu.ts";
import * as welt from "./panel-damage-rules/characters/welt.ts";
import * as weltEnhanced from "./panel-damage-rules/characters/welt-enhanced.ts";
import * as silverWolf from "./panel-damage-rules/characters/silver-wolf.ts";
import * as jiaoqiu from "./panel-damage-rules/characters/jiaoqiu.ts";
import * as jingliu from "./panel-damage-rules/characters/jingliu.ts";
import * as jingliuEnhanced from "./panel-damage-rules/characters/jingliu-enhanced.ts";
import * as yanqing from "./panel-damage-rules/characters/yanqing.ts";
import * as misha from "./panel-damage-rules/characters/misha.ts";
import * as argenti from "./panel-damage-rules/characters/argenti.ts";
import * as herta from "./panel-damage-rules/characters/herta.ts";
import * as himeko from "./panel-damage-rules/characters/himeko.ts";
import * as jade from "./panel-damage-rules/characters/jade.ts";
import * as castorice from "./panel-damage-rules/characters/castorice.ts";
import * as aglaea from "./panel-damage-rules/characters/aglaea.ts";
import * as evernight from "./panel-damage-rules/characters/evernight.ts";
import * as luocha from "./panel-damage-rules/characters/luocha.ts";
import * as natasha from "./panel-damage-rules/characters/natasha.ts";
import * as gallagher from "./panel-damage-rules/characters/gallagher.ts";
import * as huohuo from "./panel-damage-rules/characters/huohuo.ts";
import * as clara from "./panel-damage-rules/characters/clara.ts";
import * as xueyi from "./panel-damage-rules/characters/xueyi.ts";
import * as arlan from "./panel-damage-rules/characters/arlan.ts";
import * as hook from "./panel-damage-rules/characters/hook.ts";
import * as topaz from "./panel-damage-rules/characters/topaz.ts";
import * as moze from "./panel-damage-rules/characters/moze.ts";
import * as danHeng from "./panel-damage-rules/characters/dan-heng.ts";
import * as sushang from "./panel-damage-rules/characters/sushang.ts";
import * as archer from "./panel-damage-rules/characters/archer.ts";
import * as marchHunt from "./panel-damage-rules/characters/march-hunt.ts";
import * as luka from "./panel-damage-rules/characters/luka.ts";
import * as guinaifen from "./panel-damage-rules/characters/guinaifen.ts";
import * as sampo from "./panel-damage-rules/characters/sampo.ts";
import * as hysilens from "./panel-damage-rules/characters/hysilens.ts";
import * as serval from "./panel-damage-rules/characters/serval.ts";
import * as bronya from "./panel-damage-rules/characters/bronya.ts";
import * as tingyun from "./panel-damage-rules/characters/tingyun.ts";
import * as asta from "./panel-damage-rules/characters/asta.ts";
import * as robin from "./panel-damage-rules/characters/robin.ts";
import * as sparkle from "./panel-damage-rules/characters/sparkle.ts";
import * as sunday from "./panel-damage-rules/characters/sunday.ts";
import * as hanya from "./panel-damage-rules/characters/hanya.ts";
import * as yukong from "./panel-damage-rules/characters/yukong.ts";
import * as harmonyTrailblazer from "./panel-damage-rules/characters/harmony-trailblazer.ts";
import * as fuXuan from "./panel-damage-rules/characters/fu-xuan.ts";
import * as gepard from "./panel-damage-rules/characters/gepard.ts";
import * as marchPreservation from "./panel-damage-rules/characters/march-preservation.ts";
import * as preservationTrailblazer from "./panel-damage-rules/characters/preservation-trailblazer.ts";
import * as danHengPermansor from "./panel-damage-rules/characters/danheng-permansor.ts";
import * as saber from "./panel-damage-rules/characters/saber.ts";
import * as mydei from "./panel-damage-rules/characters/mydei.ts";
import * as phainon from "./panel-damage-rules/characters/phainon.ts";
import * as destructionTrailblazer from "./panel-damage-rules/characters/destruction-trailblazer.ts";
import * as anaxa from "./panel-damage-rules/characters/anaxa.ts";
import * as qingque from "./panel-damage-rules/characters/qingque.ts";
import * as pela from "./panel-damage-rules/characters/pela.ts";
import * as cipher from "./panel-damage-rules/characters/cipher.ts";
import * as seeleEnhanced from "./panel-damage-rules/characters/seele-enhanced.ts";
import * as lynx from "./panel-damage-rules/characters/lynx.ts";
import * as hyacine from "./panel-damage-rules/characters/hyacine.ts";
import * as cyrene from "./panel-damage-rules/characters/cyrene.ts";
import * as mortenaxBlade from "./panel-damage-rules/characters/mortenax-blade.ts";
import * as dahlia from "./panel-damage-rules/characters/dahlia.ts";
import * as silverWolfEnhanced from "./panel-damage-rules/characters/silver-wolf-enhanced.ts";
import * as ashveil from "./panel-damage-rules/characters/ashveil.ts";
import * as gilgamesh from "./panel-damage-rules/characters/gilgamesh.ts";
import * as elationTrailblazer from "./panel-damage-rules/characters/elation-trailblazer.ts";
import * as sparxie from "./panel-damage-rules/characters/sparxie.ts";
import * as yaoGuang from "./panel-damage-rules/characters/yao-guang.ts";
import * as pearl from "./panel-damage-rules/characters/pearl.ts";
import * as evanescia from "./panel-damage-rules/characters/evanescia.ts";
import elation from "./panel-damage-rules/weapons/elation.ts";
import * as himekoNova from "./panel-damage-rules/characters/himeko-nova.ts";
import * as aha from "./panel-damage-rules/characters/aha.ts";
import * as robinDahlia from "./panel-damage-rules/characters/robin-dahlia.ts";
import * as aventurineElation from "./panel-damage-rules/characters/aventurine-elation.ts";
import * as tohsakaRin from "./panel-damage-rules/characters/tohsaka-rin.ts";
import * as silverWolfElation from "./panel-damage-rules/characters/silver-wolf-elation.ts";
import * as cerydra from "./panel-damage-rules/characters/cerydra.ts";
import hunt from "./panel-damage-rules/weapons/hunt.ts";
import nihility from "./panel-damage-rules/weapons/nihility.ts";
import erudition from "./panel-damage-rules/weapons/erudition.ts";
import preservation from "./panel-damage-rules/weapons/preservation.ts";
import abundance from "./panel-damage-rules/weapons/abundance.ts";
import destruction from "./panel-damage-rules/weapons/destruction.ts";
import harmony from "./panel-damage-rules/weapons/harmony.ts";
import remembrance from "./panel-damage-rules/weapons/remembrance.ts";

import type { BaseAttr as Attr, Buff, DamageValue, DamageMetric, Numbers, Rule, SkillValues, Variables, WeaponRule, WeaponRules } from "./panel-damage-rules/types.ts";

type Metadata = NonNullable<Awaited<ReturnType<typeof readPanelDamageMetadata>>>;
export const personalDamageMetricLabel: Readonly<Record<DamageMetric, string>> = { damage: "期望伤害", shield: "护盾量", heal: "治疗量", support: "辅助效果" };
type DamageRow = {
  title: string;
  metric: DamageMetric;
  active: string[];
  critical?: number;
  display?: string;
  percentage?: string;
} & ({ average: number; note?: never } | { average?: never; note: string });
type DamageScenario = DamageRow & {
  readonly scenario: number;
  readonly change?: { readonly critical?: number; readonly average?: number };
};
type Character = {
  name: string;
  element: string;
  path: string;
  traces: readonly number[];
  stats?: readonly string[];
  requiresEnergy?: boolean;
  rule: Rule;
  cones: Readonly<Record<string, string>>;
};
const setRules: Readonly<Record<string, Readonly<Record<number, Buff | Buff[]>>>> = relicRules;
const destructionCones = {
  "20002": "天倾",
  "20009": "乐圮",
  "20016": "俱殁",
  "21005": "鼹鼠党欢迎你",
  "21012": "秘密誓心",
  "21019": "在蓝天下",
  "21026": "汪！散步时间！",
  "21033": "无处可逃",
  "21038": "在火的远处",
  "21042": "铭记于心的约定",
  "21058": "一行往日的血",
  "22003": "忍事录•音律狩猎",
  "23002": "无可取代的东西",
  "23009": "到不了的彼岸",
  "23014": "此身为剑",
  "23015": "比阳光更明亮的",
  "23025": "梦应归于何处",
  "23030": "落日时起舞",
  "23039": "血火啊，燃烧前路",
  "23044": "黎明恰如此燃烧",
  "23045": "没有回报的加冕",
  "23062": "所见即我",
  "24000": "记一位星神的陨落",
};
const huntCones = {
  "20000": "锋镝",
  "20007": "离弦",
  "20014": "相抗",
  "21003": "唯有沉默",
  "21010": "论剑",
  "21017": "点个关注吧！",
  "21024": "春水初生",
  "21031": "重返幽冥",
  "21037": "最后的赢家",
  "21047": "黑夜如影随行",
  "21062": "于那终点再见",
  "22008": "向着地平线的终点",
  "23001": "于夜色中",
  "23012": "如泥酣眠",
  "23016": "烦恼着，幸福着",
  "23020": "纯粹思维的洗礼",
  "23027": "驶向第二次生命",
  "23031": "我将，巡征追猎",
  "23046": "理想燃烧的地狱",
  "23056": "一场谎言的终幕",
  "24001": "星海巡航",
};
const nihilityCones = {
  "20004": "幽邃",
  "20011": "渊环",
  "20018": "匿影",
  "21001": "晚安与睡颜",
  "21008": "猎物的视线",
  "21015": "决心如汗珠般闪耀",
  "21022": "延长记号",
  "21029": "后会有期",
  "21041": "好戏开演",
  "21044": "无边曼舞",
  "21061": "假日浴场大冒险",
  "22000": "新手任务开始前",
  "23004": "以世界之名",
  "23006": "只需等待",
  "23007": "雨一直下",
  "23022": "重塑时光之忆",
  "23024": "行于流逝的岸",
  "23029": "那无数个春天",
  "23035": "长路终有归途",
  "23043": "谎言在风中飘扬",
  "23047": "海洋为何而歌",
  "23050": "勿忘她的火焰",
  "23059": "灼尽炼狱的新骸",
  "24003": "孤独的疗愈",
};
const eruditionCones = {
  "20006": "智库",
  "20013": "灵钥",
  "20020": "睿见",
  "21006": "「我」的诞生",
  "21013": "别让世界静下来",
  "21020": "天才们的休憩",
  "21027": "早餐的仪式感",
  "21034": "今日亦是和平的一日",
  "21040": "银河沦陷日",
  "21045": "谐乐静默之后",
  "21060": "氤氲麦香的梦",
  "22004": "宇宙大生意",
  "23000": "银河铁道之夜",
  "23010": "拂晓之前",
  "23018": "片刻，留在眼底",
  "23028": "偏偏希望无价",
  "23033": "忍法帖•缭乱破魔",
  "23037": "向着不可追问处",
  "23041": "生命当付之一炬",
  "23060": "当一颗星照亮夜空",
  "23061": "星火悄然闪耀",
  "24004": "不息的演算",
};
const remembranceCones = {
  "20021": "焚影",
  "20022": "溯忆",
  "21050": "胜利只在朝夕间",
  "21051": "天才们的问候",
  "21052": "多流汗，少流泪",
  "21054": "故事的下一页",
  "21057": "花儿不会忘记",
  "22006": "飞向粉色的明天",
  "23036": "将光阴织成黄金",
  "23040": "让告别，更美一些",
  "23042": "愿虹光永驻天空",
  "23049": "致长夜的星光",
  "23052": "爱如此刻永恒",
  "23063": "你将起身歌唱",
  "24005": "记忆永不落幕",
};
const harmonyCones = {
  "20005": "齐颂",
  "20012": "轮契",
  "20019": "调和",
  "21004": "记忆中的模样",
  "21011": "与行星相会",
  "21018": "舞！舞！舞！",
  "21025": "过往未来",
  "21032": "镂月裁云之意",
  "21036": "美梦小镇大冒险",
  "21046": "芳华待灼",
  "21056": "追逐风的时候",
  "22002": "为了明日的旅途",
  "22005": "永远的迷境饭",
  "23003": "但战斗还未结束",
  "23019": "镜中故我",
  "23021": "游戏尘寰",
  "23026": "夜色流光溢彩",
  "23034": "回到大地的飞行",
  "23038": "如果时间是一朵花",
  "23048": "金血铭刻的时代",
};
const preservationCones = {
  "20003": "琥珀",
  "20010": "戍御",
  "20017": "开疆",
  "21002": "余生的第一天",
  "21009": "朗道的选择",
  "21016": "宇宙市场趋势",
  "21023": "我们是地火",
  "21030": "这就是我啦！",
  "21039": "织造命运之线",
  "21043": "两个人的演唱会",
  "21053": "愿旅途永远坦然",
  "23005": "制胜的瞬间",
  "23011": "她已闭上双眼",
  "23023": "命运从未公平",
  "23051": "纵然山河万程",
  "24002": "记忆的质料",
};
const elationCones = {
  "20023": "嗤笑",
  "20024": "残泪",
  "21064": "菇菇嘎嘎历险记",
  "21065": "今日好手气",
  "21066": "放个短假",
  "22007": "未来，有我们一起",
  "22009": "在世界尽头相会吧！",
  "23053": "花花世界迷人眼",
  "23054": "当她决定看见",
  "23055": "献给明日的色彩",
  "23057": "欢迎来到银河城",
  "23058": "邂逅于下一个花季",
  "23064": "向浪花掷下盛夏",
  "23065": "当第一声「阿哈」响起",
  "24006": "欢愉满溢祝福",
};
const abundanceCones = {
  "20001": "物穰",
  "20008": "嘉果",
  "20015": "蕃息",
  "21000": "一场术后对话",
  "21007": "同一种心情",
  "21014": "此时恰好",
  "21021": "等价交换",
  "21028": "暖夜不会漫长",
  "21035": "何物为真",
  "21048": "梦的蒙太奇",
  "21055": "直到明天的明天",
  "22001": "嘿，我在这儿",
  "23008": "棺的回响",
  "23013": "时节不居",
  "23017": "惊魂夜",
  "23032": "唯有香如故",
};

// The original rules share DmgAttr's numeric AttrItem coercion and variable shape.
const characters: ReadonlyMap<string, Character> = new Map(Object.entries({
  "1102": { name: "希儿", element: "量子", path: "巡猎", traces: [102], rule: seele,
    cones: huntCones },
  "1308": { name: "黄泉", element: "雷", path: "虚无", traces: [102, 103], rule: acheron,
    cones: nihilityCones },
  "1401": { name: "大黑塔", element: "冰", path: "智识", traces: [101, 102, 103], rule: theHerta,
    cones: eruditionCones },
  "1304": { name: "砂金", element: "虚数", path: "存护", traces: [102], stats: ["def"], rule: aventurine,
    cones: preservationCones },
  "1307": { name: "黑天鹅", element: "风", path: "虚无", traces: [103], stats: ["effPct"], rule: blackSwan, cones: nihilityCones },
  "1005": { name: "卡芙卡", element: "雷", path: "虚无", traces: [], rule: kafka, cones: nihilityCones },
  "2005": { name: "卡芙卡Pro", element: "雷", path: "虚无", traces: [103], stats: ["effPct"], rule: kafkaEnhanced, cones: nihilityCones },
  "1204": { name: "景元", element: "雷", path: "智识", traces: [101, 103], rule: jingYuan,
    cones: eruditionCones },
  "1220": { name: "飞霄", element: "风", path: "巡猎", traces: [102, 103], rule: feixiao,
    cones: huntCones },
  "1222": { name: "灵砂", element: "火", path: "丰饶", traces: [101], stats: ["stance", "heal"], rule: lingsha,
    cones: abundanceCones },
  "1221": { name: "云璃", element: "物理", path: "毁灭", traces: [103], rule: yunli,
    cones: destructionCones },
  "1315": { name: "波提欧", element: "物理", path: "巡猎", traces: [101], stats: ["stance"], rule: boothill,
    cones: huntCones },
  "1305": { name: "真理医生", element: "虚数", path: "巡猎", traces: [102, 103], rule: drRatio,
    cones: huntCones },
  "1213": { name: "丹恒•饮月", element: "虚数", path: "毁灭", traces: [103], rule: imbibitorLunae,
    cones: destructionCones },
  "1310": { name: "流萤", element: "火", path: "毁灭", traces: [103], stats: ["stance"], rule: firefly,
    cones: destructionCones },
  "2310": { name: "流萤Pro", element: "火", path: "毁灭", traces: [101, 103], stats: ["stance"], rule: fireflyEnhanced,
    cones: destructionCones },
  "1225": { name: "忘归人", element: "火", path: "虚无", traces: [102], stats: ["stance"], rule: fugue,
    cones: nihilityCones },
  "1303": { name: "阮•梅", element: "冰", path: "同谐", traces: [101], stats: ["stance"], rule: ruanMei,
    cones: harmonyCones },
  "1205": { name: "刃", element: "风", path: "毁灭", traces: [102], stats: ["hp"], rule: blade, cones: destructionCones },
  "2205": { name: "刃Pro", element: "风", path: "毁灭", traces: [103], stats: ["hp"], rule: bladeEnhanced, cones: destructionCones },
  "1403": { name: "缇宝", element: "量子", path: "同谐", traces: [101, 102], stats: ["hp"], rule: tribbie,
    cones: harmonyCones },
  "1211": { name: "白露", element: "雷", path: "丰饶", traces: [], stats: ["hp", "heal"], rule: bailu,
    cones: abundanceCones },
  "1004": { name: "瓦尔特", element: "虚数", path: "虚无", traces: [101, 103], rule: welt, cones: nihilityCones },
  "2004": { name: "瓦尔特Pro", element: "虚数", path: "虚无", traces: [101, 102, 103], stats: ["effPct"], rule: weltEnhanced, cones: nihilityCones },
  "1006": { name: "银狼", element: "量子", path: "虚无", traces: [102], stats: ["stance"], rule: silverWolf,
    cones: nihilityCones },
  "1218": { name: "椒丘", element: "火", path: "虚无", traces: [102], stats: ["effPct"], rule: jiaoqiu,
    cones: nihilityCones },
  "1212": { name: "镜流", element: "冰", path: "毁灭", traces: [103], rule: jingliu, cones: destructionCones },
  "2212": { name: "镜流Pro", element: "冰", path: "毁灭", traces: [101, 103], stats: ["hp"], rule: jingliuEnhanced, cones: destructionCones },
  "1209": { name: "彦卿", element: "冰", path: "巡猎", traces: [101, 103], rule: yanqing,
    cones: huntCones },
  "1312": { name: "米沙", element: "冰", path: "毁灭", traces: [102, 103], rule: misha,
    cones: destructionCones },
  "1302": { name: "银枝", element: "物理", path: "智识", traces: [], rule: argenti,
    cones: eruditionCones },
  "1013": { name: "黑塔", element: "冰", path: "智识", traces: [101, 103], rule: herta,
    cones: eruditionCones },
  "1003": { name: "姬子", element: "火", path: "智识", traces: [102, 103], rule: himeko,
    cones: eruditionCones },
  "1314": { name: "翡翠", element: "量子", path: "智识", traces: [103], rule: jade,
    cones: eruditionCones },
  "1407": { name: "遐蝶", element: "量子", path: "记忆", traces: [], stats: ["hp"], rule: castorice,
    cones: remembranceCones },
  "1402": { name: "阿格莱雅", element: "雷", path: "记忆", traces: [101], rule: aglaea,
    cones: remembranceCones },
  "1413": { name: "长夜月", element: "冰", path: "记忆", traces: [101, 103], stats: ["hp"], rule: evernight,
    cones: remembranceCones },
  "1203": { name: "罗刹", element: "虚数", path: "丰饶", traces: [], stats: ["heal"], rule: luocha,
    cones: abundanceCones },
  "1105": { name: "娜塔莎", element: "物理", path: "丰饶", traces: [102], stats: ["hp", "heal"], rule: natasha,
    cones: abundanceCones },
  "1301": { name: "加拉赫", element: "火", path: "丰饶", traces: [101], stats: ["heal", "stance"], rule: gallagher,
    cones: abundanceCones },
  "1217": { name: "藿藿", element: "风", path: "丰饶", traces: [], stats: ["hp", "heal"], rule: huohuo, cones: abundanceCones },
  "2217": { name: "藿藿Pro", element: "风", path: "丰饶", traces: [], stats: ["hp", "heal"], rule: huohuo, cones: abundanceCones },
  "1107": { name: "克拉拉", element: "物理", path: "毁灭", traces: [103], rule: clara,
    cones: destructionCones },
  "1214": { name: "雪衣", element: "量子", path: "毁灭", traces: [101, 102], stats: ["stance"], rule: xueyi,
    cones: destructionCones },
  "1008": { name: "阿兰", element: "雷", path: "毁灭", traces: [], rule: arlan,
    cones: destructionCones },
  "1109": { name: "虎克", element: "火", path: "毁灭", traces: [], rule: hook,
    cones: destructionCones },
  "1112": { name: "托帕&账账", element: "火", path: "巡猎", traces: [101, 102], rule: topaz,
    cones: huntCones },
  "1223": { name: "貊泽", element: "雷", path: "巡猎", traces: [103], rule: moze,
    cones: huntCones },
  "1002": { name: "丹恒", element: "风", path: "巡猎", traces: [103], rule: danHeng,
    cones: huntCones },
  "1206": { name: "素裳", element: "物理", path: "巡猎", traces: [101], rule: sushang,
    cones: huntCones },
  "1015": { name: "Archer", element: "量子", path: "巡猎", traces: [102], rule: archer,
    cones: huntCones },
  "1224": { name: "三月七·巡猎", element: "虚数", path: "巡猎", traces: [], rule: marchHunt,
    cones: huntCones },
  "1111": { name: "卢卡", element: "物理", path: "虚无", traces: [], rule: luka,
    cones: nihilityCones },
  "1210": { name: "桂乃芬", element: "火", path: "虚无", traces: [103], rule: guinaifen,
    cones: nihilityCones },
  "1108": { name: "桑博", element: "风", path: "虚无", traces: [], rule: sampo,
    cones: nihilityCones },
  "1410": { name: "海瑟音", element: "物理", path: "虚无", traces: [102, 103], stats: ["effPct"], rule: hysilens,
    cones: nihilityCones },
  "1103": { name: "希露瓦", element: "雷", path: "智识", traces: [103], rule: serval, cones: eruditionCones },
  "1101": { name: "布洛妮娅", element: "风", path: "同谐", traces: [101, 103], rule: bronya,
    cones: harmonyCones },
  "1202": { name: "停云", element: "雷", path: "同谐", traces: [102], rule: tingyun,
    cones: harmonyCones },
  "1009": { name: "艾丝妲", element: "火", path: "同谐", traces: [103], rule: asta,
    cones: harmonyCones },
  "1309": { name: "知更鸟", element: "物理", path: "同谐", traces: [], rule: robin,
    cones: harmonyCones },
  "1306": { name: "花火", element: "量子", path: "同谐", traces: [], rule: sparkle,
    cones: harmonyCones },
  "1313": { name: "星期日", element: "虚数", path: "同谐", traces: [], rule: sunday,
    cones: harmonyCones },
  "1215": { name: "寒鸦", element: "物理", path: "同谐", traces: [], rule: hanya,
    cones: harmonyCones },
  "1207": { name: "驭空", element: "虚数", path: "同谐", traces: [101], rule: yukong,
    cones: harmonyCones },
  "8005": { name: "穹·同谐", element: "虚数", path: "同谐", traces: [101, 102], stats: ["stance"],
    rule: harmonyTrailblazer, cones: harmonyCones },
  "8006": { name: "星·同谐", element: "虚数", path: "同谐", traces: [101, 102], stats: ["stance"],
    rule: harmonyTrailblazer, cones: harmonyCones },
  "1208": { name: "符玄", element: "量子", path: "存护", traces: [], stats: ["hp", "heal"], rule: fuXuan,
    cones: preservationCones },
  "1104": { name: "杰帕德", element: "冰", path: "存护", traces: [103], stats: ["def"], rule: gepard,
    cones: preservationCones },
  "1001": { name: "三月七", element: "冰", path: "存护", traces: [], stats: ["def"], rule: marchPreservation,
    cones: preservationCones },
  "8003": { name: "穹·存护", element: "火", path: "存护", traces: [], stats: ["def"],
    rule: preservationTrailblazer, cones: preservationCones },
  "8004": { name: "星·存护", element: "火", path: "存护", traces: [], stats: ["def"],
    rule: preservationTrailblazer, cones: preservationCones },
  "1414": { name: "丹恒•腾荒", element: "物理", path: "存护", traces: [103], rule: danHengPermansor,
    cones: preservationCones },
  "1014": { name: "Saber", element: "风", path: "毁灭", traces: [101, 103], rule: saber,
    cones: destructionCones },
  "1404": { name: "万敌", element: "虚数", path: "毁灭", traces: [103], stats: ["hp"], rule: mydei,
    cones: destructionCones },
  "1408": { name: "白厄", element: "物理", path: "毁灭", traces: [102, 103], rule: phainon,
    cones: destructionCones },
  "8001": { name: "穹·毁灭", element: "物理", path: "毁灭", traces: [102, 103],
    rule: destructionTrailblazer, cones: destructionCones },
  "8002": { name: "星·毁灭", element: "物理", path: "毁灭", traces: [102, 103],
    rule: destructionTrailblazer, cones: destructionCones },
  "1405": { name: "那刻夏", element: "风", path: "智识", traces: [102, 103], rule: anaxa,
    cones: eruditionCones },
  "1201": { name: "青雀", element: "量子", path: "智识", traces: [102, 103], rule: qingque, cones: eruditionCones },
  "1106": { name: "佩拉", element: "冰", path: "虚无", traces: [101, 102, 103], rule: pela,
    cones: nihilityCones },
  "1406": { name: "赛飞儿", element: "量子", path: "虚无", traces: [101, 103], rule: cipher,
    cones: nihilityCones },
  "2102": { name: "希儿Pro", element: "量子", path: "巡猎", traces: [101, 102], rule: seeleEnhanced,
    cones: huntCones },
  "1110": { name: "玲可", element: "量子", path: "丰饶", traces: [], stats: ["hp", "heal"], rule: lynx,
    cones: abundanceCones },
  "1409": { name: "风堇", element: "风", path: "记忆", traces: [101, 103], stats: ["hp", "heal"], rule: hyacine,
    cones: remembranceCones },
  "1415": { name: "昔涟", element: "冰", path: "记忆", traces: [103], stats: ["hp"], rule: cyrene,
    cones: remembranceCones },
  "1507": { name: "千冶•刃", element: "火", path: "虚无", traces: [103], stats: ["hp"], rule: mortenaxBlade,
    cones: nihilityCones },
  "1321": { name: "大丽花", element: "火", path: "虚无", traces: [], stats: ["stance"], rule: dahlia,
    cones: nihilityCones },
  "2006": { name: "银狼Pro", element: "量子", path: "虚无", traces: [103], stats: ["effPct", "stance"], rule: silverWolfEnhanced,
    cones: nihilityCones },
  "1504": { name: "不死途", element: "雷", path: "巡猎", traces: [102, 103], rule: ashveil,
    cones: huntCones },
  "1509": { name: "吉尔伽美什", element: "雷", path: "毁灭", traces: [102, 103], requiresEnergy: true, rule: gilgamesh,
    cones: destructionCones },
  "8009": { name: "穹·欢愉", element: "雷", path: "欢愉", traces: [101, 102], rule: elationTrailblazer, cones: elationCones },
  "8010": { name: "星·欢愉", element: "雷", path: "欢愉", traces: [101, 102], rule: elationTrailblazer, cones: elationCones },
  "1501": { name: "火花", element: "火", path: "欢愉", traces: [101, 102, 103], rule: sparxie,
    cones: elationCones },
  "1502": { name: "爻光", element: "物理", path: "欢愉", traces: [101, 102], rule: yaoGuang,
    cones: elationCones },
  "1503": { name: "真珠", element: "冰", path: "欢愉", traces: [101], stats: ["def", "heal", "effDef"], rule: pearl,
    cones: elationCones },
  "1505": { name: "绯英", element: "物理", path: "欢愉", traces: [101], requiresEnergy: true, stats: ["recharge"], rule: evanescia,
    cones: elationCones },
  "1510": { name: "姬子•启行", element: "火", path: "智识", traces: [], rule: himekoNova,
    cones: eruditionCones },
  "1511": { name: "星神★阿哈", element: "量子", path: "欢愉", traces: [103], rule: aha,
    cones: elationCones },
  "1512": { name: "知更鸟•晴歌", element: "风", path: "记忆", traces: [103], stats: ["hp"], rule: robinDahlia,
    cones: remembranceCones },
  "1513": { name: "砂金•戏浪", element: "量子", path: "欢愉", traces: [101, 102, 103], stats: ["hp"], rule: aventurineElation,
    cones: elationCones },
  "1508": { name: "远坂凛", element: "量子", path: "智识", traces: [101], rule: tohsakaRin,
    cones: eruditionCones },
  "1506": { name: "银狼LV.999", element: "虚数", path: "欢愉", traces: [101], rule: silverWolfElation,
    cones: elationCones },
  "1412": { name: "刻律德菈", element: "风", path: "同谐", traces: [101, 102, 103], rule: cerydra,
    cones: harmonyCones },
} satisfies Record<string, Character>));
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

function talentValues(avatar: PanelAvatar, metadata: Metadata, rank: number, skillPreview: boolean): SkillValues {
  const current = new Map(avatar.skills.map(skill => [skill.key, skill]));
  const cfg = object(metadata.character.talent);
  const upgrades = object(metadata.character.talentCons);
  return new Proxy(Object.create(null), {
    get(_, key: string) {
      const originalKey = key.replace(/^([aeqtx]|xe|me|mt)[123]$/u, "$1");
      const skill = current.get(originalKey);
      // The old profile rules use Lv.1 for secondary skill records missing from PlayerData.
      const optional = ["xe", "me", "mt"].includes(originalKey) && (avatar.legacy || skillPreview);
      const missing = skill ? !skill.level : !optional;
      if (missing || (avatar.legacy && !upgrades)) throw new MissingDamageData("缺少技能等级");
      const upgradeAt = upgrades?.[originalKey];
      const level = !skill ? 1 : avatar.legacy && skill.original === undefined && !skill.effective
        ? starRailLegacySkillLevel(originalKey, skill.level, rank, upgradeAt) : skill.level;
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

function panelValues(avatar: PanelAvatar, metadata: Metadata, character: Character, rows?: PanelAttributeRows) {
  const attrs = rows ?? (avatar.legacy ? calculateLegacyPanelAttributeRows(avatar, metadata) : avatar.stats);
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
  if (!avatar.legacy && character.path === "欢愉" && values.joy === undefined) {
    const joy = calculateManagedElation(avatar, metadata);
    if (joy === undefined) throw new MissingDamageData("缺少计算欢愉度所需的行迹或装备数据");
    values.joy = joy;
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
  "欢愉": elation(staticIndex, dynamicIndex),
};

function weaponEffects(avatar: PanelAvatar, metadata: Metadata, character: Character, values: Numbers) {
  const cone = avatar.cone;
  if (!cone) return [];
  const name = character.cones[cone.id];
  const configure = name && weaponRules[character.path]?.[name];
  if (!configure || !cone.rank || metadata.conePath !== character.path) {
    throw new MissingDamageData(`当前光锥「${cone.name || cone.id}」的伤害规则尚未接入或缺少叠影`);
  }
  const energy = metadata.character.sp;
  if ((cone.id === "21034" || cone.id === "23018" || cone.id === "23058" || cone.id === "23062") &&
      (typeof energy !== "number" || !Number.isFinite(energy) || energy <= 0)) {
    throw new MissingDamageData("缺少光锥所需的角色能量上限");
  }
  if (cone.id === "21041" && values.effPct === undefined) {
    throw new MissingDamageData("缺少光锥所需的效果命中");
  }
  if ((cone.id === "23027" || cone.id === "23032") && values.stance === undefined) {
    throw new MissingDamageData("缺少光锥所需的击破特攻");
  }
  if (cone.id === "23039" && (!values.hpBase || !values.hp)) {
    throw new MissingDamageData("缺少光锥所需的生命上限");
  }
  if ((cone.id === "21030" || cone.id === "21039") && (!values.defBase || !values.def)) {
    throw new MissingDamageData("缺少光锥所需的防御力");
  }
  if (cone.id === "21014" && values.effDef === undefined) {
    throw new MissingDamageData("缺少光锥所需的效果抵抗");
  }
  const data = object(object(metadata.cone.skill)?.tables);
  const tables = new Proxy(Object.create(null), { get: (_, key: string) => tableValue(data?.[key], cone.rank) });
  const rules = Array.isArray(configure) ? configure : [configure];
  return rules.flatMap(row => {
    const rule = typeof row === "function" ? row(tables) : row;
    if (rule.isStatic) return [];
    const title = rule.title?.includes("：") ? rule.title : `${name}：${rule.title ?? ""}`;
    return { ...rule, title, data: rule.idx && rule.key ? { [rule.key]: tables[rule.idx] } : rule.data };
  });
}

function originalDamage(
  avatar: PanelAvatar, metadata: Metadata, scenario: number | undefined,
  character: Character, rows: PanelAttributeRows | undefined, skillPreview: boolean, includeSwaps = true,
) {
  if (!avatar.level || avatar.rank === undefined || metadata.character.elem !== character.element ||
      (avatar.element && avatar.element !== character.element)) throw new MissingDamageData("缺少角色等级、星魂或元素资料");
  const { rule } = character;
  const energy = metadata.character.sp;
  if (character.requiresEnergy && (typeof energy !== "number" || !Number.isFinite(energy) || energy <= 0)) {
    throw new MissingDamageData("缺少原规则所需的角色能量上限");
  }
  const rank = avatar.rank;
  const level = avatar.level;
  const knownTraces = new Map(avatar.traces.map(trace => [trace.id.match(/^1?\d{4}(\d{3})$/u)?.[1], trace.active]));
  if (!avatar.legacy && character.traces.some(trace => !knownTraces.has(String(trace)))) {
    throw new MissingDamageData("缺少对应的行迹状态");
  }
  const trees = Object.fromEntries([...knownTraces].filter(([id, active]) => id && active));
  const talent = talentValues(avatar, metadata, rank, skillPreview);
  const { values, staticAttr } = panelValues(avatar, metadata, character, rows);
  const weapon = { ...avatar.cone, name: avatar.cone ? character.cones[avatar.cone.id] : "", affix: avatar.cone?.rank ?? 0 };
  const originalAttr = DmgAttr.getAttr({ game: "sr", originalAttr: undefined, attr: { ...values, staticAttr },
    char: { elem: character.element, sp: metadata.character.sp as number | undefined, weaponTypeName: character.path }, weapon: { name: weapon.name, affix: weapon.affix } });
  const weaponBuffs = weaponEffects(avatar, metadata, character, values);
  const relics = relicEffects(avatar, metadata);
  if (relics.sets["荡除蠹灾的铁骑"] === 4 && values.stance === undefined) throw new MissingDamageData("缺少击破特攻属性");
  if (relics.sets["谧宁拾骨地"] === 2 && values.hp === undefined) throw new MissingDamageData("缺少套装所需的生命属性");
  if (values.effPct === undefined && (relics.sets["泛银河商业公司"] === 2 || relics.sets["筑城者的贝洛伯格"] === 2)) {
    throw new MissingDamageData("缺少套装所需的效果命中属性");
  }
  const buffs = [...(rule.buffs ?? []), ...weaponBuffs, ...relics.effects].sort((a, b) => (a.sort ?? 1) - (b.sort ?? 1));
  const meta = { characterName: character.name, cons: rank, exCons: avatar.exCons ?? 0, level, trees, talent, weapon };
  const defaultParams = (typeof rule.defParams === "function" ? rule.defParams(meta as unknown as Variables) : rule.defParams) ?? {};

  function calculate(detail: Rule["details"][number], incAttr = "", reduceAttr = ""): DamageRow | undefined {
    const params = { ...defaultParams, ...detail.params };
    const { attr, msg } = DmgAttr.calcAttr({
      originalAttr, buffs, meta: { ...meta }, artis: relics.sets, params, incAttr, reduceAttr, game: "sr",
    });
    const ds = { ...DmgAttr.getDs(attr, meta, params), artis: relics.sets };
    const variables = ds as unknown as Variables;
    if (detail.check && !detail.check(variables)) return;
    const damage = DmgCalc.getDmgFn({ ds, attr, level, enemyLv: personalDamageEnemyLevel, game: "sr", showDetail: false });
    const { heal, shield } = damage;
    damage.heal = amount => ({ ...heal(amount), metric: "heal" });
    damage.shield = amount => ({ ...shield(amount), metric: "shield" });
    const result = detail.dmg(variables, damage);
    const title = typeof detail.title === "function" ? detail.title(variables) : detail.title;
    const active = msg;
    if ("note" in result) return { title, note: result.note, metric: "support", active };
    const percentage = "type" in result ? result.avg : undefined;
    const { dmg, avg, display, metric = "damage" }: DamageValue = "type" in result
      ? { avg: result.avg.endsWith("%") ? Number(result.avg.slice(0, -1)) : NaN, metric: "support" }
      : result;
    if (!Number.isFinite(avg) || (dmg !== undefined && !Number.isFinite(dmg))) throw new MissingDamageData("原规则所需数据不齐");
    return { title, critical: dmg, average: avg, ...(display === undefined ? {} : { display }), ...(percentage === undefined ? {} : { percentage }), metric, active };
  }

  const scenarios = rule.details.flatMap((detail, index) => {
    if (detail.cons && detail.cons > rank) return [];
    const result = calculate(detail);
    return result ? [{ detail, index, row: result }] : [];
  });
  const defaultScenario = typeof rule.defDmgIdx === "function" ? rule.defDmgIdx(meta) : rule.defDmgIdx;
  const defaultIndex = scenarios.findIndex(row => row.index === defaultScenario);
  const selected = scenario === undefined ? Math.max(0, defaultIndex) : scenario - 1;
  const current = scenarios[selected];
  if (!current || (scenario !== undefined && !Number.isInteger(scenario))) {
    throw new MissingDamageData("伤害场景序号无效", scenarios.length);
  }
  const statKeys = rule.mainAttr.split(",") as (keyof typeof attrMap)[];
  const swaps = !includeSwaps || current.row.average === undefined ? [] : statKeys.map(from => ({
    title: attrMap[from]!.title, amount: String(attrMap[from]!.value) + (from === "speed" ? "" : "%"),
    values: statKeys.map(to => {
      if (from === to) return;
      const result = calculate(current.detail, to, from);
      return result?.average !== undefined ? { critical: result.critical, average: result.average, ...(result.display === undefined ? {} : { display: result.display }), ...(result.percentage === undefined ? {} : { percentage: result.percentage }) } : undefined;
    }),
  }));
  const damageRows: DamageScenario[] = scenarios.map(({ row, index }) => ({ ...row, scenario: index }));
  return { name: character.name, element: character.element, createdBy: rule.createdBy, rows: damageRows, swaps, selected, buffs: current.row.active };
}

export function formatStarRailDamageChange(value: number) {
  const magnitude = Math.abs(value).toFixed(1);
  return Number(magnitude) === 0 ? "0.0%" : `${value > 0 ? "↑" : "↓"} ${magnitude}%`;
}

function relativeDamage(before: number | undefined, after: number | undefined) {
  if (before === undefined || before === 0 || after === undefined) return;
  const change = (after - before) / before * 100;
  return Number.isFinite(change) ? change : undefined;
}

function compareDamage(rows: readonly DamageScenario[], previous: readonly DamageScenario[]) {
  const byScenario = new Map(previous.map(row => [row.scenario, row]));
  return rows.map(row => {
    const before = byScenario.get(row.scenario);
    if (!before || before.metric !== row.metric || (before.percentage === undefined) !== (row.percentage === undefined)) return row;
    const critical = relativeDamage(before.critical, row.critical);
    const average = relativeDamage(before.average, row.average);
    return critical === undefined && average === undefined ? row : { ...row, change: { critical, average } };
  });
}

export function readStarRailPersonalDamage(avatar: PanelAvatar, metadata: Metadata, scenario?: number, rows?: PanelAttributeRows,
  skillPreview = false, baseline?: { readonly avatar: PanelAvatar; readonly metadata: Metadata }) {
  const character = characters.get(avatar.id);
  if (!character) return { reason: "该星铁角色的个人伤害规则尚未接入", scenarioCount: undefined } as const;
  try {
    const damage = originalDamage(avatar, metadata, scenario, character, rows, skillPreview);
    if (baseline?.avatar.id === avatar.id) {
      try {
        const before = originalDamage(baseline.avatar, baseline.metadata, undefined, character, undefined, false, false);
        return { damage: { ...damage, rows: compareDamage(damage.rows, before.rows) } } as const;
      } catch (error) {
        if (!(error instanceof MissingDamageData)) throw error;
      }
    }
    return { damage } as const;
  } catch (error) {
    if (!(error instanceof MissingDamageData)) throw error;
    return { reason: error.message, scenarioCount: error.scenarioCount } as const;
  }
}

export function calculateStarRailPersonalDamage(avatar: PanelAvatar, metadata: Metadata, scenario?: number) {
  return readStarRailPersonalDamage(avatar, metadata, scenario).damage;
}

export type StarRailPersonalDamage = ReturnType<typeof originalDamage> & { readonly trialTitleMode?: TrialTitleMode };
