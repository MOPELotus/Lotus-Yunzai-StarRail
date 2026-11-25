import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gameCommandProfileId, type GameRole } from "@lotus-yunzai/account";
import { readTheme, readPanelTalentCons } from "./panel-card.ts";
import { id, object, text, whole, normalizePanel, recoverStarRailSkillLevel, isStarRailTalentUnlocks, type PanelAvatar } from "./panel-model.ts";

const prefix = /^(?:#星铁|\*)\s*/u;
const target = String.raw`(?:\s*(?:档案\s*)?(\d{1,3}))?$`;
const roster = new RegExp(String.raw`^(?:角色|查询|查询角色|角色查询|人物)${target}`, "u");
const talent = new RegExp(String.raw`^(?:我的)?((?:今日|今天|明日|明天|周[1-6一二三四五六])*)([五四54]星)?(?:技能|天赋|行迹)+(?:汇总|统计|列表)?${target}`, "u");

export function parseStarRailPersonalRoster(message: string) {
  const start = prefix.exec(message);
  if (!start) return;
  const command = message.slice(start[0].length).trim();
  const named = roster.exec(command);
  if (named) return { mode: "roster" as const, profileId: gameCommandProfileId("sr", named[1]) };
  const traces = talent.exec(command);
  if (!traces) return;
  const [, day, rarity, profileId] = traces;
  return { mode: "talent" as const, profileId: gameCommandProfileId("sr", profileId), day: day ?? "",
    rarity: rarity ? /五|5/u.test(rarity) ? 5 : 4 : undefined };
}

export type RosterCommand = NonNullable<ReturnType<typeof parseStarRailPersonalRoster>>;
type Json = Record<string, unknown>;
type Theme = Awaited<ReturnType<typeof readTheme>>;

export interface RosterResponse {
  readonly roster: readonly Json[];
  readonly talents: readonly Json[];
  readonly summary: {
    readonly nickname: string; readonly level?: number; readonly avatarId?: number;
    readonly achievement?: number; readonly activeDays?: number; readonly avatarCount?: number;
  };
}

// Star Rail materials lack the Genshin weekly book fields. Miao's date selector
// keeps all rows on Sunday, and filters to an empty list on the other days.
export function starRailRosterWeek(day: string, now: Date) {
  const shiftedTime = now.valueOf() + 4 * 3_600_000;
  if (/今天|今日/u.test(day)) return new Date(shiftedTime).getUTCDay() || 7;
  if (/明天|明日/u.test(day)) return new Date(shiftedTime + 86_400_000).getUTCDay() || 7;
  const weekday = /周([1-6一二三四五六])/u.exec(day)?.[1];
  if (weekday) return Number(weekday) || $t("personal-roster-model.text_e7f1021cc2").indexOf(weekday) + 1;
}

function boundedId(value: unknown) {
  const parsed = id(value);
  return /^[1-9]\d{0,5}$/u.test(parsed) ? parsed : "";
}

function safePart(value: string) {
  return value.length > 0 && value !== "." && value !== ".." && !/[\/\\\p{Cc}]/u.test(value);
}

async function local(theme: Theme, ...parts: string[]) {
  if (!parts.every(safePart)) return "";
  const path = join(theme.root, "meta-sr", ...parts);
  return await Bun.file(path).exists() ? pathToFileURL(path).href : "";
}

const coreSkills = ["a", "e", "q", "t"] as const;
type SkillLevel = { level?: number; original?: number };

async function readSkills(detail: PanelAvatar | undefined, theme: Theme, rank: number | undefined): Promise<SkillLevel[]> {
  if (!detail) return coreSkills.map(() => ({}));
  const unlocks = await readPanelTalentCons(detail, theme);
  return coreSkills.map(key => {
    const skill = detail.skills.find(row => row.key === key);
    if (!skill) return {};
    const upgrade = unlocks?.[key];
    const original = rank !== undefined && (rank === 0 || isStarRailTalentUnlocks(upgrade))
      ? recoverStarRailSkillLevel(key, skill.level, rank, 0, upgrade) : undefined;
    return { level: skill.level, original };
  });
}

const coneKeys = ["id", "equipment_id", "weapon_id"] as const;

function coneData(basic: Json, detail: PanelAvatar | undefined, theme: Theme) {
  const source = object(basic.weapon ?? basic.equip ?? basic.equipment);
  let coneId = source ? coneKeys.map(key => boundedId(source[key])).find(Boolean) || "" : "";
  if (!coneId && source) {
    const label = text(source.name);
    if (label) {
      const found = Object.entries(theme.weapons).filter(([, value]) => text(object(value)?.name) === label);
      if (found.length === 1) coneId = found[0]![0];
    }
  }
  coneId ||= detail?.cone?.id ?? "";
  const meta = object(theme.weapons[coneId]);
  const name = text(meta?.name) || text(source?.name) || detail?.cone?.name || "";
  if (!name && !coneId) return;
  return {
    name, folder: text(meta?.name) || name, path: text(meta?.type) || text(source?.type) || detail?.path || "",
    level: whole(source?.level, 80) ?? detail?.cone?.level,
    rarity: whole(source?.rarity, 5) ?? whole(meta?.star, 5),
    rank: whole(source?.affix_level ?? source?.rank ?? source?.affix, 5) ?? detail?.cone?.rank,
  };
}

async function equippedSets(row: Json, detail: PanelAvatar | undefined, theme: Theme) {
  const lists = [row.relics, row.ornaments, row.reliquaries].flatMap(raw => Array.isArray(raw) ? raw : []);
  const counts = new Map<string, number>();
  const itemIds = lists.length ? lists.map(item => boundedId(object(item)?.id)) : detail?.relics.map(item => item.id) ?? [];
  for (const item of itemIds) {
    const set = theme.relicById.get(item)?.asset[1];
    if (set) counts.set(set, (counts.get(set) ?? 0) + 1);
  }
  return (await Promise.all([...counts].filter(([, n]) => n >= 2).map(([set]) =>
    local(theme, "artifact", set, theme.relicSets.get(set)?.outer ? "arti-1.webp" : "arti-5.webp")))).filter(Boolean);
}

async function avatarRow(row: Json, detail: PanelAvatar | undefined, theme: Theme) {
  const base = boundedId(row.id ?? row.avatar_id);
  const avatarId = detail?.id ?? base;
  const catalog = object(theme.characters[avatarId]);
  const name = text(catalog?.name) || detail?.name || text(row.name ?? row.name_mi18n ?? row.avatar_name);
  const level = whole(row.level, 80) ?? detail?.level;
  const rarity = whole(row.rarity, 5) ?? whole(catalog?.star, 5) ?? detail?.rarity;
  if (!base || !level || !name) throw new Error($t("personal-roster-model.text_dc2b635aa3"));
  const rank = whole(row.rank ?? row.actived_constellation_num, 6) ?? detail?.rank;
  const cone = coneData(row, detail, theme);
  const [face, skills, sets, coneIcon] = await Promise.all([
    local(theme, "character", name, "imgs", "face.webp").then(url => url || local(theme, "character", name, "imgs", "face-q.webp")),
    readSkills(detail, theme, rank), equippedSets(row, detail, theme),
    cone ? local(theme, "weapon", cone.path, cone.folder, "icon-s.webp") : "",
  ]);
  const skillTotal = skills.every(skill => skill.original !== undefined)
    ? skills.reduce((sum, skill) => sum + (skill.original ?? 0), 0) : 4;
  return { id: avatarId, name, label: text(catalog?.abbr) || name, level, rarity, rank, face, skills, sets, skillTotal,
    cone: cone && { ...cone, image: coneIcon } };
}

function compare(left: Awaited<ReturnType<typeof avatarRow>>, right: Awaited<ReturnType<typeof avatarRow>>) {
  return right.level - left.level || (right.rarity ?? -1) - (left.rarity ?? -1) ||
    right.skillTotal - left.skillTotal || (right.rank ?? -1) - (left.rank ?? -1) ||
    (right.cone?.level ?? -1) - (left.cone?.level ?? -1) || (right.cone?.rarity ?? -1) - (left.cone?.rarity ?? -1) ||
    (right.cone?.rank ?? -1) - (left.cone?.rank ?? -1) || Number(right.id) - Number(left.id);
}

function elapsed(days: number | undefined) {
  if (!days) return "";
  const years = Math.floor(days / 365), months = Math.floor(days % 365 / 30.41);
  const remainder = Math.floor(days % 365 % 30.41);
  return [years && years + $t("personal-roster-model.text_62ef900a8f"), months && months + $t("personal-roster-model.text_e5afd16c6a"), remainder && remainder + $t("personal-roster-model.text_49da61ceee")].filter(Boolean).join("");
}

export async function buildStarRailPersonalRoster(response: RosterResponse, role: GameRole,
  command: RosterCommand, theme: Theme, signal: AbortSignal, now = new Date(), qFace = true) {
  const panels = new Map<string, PanelAvatar>();
  for (const row of response.talents) {
    const key = boundedId(row.id ?? row.avatar_id);
    if (!key || panels.has(key)) throw new Error($t("personal-roster-model.text_eac3ff3365"));
    panels.set(key, normalizePanel(role.uid, [{ ...row, id: key }]).avatars[0]!);
  }
  const seen = new Set<string>();
  const all = [];
  for (const row of response.roster) {
    signal.throwIfAborted();
    const key = boundedId(row.id ?? row.avatar_id);
    if (!key || seen.has(key)) throw new Error($t("personal-roster-model.text_124032f2f6"));
    seen.add(key);
    all.push(await avatarRow(row, panels.get(key), theme));
  }
  all.sort(compare);
  const keys = command.mode === "talent" ? command : undefined;
  const week = keys ? starRailRosterWeek(keys.day, now) : undefined;
  const rows = keys && week !== undefined && week !== 7 ? []
    : keys?.rarity ? all.filter(row => row.rarity === keys.rarity) : all;
  const preferred = String(response.summary.avatarId ?? "");
  const header = all.find(row => row.id === preferred) ?? all[0];
  const banner = (header && await local(theme, "character", header.name, "imgs", "banner.webp")) ||
    await local(theme, "character", "common", "imgs", "banner.webp");
  const face = header
    ? (qFace && (await local(theme, "character", header.name, "imgs", "face-q.webp") ||
      await local(theme, "character", header.name, "imgs", "qface.webp"))) ||
      await local(theme, "character", header.name, "imgs", "face.webp")
    : "";
  const civil = new Date(now.valueOf() + 8 * 3_600_000);
  const time = civil.toISOString().slice(5, 16).replace("T", " ");
  const materialWeek = new Date(now.valueOf() + 4 * 3_600_000).getUTCDay() || 7;
  const gold = all.reduce((sum, row) => sum + (row.rarity === 5 ? 1 + (row.rank ?? 0) : 0) +
    (row.cone?.rarity === 5 ? row.cone.rank ?? 0 : 0), 0);
  return { uid: role.uid, mode: command.mode, rows, week, materialWeek, total: all.length,
    nickname: response.summary.nickname || text(role.nickname, 60) || "#" + role.uid,
    level: response.summary.level ?? whole(role.level, 70), time,
    active: elapsed(response.summary.activeDays), banner, face,
    stats: [[$t("personal-roster-model.text_52b0e1703d"), response.summary.achievement], [$t("personal-roster-model.text_c47b54e84e"), Math.max(all.length, response.summary.avatarCount ?? 0)],
      [$t("personal-roster-model.text_6c7911d1da"), all.filter(row => row.rarity === 5).length], [$t("personal-roster-model.text_d2d186f90c"), gold]] as const,
  };
}

export type StarRailRosterModel = Awaited<ReturnType<typeof buildStarRailPersonalRoster>>;
