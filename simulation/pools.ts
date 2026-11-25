import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { readFile, stat } from "node:fs/promises";
import { readStarRailGachaSchedule } from "../gacha-schedule.ts";
import { readStarRailGachaCatalog, starRailGachaThemeDirectory } from "../gacha-detail-source.ts";
import { validWarpPoolName, type WarpSettings } from "./settings.ts";
import type { LegacyPersonalPhase } from "./personal-pools.ts";

export type CollaborationWarpKind = "collaboration-character" | "collaboration-cone";
export type WarpKind = "character" | "cone" | "standard" | CollaborationWarpKind;

export function isCollaborationWarp(kind: WarpKind): kind is CollaborationWarpKind {
  return kind === "collaboration-character" || kind === "collaboration-cone";
}
export interface WarpItem {
  readonly name: string;
  readonly kind: "角色" | "光锥";
  readonly rarity: 3 | 4 | 5;
}
export interface WarpPool {
  readonly title: string;
  readonly kind: WarpKind;
  readonly featuredFive?: WarpItem;
  readonly featuredFivePool?: readonly WarpItem[];
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
  kind: "standard", title: $t("simulation.pools.text_673a78ca8d"), featuredFour: [],
  otherFive: [...standardCharacters, ...standardCones], otherFour: [...fourCharacters, ...fourCones], three,
};

// The independent simulator combined each kind of Fate collaboration banner into one local pool.
const fateWarps = [
  { startsAt: Date.parse("2025-07-11T12:00:00+08:00"), characters: ["Saber", "Archer"], cones: [$t("simulation.pools.text_2045afcf6d"), $t("simulation.pools.text_a3005ad0ea")] },
  { startsAt: Date.parse("2026-07-24T12:00:00+08:00"), characters: [$t("simulation.pools.text_043f19c4e6"), $t("simulation.pools.text_6dc9fe7660")], cones: [$t("simulation.pools.text_b0c2d83185"), $t("simulation.pools.text_62d9e186f7")] },
];

function collaborationPool(kind: CollaborationWarpKind, time: number): WarpPool | undefined {
  const editions = fateWarps.filter(({ startsAt }) => time >= startsAt);
  if (!editions.length) return;
  const cone = kind === "collaboration-cone";
  return { kind, title: $t("simulation.pools.text_118c4f060a", { "value1": cone ? "光锥" : "角色" }),
    featuredFivePool: editions.flatMap(edition => cone ? cones(5, edition.cones) : characters(5, edition.characters)),
    featuredFour: [], otherFive: cone ? standardCones : standardCharacters, otherFour: standard.otherFour, three };
}

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
  characters4: [$t("simulation.pools.text_364a25dddc"), $t("simulation.pools.text_98312068dc"), $t("simulation.pools.text_edc825860f")],
  cones4: [$t("simulation.pools.text_a2aa5d4891"), $t("simulation.pools.text_2046de1dee"), $t("simulation.pools.text_ee465bd3e7")],
};
const start = "2026-11-11T11:00:00+08:00";
const rerunEnd = "2026-12-02T12:00:00+08:00";
const builtIn: readonly Banner[] = [
  { ...phaseOneFour, slot: 1, start, end: "2026-12-22T15:00:00+08:00", character: $t("simulation.pools.text_b07fcdcffb"), cone: $t("simulation.pools.text_d3640b19e0") },
  { ...phaseOneFour, slot: 2, start, end: rerunEnd, character: $t("simulation.pools.text_9e8cd31678"), cone: $t("simulation.pools.text_ac54764660") },
  { ...phaseOneFour, slot: 3, start, end: rerunEnd, character: $t("simulation.pools.text_9f62cd8bb7"), cone: $t("simulation.pools.text_fc080f5ab4") },
  { ...phaseOneFour, slot: 4, start, end: rerunEnd, character: $t("simulation.pools.text_accccf3cc5"), cone: $t("simulation.pools.text_a12225f546") },
];

function list(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(validWarpPoolName) && new Set(value).size === value.length;
}

function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value));
}

function isBanner(value: unknown): value is Banner {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<Banner>;
  return validWarpPoolName(row.character) && validWarpPoolName(row.cone) && date(row.start) && date(row.end) && Date.parse(row.start) < Date.parse(row.end) &&
    typeof row.slot === "number" && Number.isInteger(row.slot) && row.slot >= 1 && row.slot <= 4 && list(row.characters4) && list(row.cones4);
}

export function customWarpPool(kind: WarpKind, slot: number, pool: WarpPool | undefined, settings: WarpSettings): WarpPool | undefined {
  if (kind === "standard" || isCollaborationWarp(kind) || settings.automaticPools) return pool;
  const isCone = kind === "cone";
  const build = isCone ? cones : characters;
  const fiveNames = settings.poolNames[isCone ? "coneFive" : "characterFive"];
  const fourNames = settings.poolNames[isCone ? "coneFour" : "characterFour"];
  const fiveName = fiveNames ? fiveNames[slot - 1] : pool?.featuredFive?.name;
  if (!fiveName) return;
  const featuredFive = build(5, [fiveName])[0]!;
  const featuredFour = fourNames ? build(4, fourNames) : pool?.featuredFour ?? [];
  return { kind, title: $t("simulation.pools.text_3227effc77", { "kind": featuredFive.kind, "fiveName": fiveName }), featuredFive, featuredFour, three,
    otherFive: (isCone ? standardCones : standardCharacters).filter(item => item.name !== fiveName),
    otherFour: standard.otherFour.filter(item => !featuredFour.some(featured => featured.kind === item.kind && featured.name === item.name)),
  };
}

