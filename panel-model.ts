// Field mappings and list ordering adapted from miao-plugin
// apps/profile/ProfileList.js and models/serv/api/MysPanelHSR{Api,Data,Mappings}.js.
import { MAX_PROFILE_ID } from "@lotus-yunzai/account";
import names from "./challenge-character-names.json";
import { parseEquipmentChange } from "./panel-equipment.ts";

type Json = Record<string, unknown>;
export const object = (value: unknown): Json | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Json : undefined;
export const array = (value: unknown) => Array.isArray(value) ? value.map(object).filter(row => row !== undefined) : [];
export const text = (value: unknown, limit = 100) =>
  typeof value === "string" && value.isWellFormed() ? value.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim().slice(0, limit) : "";
export const id = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : typeof value === "string" && /^[1-9]\d{0,11}$/u.test(value) ? value : "";
export function whole(value: unknown, max: number) {
  const n = typeof value === "string" && /^\d{1,13}$/u.test(value) ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= max ? n : undefined;
}

const statMap: Readonly<Record<number, string>> = {
  1: "hp", 2: "atk", 3: "def", 4: "speed", 5: "cpct", 6: "cdmg", 7: "heal", 9: "recharge",
  10: "effPct", 11: "effDef", 12: "phy", 14: "fire", 16: "ice", 18: "elec", 20: "wind",
  22: "quantum", 24: "imaginary", 27: "hp", 29: "atk", 31: "def", 32: "hpPct", 33: "atkPct",
  34: "defPct", 51: "speed", 52: "cpct", 53: "cdmg", 54: "recharge", 55: "heal", 56: "effPct",
  57: "effDef", 58: "stance", 59: "stance",
};
const remakeMap: Readonly<Record<string, string>> = {
  普攻: "a", 战技: "e", 终结技: "q", 天赋: "t", 秘技: "z", 欢愉技: "xe", 忆灵技: "me", 忆灵天赋: "mt",
};
const skillBonus: Readonly<Record<string, number>> = { a: 1, e: 2, q: 2, t: 2, xe: 1, me: 1, mt: 1 };
const skillCap: Readonly<Record<string, number>> = { a: 10, e: 15, q: 15, t: 15, xe: 15, me: 10, mt: 10 };

export function isStarRailTalentUnlocks(value: unknown): value is number | number[] {
  const unlocks = Array.isArray(value) ? value : [value];
  return unlocks.length > 0 && new Set(unlocks).size === unlocks.length && unlocks.every(
    unlock => typeof unlock === "number" && Number.isInteger(unlock) && unlock >= 1 && unlock <= 6,
  );
}

function starRailSkillBonus(skill: string, rank: number, upgrades: unknown) {
  const unlocks = Array.isArray(upgrades) ? upgrades : [upgrades];
  const active = unlocks.filter(unlock => typeof unlock === "number" && unlock > 0 && unlock <= rank).length;
  return active * (skillBonus[skill] ?? 0);
}

/** Resolves the original level stored in the Star Rail cache using CharTalent.js. */
export function starRailLegacySkillLevel(skill: string, level: number, rank: number, upgrades: unknown) {
  return Math.min(skillCap[skill] ?? 25, level + starRailSkillBonus(skill, rank, upgrades));
}

/** Uses the fixed CharTalent level mode for explicit effective levels. */
export function starRailSpecifiedSkillLevel(skill: string, level: number, rank: number, upgrades: unknown) {
  return { level: Math.min(skillCap[skill] ?? 25, level), original: level - starRailSkillBonus(skill, rank, upgrades) };
}

/** Recovers the base of an effective MiYouShe level when the result is unambiguous. */
export function recoverStarRailSkillLevel(skill: string, effective: number, oldRank: number, rank: number, upgrades: unknown) {
  const oldBonus = starRailSkillBonus(skill, oldRank, upgrades);
  const cap = skillCap[skill] ?? 25;
  const base = effective - oldBonus;
  if (!Number.isInteger(effective) || base < 1 || effective > cap) return;
  if (effective === cap && starRailSkillBonus(skill, rank, upgrades) < oldBonus) return;
  return base;
}
const elements: Readonly<Record<string, string>> = {
  Physical: "物理", Fire: "火", Ice: "冰", Thunder: "雷", Wind: "风", Quantum: "量子", Imaginary: "虚数",
};
export const officialArtHosts = new Set(["act-webstatic.mihoyo.com", "upload-bbs.mihoyo.com", "fastcdn.mihoyo.com"]);
const mappedNames: Readonly<Record<string, string>> = names;

