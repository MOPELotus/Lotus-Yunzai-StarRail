import { readFile, stat } from "node:fs/promises";

export type WarpKind = "character" | "cone" | "standard";
export interface WarpItem {
  readonly name: string;
  readonly kind: "角色" | "光锥";
  readonly rarity: 3 | 4 | 5;
}
export interface WarpPool {
  readonly title: string;
  readonly kind: WarpKind;
  readonly featuredFive?: WarpItem;
  readonly featuredFour: readonly WarpItem[];
  readonly otherFive: readonly WarpItem[];
  readonly otherFour: readonly WarpItem[];
  readonly three: readonly WarpItem[];
}

const characters = (rarity: 4 | 5, names: readonly string[]): WarpItem[] =>
  names.map((name) => ({ name, rarity, kind: "角色" }));
const cones = (rarity: 3 | 4 | 5, names: readonly string[]): WarpItem[] =>
  names.map((name) => ({ name, rarity, kind: "光锥" }));

const standardCharacters = characters(5, ["姬子", "瓦尔特", "布洛妮娅", "杰帕德", "克拉拉", "彦卿", "白露"]);
const standardCones = cones(5, ["银河铁道之夜", "以世界之名", "但战斗还未结束", "制胜的瞬间", "无可取代的东西", "如泥酣眠", "时节不居"]);
const fourCharacters = characters(4, ["三月七", "丹恒", "阿兰", "艾丝妲", "黑塔", "希露瓦", "娜塔莎", "佩拉", "桑博", "虎克",
  "青雀", "停云", "素裳", "驭空", "卢卡", "玲可", "桂乃芬", "寒鸦", "雪衣", "米沙", "加拉赫", "貊泽"]);
const fourCones = cones(4, ["一场术后对话", "晚安与睡颜", "余生的第一天", "唯有沉默", "记忆中的模样", "鼹鼠党欢迎你", "「我」的诞生",
  "同一种心情", "猎物的视线", "朗道的选择", "论剑", "与行星相会", "秘密誓心", "别让世界静下来", "此时恰好", "决心如汗珠般闪耀",
  "宇宙市场趋势", "点个关注吧！", "舞！舞！舞！", "在蓝天下", "天才们的休憩", "铭记于心的约定", "两个人的演唱会", "无边曼舞",
  "谐乐静默之后", "芳华待灼", "黑夜如影随行", "梦的蒙太奇", "天才们的问候", "多流汗，少流泪", "胜利只在朝夕间"]);
const three = cones(3, ["天倾", "乐圮", "俱殁", "锋镝", "离弦", "相抗", "智库", "灵钥", "睿见", "齐颂", "轮契", "调和", "幽邃", "渊环", "匿影", "琥珀", "戍御", "开疆", "物穰", "嘉果", "蕃息"]);
const standard: WarpPool = {
  kind: "standard", title: "群星跃迁", featuredFour: [],
  otherFive: [...standardCharacters, ...standardCones], otherFour: [...fourCharacters, ...fourCones], three,
};

interface Banner {
  readonly character: string;
  readonly cone: string;
  readonly start: string;
  readonly end: string;
  readonly slot: number;
  readonly characters4: readonly string[];
  readonly cones4: readonly string[];
}

const phaseOneFour = {
  characters4: ["艾丝妲", "玲可", "驭空"],
  cones4: ["宇宙市场趋势", "天才们的休憩", "黑夜如影随行"],
};
const start = "2026-11-11T11:00:00+08:00";
const rerunEnd = "2026-12-02T12:00:00+08:00";
const builtIn: readonly Banner[] = [
  { ...phaseOneFour, slot: 1, start, end: "2026-12-22T15:00:00+08:00", character: "星神★阿哈", cone: "当第一声『阿哈』响起" },
  { ...phaseOneFour, slot: 2, start, end: rerunEnd, character: "银狼LV.999", cone: "欢迎来到银河城" },
  { ...phaseOneFour, slot: 3, start, end: rerunEnd, character: "火花", cone: "花花世界迷人眼" },
  { ...phaseOneFour, slot: 4, start, end: rerunEnd, character: "爻光", cone: "当她决定看见" },
];

function label(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && [...value].length >= 1 && [...value].length <= 60 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function list(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(label) && new Set(value).size === value.length;
}

function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value));
}

function isBanner(value: unknown): value is Banner {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Banner>;
  return label(row.character) && label(row.cone) && date(row.start) && date(row.end) && Date.parse(row.start) < Date.parse(row.end) &&
    typeof row.slot === "number" && Number.isInteger(row.slot) && row.slot >= 1 && row.slot <= 4 && list(row.characters4) && list(row.cones4);
}

export function createWarpPoolSource(file = Bun.env.LOTUS_STAR_RAIL_WARP_BANNERS?.trim()) {
  return async (kind: WarpKind, slot: number, time: number): Promise<WarpPool | undefined> => {
    if (kind === "standard") return standard;
    let banners = builtIn;
    if (file) {
      const info = await stat(file);
      if (!info.isFile() || info.size > 128 * 1024) throw new TypeError("跃迁活动卡池配置无效。");
      const body: unknown = JSON.parse(await readFile(file, "utf8"));
      if (!Array.isArray(body) || body.length > 128 || !body.every(isBanner)) throw new TypeError("跃迁活动卡池配置无效。");
      banners = body;
    }
    const active = banners.filter((row) => row.slot === slot && Date.parse(row.start) <= time && time < Date.parse(row.end));
    if (active.length > 1) throw new TypeError("同一跃迁卡池编号的活动时间重叠。");
    const banner = active[0];
    if (!banner) return;
    const isCone = kind === "cone";
    const featuredFive: WarpItem = { name: isCone ? banner.cone : banner.character, kind: isCone ? "光锥" : "角色", rarity: 5 };
    const featuredFour = isCone ? cones(4, banner.cones4) : characters(4, banner.characters4);
    const isFeatured = (item: WarpItem) => featuredFour.some((rateUp) => rateUp.kind === item.kind && rateUp.name === item.name);
    return {
      kind, title: `${featuredFive.kind}活动跃迁 · ${featuredFive.name}`, featuredFive, featuredFour, three,
      otherFive: (isCone ? standardCones : standardCharacters).filter((item) => item.name !== featuredFive.name),
      otherFour: standard.otherFour.filter((item) => !isFeatured(item)),
    };
  };
}
