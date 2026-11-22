import { normalizeProfileRoleArtworkUrl } from "@lotus-yunzai/account";
import names from "./challenge-character-names.json";

type Row = Record<string, unknown>;
type Range = "current" | "previous";
type Mode = "universe" | "locust" | "tourn" | "normal" | "weekly" | "weekly-help";
export interface RogueQuery {
  readonly mode: Mode;
  readonly period: Range;
  readonly profileId: number;
  readonly ownUid?: string;
  readonly index: number;
}

const prefix = /^\s*(?:#?(?:星铁|星穹铁道|星轨|穹轨|星穹|崩铁|铁道)|[*＊])\s*/u;
const summary = /^(?:(本期|上期)?(模拟)?宇宙|(寰宇)?蝗灾|差分(?:宇宙)?)\s*(?:(?:档案\s*(\d{1,3})|(\d{1,3})|(\d{9,10})))?$/u;
const replay = /^(常规|本期|上期|本周|上周|周期)(?:差分(?:宇宙)?|演算)(?:战绩|回顾|战报|记录)?\s*(?:(\d{1,2})(?=\s|档案|$))?(?:\s*(?:档案\s*(\d{1,3})|(\d{9,10})))?$/u;

export function parseStarRailRogue(message: string): RogueQuery | undefined {
  const marker = prefix.exec(message);
  if (!marker) return;
  const command = message.slice(marker[0].length).trim();
  const detail = replay.exec(command);
  if (detail) {
    const [, name, ordinal, profile, ownUid] = detail;
    return {
      mode: name === "常规" ? "normal" : name === "周期" ? "weekly-help" : "weekly",
      period: name === "上期" || name === "上周" ? "previous" : "current",
      profileId: Number(profile ?? 1), ownUid, index: Number(ordinal ?? 1),
    };
  }
  const overall = summary.exec(command);
  if (!overall) return;
  const [, time, , , slot, bareSlot, ownUid] = overall;
  return { mode: command.includes("蝗灾") ? "locust" : command.startsWith("差分") ? "tourn" : "universe",
    period: time === "上期" ? "previous" : "current", profileId: Number(slot ?? bareSlot ?? 1), ownUid, index: 1 };
}

export interface RogueTile {
  readonly name: string;
  readonly detail?: string;
  readonly icon?: string;
  readonly secondaryIcon?: string;
  readonly rarity?: number;
}
export interface RogueSection {
  readonly name: string;
  readonly text?: readonly string[];
  readonly tiles?: readonly RogueTile[];
}
export interface RogueRecord {
  readonly name: string;
  readonly summary: readonly string[];
  readonly sections: readonly RogueSection[];
}
export interface RogueCard {
  readonly name: string;
  readonly identity: string;
  readonly stats: readonly RogueTile[];
  readonly intro: readonly string[];
  readonly destiny?: readonly RogueTile[];
  readonly records: readonly RogueRecord[];
}

const characters: Readonly<Record<string, string>> = names;
const icon = normalizeProfileRoleArtworkUrl;
function row(input: unknown): Row | undefined {
  if (input && typeof input === "object" && !Array.isArray(input)) return input as Row;
}

function collection(input: unknown, cap = 96): Row[] {
  if (Array.isArray(input)) return input.slice(0, cap).flatMap<Row>(value => row(value) ?? []);
  return [];
}

function readable(input: unknown, max = 192): string | undefined {
  if (typeof input === "string") {
    return input.replace(/<br\s*\/?\s*>/giu, " ").replace(/<[^>]{1,128}>/gu, "")
      .replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/^●\s*/u, "").trim().slice(0, max) || undefined;
  }
  if (typeof input === "number" && Number.isFinite(input) && Math.abs(input) < 1e12) return String(input);
}

function lines(parts: readonly (string | undefined)[]) {
  return parts.filter((part): part is string => Boolean(part));
}

function tag(label: string, value: unknown) {
  const text = readable(value);
  return text === undefined ? undefined : `${label} ${text}`;
}

function fraction(current: unknown, total: unknown) {
  const shown = readable(current);
  const max = readable(total);
  return shown === undefined ? undefined : max === undefined ? shown : `${shown} / ${max}`;
}

function pair(name: string, value: unknown, artwork?: unknown): RogueTile[] {
  const detail = readable(value);
  return detail === undefined ? [] : [{ name, detail, icon: icon(artwork) }];
}