export function personalWarpPool(kind: WarpKind, slot: number, phase: LegacyPersonalPhase | undefined): WarpPool | undefined {
  if (!phase || (kind !== "cone" && kind !== "character") || slot > 2) return;
  const isCone = kind === "cone";
  const build = isCone ? cones : characters;
  const names = isCone ? phase.weapon5 : slot === 2 && phase.up5_2.length ? phase.up5_2 : phase.up5;
  if (!names.length) return;
  const featuredFivePool = build(5, names);
  const featuredFive = featuredFivePool[0]!;
  const featuredFour = build(4, isCone ? phase.weapon4 : phase.up4);
  const otherFive = (isCone ? standardCones : standardCharacters).filter(item => !names.includes(item.name));
  if (!otherFive.length) return;
  return {
    kind, title: $t("simulation.pools.text_ef39a35fd3", { "kind": featuredFive.kind, "name": featuredFive.name }), featuredFive, featuredFivePool, featuredFour, otherFive, three,
    otherFour: standard.otherFour.filter(item => !featuredFour.some(featured => featured.kind === item.kind && featured.name === item.name)),
  };
}

const fallbackRandomCandidates = {
  characterFive: standardCharacters.map(item => item.name),
  characterFour: fourCharacters.map(item => item.name),
  coneFive: standardCones.map(item => item.name),
  coneFour: fourCones.map(item => item.name),
};

export async function readWarpRandomCandidates(root = starRailGachaThemeDirectory()) {
  const catalog = await readStarRailGachaCatalog(root).catch(() => undefined);
  const collect = (kind: "characters" | "weapons", rank: 4 | 5, fallback: readonly string[]) =>
    [...new Set([...fallback, ...[...(catalog?.[kind].values() ?? [])]
      .filter(item => item.rank === rank && validWarpPoolName(item.name)).map(item => item.name)])];
  return {
    characterFive: collect("characters", 5, fallbackRandomCandidates.characterFive),
    characterFour: collect("characters", 4, fallbackRandomCandidates.characterFour),
    coneFive: collect("weapons", 5, fallbackRandomCandidates.coneFive),
    coneFour: collect("weapons", 4, fallbackRandomCandidates.coneFour),
  };
}

const stamp = (text: string) => `${text.replace(" ", "T")}+08:00`;
const knownUntil = Math.max(...builtIn.map(item => Date.parse(item.end)));
const knownFrom = Math.min(...builtIn.map(item => Date.parse(item.start)));

export function createWarpPoolSource(file = Bun.env.LOTUS_STAR_RAIL_WARP_BANNERS?.trim(), theme = starRailGachaThemeDirectory) {
  return async (kind: WarpKind, slot: number, time: number): Promise<WarpPool | undefined> => {
    if (kind === "standard") return standard;
    if (isCollaborationWarp(kind)) return slot === 1 ? collaborationPool(kind, time) : undefined;
    let banners = builtIn;
    if (file) {
      const info = await stat(file);
      if (!info.isFile() || info.size > 128 * 1024) throw new TypeError($t("simulation.pools.text_54be6f00f3"));
      const body: unknown = JSON.parse(await readFile(file, "utf8"));
      if (!Array.isArray(body) || body.length > 128 || !body.every(isBanner)) throw new TypeError($t("simulation.pools.text_54be6f00f3"));
      banners = body;
    } else if (time < knownFrom || time >= knownUntil) {
      const periods = await readStarRailGachaSchedule(theme());
      banners = periods.flatMap(row => row.char5.slice(0, 4).flatMap((character, index) => {
        const candidate = { character, cone: row.weapon5[index], characters4: row.char4, cones4: row.weapon4, slot: index + 1,
          start: stamp(row.from), end: stamp(row.to) };
        return isBanner(candidate) ? [candidate] : [];
      }));
    }
    const active = banners.filter((row) => row.slot === slot && Date.parse(row.start) <= time && time < Date.parse(row.end));
    if (active.length > 1) throw new TypeError($t("simulation.pools.text_925e962e8b"));
    const banner = active[0];
    if (!banner) return;
    const isCone = kind === "cone";
    const featuredFive: WarpItem = { name: isCone ? banner.cone : banner.character, kind: isCone ? "光锥" : "角色", rarity: 5 };
    const featuredFour = isCone ? cones(4, banner.cones4) : characters(4, banner.characters4);
    const isFeatured = (item: WarpItem) => featuredFour.some((rateUp) => rateUp.kind === item.kind && rateUp.name === item.name);
    return {
      kind, title: $t("simulation.pools.text_47797015e8", { "kind": featuredFive.kind, "name": featuredFive.name }), featuredFive, featuredFour, three,
      otherFive: (isCone ? standardCones : standardCharacters).filter((item) => item.name !== featuredFive.name),
      otherFour: standard.otherFour.filter((item) => !isFeatured(item)),
    };
  };
}