export function safeArt(value: unknown, allowParameters = true) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && officialArtHosts.has(url.hostname) && !url.username && !url.password && !url.port &&
      (allowParameters || (!url.search && !url.hash)) ? url.href : "";
  } catch {
    return "";
  }
}

export function statValue(value: unknown) {
  const match = /^([-+]?\d{1,8}(?:\.\d{1,8})?)\s*(%)?$/u.exec(text(String(value ?? ""), 35));
  if (!match || !match[1]) return "";
  return `${Number(match[1])}${match[2] ?? ""}`;
}

interface Stat {
  key: string;
  value: string;
  base?: string;
  times?: number;
}
interface Skill {
  key: string;
  level: number;
  original?: number;
  effective?: true;
  icon: string;
}
interface Trace {
  id: string;
  icon: string;
  name: string;
  active: boolean;
}
interface Cone {
  id: string;
  name: string;
  rank?: number;
  level?: number;
  promote?: number;
  image: string;
  description: string;
}
interface Relic {
  id: string;
  slot: number;
  name: string;
  image: string;
  level?: number;
  rarity?: number;
  main?: Stat;
  subs: Stat[];
  legacyMainId?: string;
  legacySubIds?: string[];
}

export interface PanelAvatar {
  id: string;
  name: string;
  element: string;
  rarity?: number;
  level?: number;
  rank?: number;
  path: string;
  face: string;
  splash: string;
  skills: Skill[];
  traces: Trace[];
  stars: { image: string; active: boolean }[];
  stats: Stat[];
  cone?: Cone;
  relics: Relic[];
  legacy?: { source: string; promote?: number; dataComplete: boolean; updatedAt?: string };
}
export type ShowcaseProvider = "mihomo" | "avocado" | "enka";

export interface PanelSnapshot {
  version: 1;
  uid: string;
  source: "miyoushe" | "legacy" | ShowcaseProvider;
  showcaseTtl?: number;
  updatedAt?: string;
  avatars: PanelAvatar[];
}
export type PanelCommand = NonNullable<ReturnType<typeof parsePanelCommand>>;