function date(input: unknown, includeTime = true) {
  const value = row(input);
  if (!value) return;
  const fields = [value.year, value.month, value.day, value.hour ?? 0, value.minute ?? 0, value.second ?? 0].map(Number);
  if (fields.some((entry, i) => !Number.isInteger(entry) || entry < [2000, 1, 1, 0, 0, 0][i]! ||
      entry > [9999, 12, 31, 23, 59, 59][i]!)) return;
  const text = fields.map(entry => String(entry).padStart(2, "0"));
  const day = text.slice(0, 3).join(".");
  return includeTime ? day + " " + text.slice(3).join(":") : day;
}

function avatars(input: unknown): RogueTile[] {
  return collection(input, 16).map(avatar => ({
    name: readable(avatar.name) ?? characters[String(avatar.id ?? avatar.avatar_id)] ?? "角色",
    detail: lines([tag("Lv.", avatar.level), tag("星魂", avatar.rank), readable(avatar.element)]).join(" · "),
    icon: icon(avatar.icon), rarity: typeof avatar.rarity === "number" ? avatar.rarity : undefined,
  }));
}

function items(input: unknown, kind: string): RogueTile[] {
  return collection(input).map(item => ({
    name: readable(item.name ?? item.type_name ?? item.title) ?? kind,
    detail: lines([tag("Lv.", item.level), tag("×", item.cnt ?? item.num), readable(item.formula_category)]).join(" · "),
    icon: icon(item.icon ?? item.icon_path), secondaryIcon: icon(item.sub_icon),
    rarity: typeof item.rank === "number" ? item.rank : undefined,
  }));
}

function section(name: string, tiles: readonly RogueTile[], text?: readonly string[]): RogueSection[] {
  return tiles.length || text?.length ? [{ name, tiles, text }] : [];
}

function battle(record: Row, mode: Mode, index: number, count: number): RogueRecord {
  const buffGroups = collection(record.buffs, 24);
  const blessings = buffGroups.map(group => ({ name: readable(row(group.base_type)?.name) ?? "祝福",
    values: collection(group.items, 96) }));
  const persona = row(record.persona_style);
  const intensity = row(record.fury);
  const fury = intensity ? tag(Number(intensity.type) === 0 ? "位面紊乱倒计时" : "扰动等级", intensity.point) : undefined;
  const title = readable(record.name) ?? (mode === "locust" ? "寰宇蝗灾" : "挑战记录");
  const overview = mode === "tourn";
  const regular = mode === "universe" || mode === "locust";
  const tournReplay = mode === "normal" || mode === "weekly";
  return {
    name: `${title} ${index} / ${count}`,
    summary: lines([tag("难度", regular ? record.difficulty : row(record.common_info_v2)?.level),
      mode === "universe" ? tag("最高积分", record.score) : undefined, mode === "locust" ? fury : undefined, date(record.finish_time)]),
    sections: [
      ...section(overview ? "最新通关队伍" : regular ? "通关出战角色" : "探索队伍", avatars(record.final_lineup)),
      ...(regular ? section("命途", items(record.base_type_list, "命途")) : []),
      ...(mode === "locust" ? [
        ...section("弱化效果", [], Array.isArray(record.worm_weak) ? lines(record.worm_weak.map(value => readable(value))) : []),
        ...section("下载角色", avatars(record.cached_avatars)),
      ] : []),
      ...(tournReplay ? [
        ...section("面具", persona ? [{ name: readable(persona.title) ?? "面具", detail: tag("Lv.", persona.style_level), icon: icon(persona.icon) }] : [],
          lines([readable(persona?.desc, 512)])),
        ...section("加权奇物", items(record.hex_miracles, "加权奇物")),
        ...section("已展开方程", items(record.formula_list, "方程")),
      ] : []),
      ...(!overview ? [
        ...section(`获得祝福 · ${blessings.reduce((sum, group) => sum + group.values.length, 0)}`,
          blessings.map(group => ({ name: group.name, detail: String(group.values.length) })),
          regular ? blessings.flatMap(group =>
            group.values.map(item => lines([group.name, readable(item.name), item.is_evoluted ? "强化" : undefined]).join(" · "))) : []),
        ...section("获得奇物", items(record.miracles, "奇物")),
      ] : []),
      ...(tournReplay ? section("沿途站点", items(record.room_card_list, "站点")) : []),
      ...(mode === "locust" ? section("区域格", items(record.blocks, "区域格")) : []),
    ],
  };
}

export type RogueCardResult = { readonly card: RogueCard } | { readonly message: string };

export function makeRogueCard(uid: string, data: Row, request: RogueQuery): RogueCardResult {
  const { mode, period, index } = request;
  const role = row(data.role);
  const identity = lines([`UID ${uid}`, readable(role?.nickname), tag("开拓等级", role?.level)]).join("  ·  ");
  let name: string, details: Row | undefined;
  let stats: RogueTile[] = [];
  let intro: string[] = [];
  let destiny: RogueTile[] | undefined;
  if (mode === "universe") {
    name = `模拟宇宙 · ${period === "current" ? "本期" : "上期"}`;
    details = row(data[period === "current" ? "current_record" : "last_record"]);
    const general = row(data.basic_info);
    const range = row(details?.basic);
    const start = date(range?.schedule_begin, false), end = date(range?.schedule_end, false);
    stats = [...pair("激活技能树", general?.unlocked_skill_points), ...pair("已解锁奇物", general?.unlocked_miracle_num),
      ...pair("已解锁祝福", general?.unlocked_buff_num), ...pair("通关次数", range?.finish_cnt)];
    if (start && end) intro = [`统计周期 ${start} — ${end}`];
  } else if (mode === "locust") {
    name = "寰宇蝗灾";
    details = row(data.detail);
    const basic = row(data.basic), count = row(basic?.cnt);
    stats = [...pair("行者之道", count?.narrow), ...pair("已解锁奇物", count?.miracle), ...pair("已解锁事件", count?.event)];
    // The original battle record uses this fixed order for its radial chart.
    const paths = ["存护", "记忆", "虚无", "丰饶", "巡猎", "毁灭", "欢愉"];
    const levels = Array.isArray(basic?.destiny) ? basic.destiny : undefined;
    if (levels) destiny = paths.flatMap((name, index) => pair(name, row(levels[index])?.level));
  } else {
    name = mode === "normal" ? "差分宇宙 · 常规演算" : mode === "weekly"
      ? `差分宇宙 · ${period === "current" ? "本期" : "上期"}周期演算` : "差分宇宙 · 乐园漫记";
    const basic = row(data.basic);
    const normalBrief = row(basic?.normal_record_brief), weeklyBrief = row(basic?.weekly_record_brief);
    const weeklyInfo = row(weeklyBrief?.common_info_v2);
    const normalLevel = row(normalBrief?.common_info_v2)?.level;
    const weeklyTitle = [undefined, "I", "II", "III", "IV", "V"][Number(weeklyInfo?.id)];
    stats = [...pair("拟合等级", basic?.season_level), ...pair(readable(normalBrief?.title) ?? "常规最高通关难度", normalLevel, normalBrief?.icon),
      ...pair("本期额外拟合值", fraction(basic?.weekly_score, basic?.weekly_score_max)),
      ...pair("稳态数组奖励", fraction(basic?.season_task_finished, basic?.season_task_total)),
      ...pair("可能性画廊奖励", fraction(basic?.possibility_gallery_finished, basic?.possibility_gallery_total))];
    details = row(data[mode !== "weekly" ? "normal_detail" : period === "current" ? "cur_week_detail" : "last_week_detail"]);
    if (mode === "weekly") intro = lines([readable(details?.weekly_name), ...(Array.isArray(details?.weekly_buff_desc)
      ? details.weekly_buff_desc.slice(0, 24).map(value => readable(value, 512)) : [])]);
    if (mode === "tourn") intro = lines([typeof basic?.finished_weekly === "boolean" ? `本期首通奖励 ${basic.finished_weekly ? "已领取" : "未领取"}` : undefined,
      tag("本期最新通关难度", weeklyTitle ?? weeklyBrief?.title)]);
  }
  const records = collection(details?.records, 64);
  if ((mode === "normal" || mode === "weekly") && !records[index - 1]) {
    return { message: `未找到${name}第 ${index} 条记录，共 ${records.length} 条。` };
  }
  if (!records.length && !stats.length && !intro.length && !destiny?.length) return { message: `该档案尚无${name}战绩。` };
  const visible = mode === "normal" || mode === "weekly" ? [battle(records[index - 1]!, mode, index, records.length)]
    : mode === "tourn" ? records.slice(0, 1).map(record => battle(record, mode, 1, records.length))
    : records.map((record, i) => battle(record, mode, i + 1, records.length));
  return { card: { name, identity, stats, intro, destiny, records: visible } };
}