const leadingPanelUid = /^(#星铁|\*)\s*((?:18|[1-9])\d{8})(?!\d)\s*(?=[\p{L}\p{N}])/u;

const panelTarget = String.raw`(?:\s*([1-9]\d{8,9})(?:\s+档案\s*([1-9]\d{0,2}))?|\s*(?:档案\s*)?(\d{1,3}))?`;
const showcasePanel = new RegExp(String.raw`^(?:#星铁|\*)\s*(?:展板|备用)(?:全部面板更新|更新全部面板|获取游戏角色详情|更新面板|面板更新)${panelTarget}$`, "u");
const traceRefresh = /^(?:#星铁|\*)\s*(?:强制)?(?:刷新|更新)(?:所有|角色)*(?:天赋|技能|行迹)(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;
const reloadPanel = new RegExp(String.raw`^(?:#星铁|\*)\s*(?:加载|重新加载|重载)面板${panelTarget}$`, "u");
const discardPanel = new RegExp(String.raw`^(?:#星铁|\*)\s*删除(?:全部面板|面板(?:数据)?)${panelTarget}$`, "u");
const refreshPanel = new RegExp(
  String.raw`^(?:(?:#星铁|\*)\s*(?:(?:米游社|mys)\s*)?|#?(?:米游社|mys)\s*星铁\s*)` +
    `(?:全部面板更新|更新全部面板|获取游戏角色详情|更新面板|面板更新)${panelTarget}$`, "iu",
);
const characterShowcase = /^(?:#星铁|\*)\s*更新\s*([\p{L}\p{N}·・•_.&★ -]{1,28}?)(?:详细|详情|面板)(?:\s*(?:档案\s*)?([1-9]\d{0,2}))?$/u;

const practiceTarget = String.raw`(?:\s*(?:档案\s*)?(\d{1,3}))?`;
const practiceOverview = new RegExp(String.raw`^(?:#星铁|\*)\s*(?:面板)?练度统计${practiceTarget}$`, "u");
const practiceAliases = new RegExp(String.raw`^#星铁\s*((?:我的)?(?:物理|火|冰|雷|风|量子|虚数)*(?:角色|练度|[五四54星])+(?:汇总|统计|列表)(?:force|[五四54星])*)${practiceTarget}$`, "u");

export function parsePanelCommand(message: string) {
  const extreme = /^(?:#星铁|\*)\s*(?:群内?)?\s*(?:排名|排行)?\s*极限\s*([\p{L}\p{N}·・•_.&★ -]{1,28}?)(?:\s*(?:面[板版]|详情|详细))?$/u.exec(message)?.[1]?.trim();
  if (extreme) return { type: "extreme" as const, name: extreme, profileId: 1 };
  const practice = practiceOverview.exec(message);
  if (practice) return { type: "practice" as const, name: "", profileId: Number(practice[1] ?? 1), rarity: undefined };
  const alias = practiceAliases.exec(message);
  const aliasBody = alias?.[1];
  if (alias && aliasBody && aliasBody !== "角色统计") {
    const rarity = /[五5]+星/u.test(aliasBody) ? 5 : /星/u.test(aliasBody) ? 4 : undefined;
    return { type: "practice" as const, name: "", profileId: Number(alias[2] ?? 1), rarity };
  }
  const traces = traceRefresh.exec(message);
  if (traces) return { type: "refresh-traces" as const, name: "", profileId: Number(traces[1] ?? 1) };
  const discard = discardPanel.exec(message);
  if (discard) return { type: "discard" as const, name: "", profileId: Number(discard[2] ?? discard[3] ?? 1), ...(discard[1] && { uid: discard[1] }) };
  const reload = reloadPanel.exec(message);
  const showcase = reload ? undefined : showcasePanel.exec(message);
  const refresh = reload || showcase ? undefined : refreshPanel.exec(message);
  const operation = reload ?? showcase ?? refresh;
  if (operation) {
    const profileId = Number(operation[2] ?? operation[3] ?? 1);
    if (refresh && (profileId < 1 || profileId > MAX_PROFILE_ID)) return;
    return { type: reload ? "reload" as const : showcase ? "showcase" as const : "update" as const, name: "", profileId, ...(operation[1] && { uid: operation[1] }) };
  }
  const namedShowcase = characterShowcase.exec(message);
  const showcaseName = namedShowcase?.[1]?.trim();
  if (showcaseName) {
    const profileId = Number(namedShowcase?.[2] ?? 1);
    if (profileId <= MAX_PROFILE_ID) return { type: "showcase" as const, name: showcaseName, profileId };
  }
  const exporting = /^(?:#星铁|\*)(强制)?导出面板(?:\s*(?:档案\s*)?(\d+))?$/u.exec(message);
  if (exporting) return { type: "export" as const, name: "", profileId: Number(exporting[2] ?? 1), share: Boolean(exporting[1]) };
  const relicList = /^(?:(?:#星铁|\*)(?:遗器|圣遗物)|#遗器)列表(?:\s*(\d{9,10})(?!\d))?(?:\s*(?:档案\s*)?([1-9]\d{0,2}))?$/u.exec(message);
  if (relicList) {
    const profileId = Number(relicList[2] ?? 1);
    if (profileId > MAX_PROFILE_ID) return;
    const uid = relicList[1];
    if (uid && !/^(?:18|[1-9])\d{8}$/u.test(uid)) return;
    return { type: "relic-list" as const, name: "", profileId, ...(uid ? { uid } : {}) };
  }
  const leading = leadingPanelUid.exec(message);
  if (!leading) return parseLocalPanelCommand(message);
  const body = message.slice(leading[0].length).replace(/\s+档案\s*([1-9]\d{0,2})$/u, " $1");
  const command = parseLocalPanelCommand(leading[1] + body);
  if (!command || "equipment" in command || (command.type !== "detail" && command.type !== "damage")) return;
  return { ...command, uid: leading[2]! };
}

function parseLocalPanelCommand(message: string) {
  const equipment = parseEquipmentChange(message);
  if (equipment) return equipment;
  const damage = /^(?:#星铁|\*)([\p{L}\p{N}·・•_.&★ -]{1,28}?)(?:伤害|武器)(\d{1,6})?(?:\s+([1-9]\d{0,2}))?$/u.exec(message);
  const damagedRole = damage?.[1]?.trim();
  if (damage && damagedRole && !damagedRole.includes("换") && !/^(?:队伍|阵容|团队|实战|模拟)$/u.test(damagedRole)) {
    const profileId = Number(damage[3] ?? 1);
    if (profileId > MAX_PROFILE_ID) return;
    const scenario = damage[2];
    return { type: "damage" as const, profileId, name: damagedRole, scenario: scenario === undefined ? undefined : Math.max(1, Number(scenario)) };
  }
  const command = /^(?:#星铁|\*)(.+?)\s*([1-9]\d{0,2})?$/u.exec(message);
  if (!command || !command[1]) return;
  const body = command[1].trim();
  const profileId = Number(command[2] ?? 1);
  if (profileId > MAX_PROFILE_ID) return;
  if (/^(?:面板角色|角色面板|面板)(?:列表)?$/u.test(body))
    return { type: "list" as const, profileId, name: "" };
  if (/(?:卡池(?:详情|详细)|参考面[板版])$/u.test(body)) return;
  const detail = /^([\p{L}\p{N}·・•_.&★ -]{1,28}?)(详细|详情|面板|面版|遗器|圣遗物)$/u.exec(body);
  if (detail?.[1] && !detail[1].includes("换") && !/^(?:展板|备用|删除|加载|重载|清理|重新加载|更新|刷新|修复|重建)|列表$/u.test(detail[1])) {
    return { type: detail[2] === "遗器" || detail[2] === "圣遗物" ? "relics" as const : "detail" as const, profileId, name: detail[1].trim() };
  }
}

function property(row: Json, highest = false): Stat | undefined {
  const code = whole(row.property_type, 999);
  const key = code !== undefined ? statMap[code] ?? `unknown-${code}` : "";
  const value = statValue(highest ? row.final ?? row.value : row.value ?? row.final);
  if (!key || !value) return;
  const base = statValue(row.base);
  const times = whole(row.times, 20);
  return { key, value, ...(base && { base }), ...(times !== undefined && { times }) };
}

function relic(row: Json): Relic | undefined {
  const slot = whole(row.pos, 6), relicId = id(row.id);
  if (!slot || !relicId) return;
  const main = object(row.main_property);
  return {
    id: relicId, slot, name: text(row.name ?? row.name_mi18n), image: safeArt(row.icon), level: whole(row.level, 15),
    rarity: whole(row.rarity, 5), main: main && property(main),
    subs: array(row.properties).filter(row => row.is_preview !== true).slice(0, 4).flatMap(row => property(row) ?? []),
  };
}

export function readOfficialPanelSkill(row: Json): Skill | undefined {
  const key = remakeMap[text(row.remake)];
  const level = whole(row.level, 25);
  if (key && level !== undefined && level > 0) return { key, level, icon: safeArt(row.icon) };
}

const enhancedIds = new Set(["1212", "1205", "1005", "1006", "1004", "1102", "1217", "1310", "1306", "1307"]);

export function canonicalStarRailPanelCharacter(original: string, enhanced: boolean) {
  const transformed = `2${original.slice(1)}`;
  return enhanced && enhancedIds.has(original) && mappedNames[transformed] ? transformed : original;
}
function officialAvatar(row: Json): PanelAvatar | undefined {
  const original = id(row.id);
  const level = whole(row.level, 80);
  if (!original || !level) return;
  const skillRows = array(row.skills);
  const avatarId = canonicalStarRailPanelCharacter(original, skillRows.some(row => text(String(row.point_id)).startsWith(`1${original}`)));
  const enhanced = avatarId !== original;
  const name = enhanced || original.startsWith("8") ? mappedNames[avatarId] || text(row.name ?? row.name_mi18n) : text(row.name ?? row.name_mi18n) || mappedNames[avatarId];
  if (!name) return;
  const eidolons = array(row.ranks);
  const cone = object(row.equip);
  const coneId = id(cone?.id);
  const rawElement = text(row.element);
  const relics = [...array(row.relics), ...array(row.ornaments)].flatMap(row => relic(row) ?? []);
  const allSkills = [...skillRows, ...array(object(row.servant_detail)?.servant_skills)];
  const seen = new Set();
  return {
    id: avatarId, name, level, rank: whole(row.rank, 6), rarity: whole(row.rarity, 5),
    element: elements[rawElement] ?? rawElement, path: text(row.avatar_path ?? row.path), face: safeArt(row.icon ?? row.image),
    splash: safeArt(row.large_icon ?? row.image), stats: array(row.properties).slice(0, 45).flatMap(row => property(row, true) ?? []),
    skills: allSkills.flatMap(row => readOfficialPanelSkill(row) ?? []).filter(row => !seen.has(row.key) && Boolean(seen.add(row.key))),
    traces: allSkills.filter(row => row.point_type !== 2 && !remakeMap[text(row.remake)]).slice(0, 24).map(row => ({
      id: id(row.point_id), icon: safeArt(row.icon), name: text(row.name ?? row.remake), active: row.is_activated === true,
    })),
    stars: eidolons.slice(0, 6).map(row => ({ image: safeArt(row.icon), active: row.is_unlocked === true })),
    cone: cone && coneId ? { id: coneId, name: text(cone.name), rank: whole(cone.rank, 5), level: whole(cone.level, 80), promote: whole(cone.promote, 6),
      image: safeArt(cone.icon), description: text(cone.desc ?? cone.description, 1200) } : undefined,
    relics: relics.sort((a, b) => a.slot - b.slot),
  };
}

export function normalizePanel(uid: string, source: readonly Json[], now = new Date()): PanelSnapshot {
  const avatars = new Map<string, PanelAvatar>();
  for (const row of source) {
    const avatar = officialAvatar(row);
    if (!avatar || avatars.has(avatar.id)) throw new Error("星铁面板含无效或重复的角色记录。");
    avatars.set(avatar.id, avatar);
  }
  return { version: 1, uid, source: "miyoushe", updatedAt: now.toISOString(), avatars: [...avatars.values()] };
}

export function readLegacyPanel(uid: string, source: unknown): PanelSnapshot {
  const data = object(source);
  const avatars = object(data?.avatars);
  if (id(data?.uid) !== uid || !avatars || Object.keys(avatars).length > 256) {
    throw new Error("旧面板档案与当前角色不匹配。");
  }
  const parsed: PanelAvatar[] = [];
  for (const [key, value] of Object.entries(avatars)) {
    const row = object(value);
    const avatarId = id(row?.id);
    const level = whole(row?.level, 80);
    const name = mappedNames[avatarId] || text(row?.name);
    const gear = object(row?.weapon), talent = object(row?.talent);
    if (!row || key !== avatarId || !level || !name) continue;
    // Reject rows with no recorded source.
    const source = text(row._source);
    if (!source) continue;
    const coneId = id(gear?.id);
    const skills = Object.entries(talent ?? {}).flatMap(([key, value]) => {
      const level = whole(value, 25);
      return level && Object.values(remakeMap).includes(key) ? [{ key, level, icon: "" }] : [];
    });
    const legacyParts = Object.entries(object(row.artis) ?? {});
    const relics = legacyParts.flatMap(([key, value]) => {
      const part = object(value), partId = id(part?.id), slot = whole(key, 6);
      if (!part || !partId || !slot) return [];
      // Old PlayerData leaves rarity implicit when a Star Rail relic ID is recorded.
      const tier = /^([3-6])[13]\d{3}$/u.exec(partId);
      return [{ id: partId, slot, name: "", image: "", level: whole(part.level, 15),
        rarity: whole(part.star, 5) ?? (tier ? Number(tier[1]) - 1 : undefined), subs: [],
        legacyMainId: String(part.mainId ?? ""), legacySubIds: Array.isArray(part.attrIds) ? part.attrIds.filter(id => typeof id === "string").slice(0, 4) : [] }];
    });
    const traces = Array.isArray(row.trees) ? row.trees.map(id).filter(Boolean).slice(0, 24).map(id => ({ id, active: true, icon: "", name: "" })) : [];
    const stamp = typeof row._time === "string" ? Date.parse(row._time)
      : typeof row._time === "number" && Number.isSafeInteger(row._time) && row._time >= 1e9 && row._time <= 9_999_999_999_999
        ? (row._time < 1e11 ? row._time * 1000 : row._time) : NaN;
    parsed.push({ id: avatarId, name, level, rank: whole(row.cons, 6), element: text(row.elem), path: "", face: "", splash: "",
      skills, traces, stars: [], stats: [], legacy: { source, promote: whole(row.promote, 6), updatedAt: Number.isFinite(stamp) ? new Date(stamp).toISOString() : undefined,
        dataComplete: Array.isArray(row.trees) && relics.length === legacyParts.length }, cone: gear && coneId ? { id: coneId, name: text(gear.name), image: "", description: "",
        rank: whole(gear.affix, 5), level: whole(gear.level, 80), promote: whole(gear.promote, 6) } : undefined, relics });
  }
  const time = whole(data?._profile, 9_999_999_999_999);
  const updatedAt = time && time >= 1_000_000_000 ? new Date(time < 1e11 ? time * 1000 : time).toISOString() : undefined;
  return { version: 1, uid, source: "legacy", updatedAt, avatars: parsed };
}
