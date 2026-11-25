import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { gameCommandProfileId, normalizeProfileRoleArtworkUrl } from "@lotus-yunzai/account";
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
      profileId: gameCommandProfileId("sr", profile), ownUid, index: Number(ordinal ?? 1),
    };
  }
  const overall = summary.exec(command);
  if (!overall) return;
  const [, time, , , slot, bareSlot, ownUid] = overall;
  return { mode: command.includes("蝗灾") ? "locust" : command.startsWith("差分") ? "tourn" : "universe",
    period: time === "上期" ? "previous" : "current", profileId: gameCommandProfileId("sr", slot ?? bareSlot), ownUid, index: 1 };
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
    name: readable(avatar.name) ?? characters[String(avatar.id ?? avatar.avatar_id)] ?? $t("rogue-model.text_c47b54e84e"),
    detail: lines([tag("Lv.", avatar.level), tag($t("rogue-model.text_9bd2d5af77"), avatar.rank), readable(avatar.element)]).join(" · "),
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
  const blessings = buffGroups.map(group => ({ name: readable(row(group.base_type)?.name) ?? $t("rogue-model.text_626357531e"),
    values: collection(group.items, 96) }));
  const persona = row(record.persona_style);
  const intensity = row(record.fury);
  const fury = intensity ? tag(Number(intensity.type) === 0 ? $t("rogue-model.text_9b9cd05286") : $t("rogue-model.text_6a19194ed3"), intensity.point) : undefined;
  const title = readable(record.name) ?? (mode === "locust" ? $t("rogue-model.text_145af1dd92") : $t("rogue-model.text_eec656bc76"));
  const overview = mode === "tourn";
  const regular = mode === "universe" || mode === "locust";
  const tournReplay = mode === "normal" || mode === "weekly";
  return {
    name: `${title} ${index} / ${count}`,
    summary: lines([tag($t("rogue-model.text_87b1bf8b51"), regular ? record.difficulty : row(record.common_info_v2)?.level),
      mode === "universe" ? tag($t("rogue-model.text_a61a58cc21"), record.score) : undefined, mode === "locust" ? fury : undefined, date(record.finish_time)]),
    sections: [
      ...section(overview ? $t("rogue-model.text_051cfe3941") : regular ? $t("rogue-model.text_883734a565") : $t("rogue-model.text_455bdd84b1"), avatars(record.final_lineup)),
      ...(regular ? section($t("rogue-model.text_d9455920fc"), items(record.base_type_list, $t("rogue-model.text_d9455920fc"))) : []),
      ...(mode === "locust" ? [
        ...section($t("rogue-model.text_0ee5ba7879"), [], Array.isArray(record.worm_weak) ? lines(record.worm_weak.map(value => readable(value))) : []),
        ...section($t("rogue-model.text_029974c481"), avatars(record.cached_avatars)),
      ] : []),
      ...(tournReplay ? [
        ...section($t("rogue-model.text_cce4a7c478"), persona ? [{ name: readable(persona.title) ?? $t("rogue-model.text_cce4a7c478"), detail: tag("Lv.", persona.style_level), icon: icon(persona.icon) }] : [],
          lines([readable(persona?.desc, 512)])),
        ...section($t("rogue-model.text_9c73451b10"), items(record.hex_miracles, $t("rogue-model.text_9c73451b10"))),
        ...section($t("rogue-model.text_046ff0a915"), items(record.formula_list, $t("rogue-model.text_4693cb34aa"))),
      ] : []),
      ...(!overview ? [
        ...section($t("rogue-model.text_d3cd6d72e0", { "value1": blessings.reduce((sum, group) => sum + group.values.length, 0) }),
          blessings.map(group => ({ name: group.name, detail: String(group.values.length) })),
          regular ? blessings.flatMap(group =>
            group.values.map(item => lines([group.name, readable(item.name), item.is_evoluted ? $t("rogue-model.text_dfd9daf043") : undefined]).join(" · "))) : []),
        ...section($t("rogue-model.text_796746cb50"), items(record.miracles, $t("rogue-model.text_37d930fcf7"))),
      ] : []),
      ...(tournReplay ? section($t("rogue-model.text_60c7d4130d"), items(record.room_card_list, $t("rogue-model.text_a59fe62777"))) : []),
      ...(mode === "locust" ? section($t("rogue-model.text_584d07ab2a"), items(record.blocks, $t("rogue-model.text_584d07ab2a"))) : []),
    ],
  };
}

export type RogueCardResult = { readonly card: RogueCard } | { readonly message: string };

export function makeRogueCard(uid: string, data: Row, request: RogueQuery): RogueCardResult {
  const { mode, period, index } = request;
  const role = row(data.role);
  const identity = lines([`UID ${uid}`, readable(role?.nickname), tag($t("rogue-model.text_74f184e26f"), role?.level)]).join("  ·  ");
  let name: string, details: Row | undefined;
  let stats: RogueTile[] = [];
  let intro: string[] = [];
  let destiny: RogueTile[] | undefined;
  if (mode === "universe") {
    name = $t("rogue-model.text_ca3ec9fa1d", { "value1": period === "current" ? $t("rogue-model.text_474da3018a") : $t("rogue-model.text_2823616a99") });
    details = row(data[period === "current" ? "current_record" : "last_record"]);
    const general = row(data.basic_info);
    const range = row(details?.basic);
    const start = date(range?.schedule_begin, false), end = date(range?.schedule_end, false);
    stats = [...pair($t("rogue-model.text_37781adb38"), general?.unlocked_skill_points), ...pair($t("rogue-model.text_29484ad587"), general?.unlocked_miracle_num),
      ...pair($t("rogue-model.text_b4d10c42c1"), general?.unlocked_buff_num), ...pair($t("rogue-model.text_962c27ad90"), range?.finish_cnt)];
    if (start && end) intro = [$t("rogue-model.text_b111e364ef", { "start": start, "end": end })];
  } else if (mode === "locust") {
    name = $t("rogue-model.text_145af1dd92");
    details = row(data.detail);
    const basic = row(data.basic), count = row(basic?.cnt);
    stats = [...pair($t("rogue-model.text_832326a854"), count?.narrow), ...pair($t("rogue-model.text_29484ad587"), count?.miracle), ...pair($t("rogue-model.text_98f7c6e851"), count?.event)];
    // The original battle record uses this fixed order for its radial chart.
    const paths = [$t("rogue-model.text_d55d4d5989"), $t("rogue-model.text_7a6335b379"), $t("rogue-model.text_135fd7b0a1"), $t("rogue-model.text_18db236249"), $t("rogue-model.text_89ae343575"), $t("rogue-model.text_85a5719200"), $t("rogue-model.text_17f4b35418")];
    const levels = Array.isArray(basic?.destiny) ? basic.destiny : undefined;
    if (levels) destiny = paths.flatMap((name, index) => pair(name, row(levels[index])?.level));
  } else {
    name = mode === "normal" ? $t("rogue-model.text_77cef6d953") : mode === "weekly"
      ? $t("rogue-model.text_f8c831320a", { "value1": period === "current" ? $t("rogue-model.text_474da3018a") : $t("rogue-model.text_2823616a99") }) : $t("rogue-model.text_a7c1d7d7f2");
    const basic = row(data.basic);
    const normalBrief = row(basic?.normal_record_brief), weeklyBrief = row(basic?.weekly_record_brief);
    const weeklyInfo = row(weeklyBrief?.common_info_v2);
    const normalLevel = row(normalBrief?.common_info_v2)?.level;
    const weeklyTitle = [undefined, "I", "II", "III", "IV", "V"][Number(weeklyInfo?.id)];
    stats = [...pair($t("rogue-model.text_8299f31de2"), basic?.season_level), ...pair(readable(normalBrief?.title) ?? $t("rogue-model.text_6b08a6a1b6"), normalLevel, normalBrief?.icon),
      ...pair($t("rogue-model.text_b52b05305b"), fraction(basic?.weekly_score, basic?.weekly_score_max)),
      ...pair($t("rogue-model.text_3dc8426143"), fraction(basic?.season_task_finished, basic?.season_task_total)),
      ...pair($t("rogue-model.text_a808054470"), fraction(basic?.possibility_gallery_finished, basic?.possibility_gallery_total))];
    details = row(data[mode !== "weekly" ? "normal_detail" : period === "current" ? "cur_week_detail" : "last_week_detail"]);
    if (mode === "weekly") intro = lines([readable(details?.weekly_name), ...(Array.isArray(details?.weekly_buff_desc)
      ? details.weekly_buff_desc.slice(0, 24).map(value => readable(value, 512)) : [])]);
    if (mode === "tourn") intro = lines([typeof basic?.finished_weekly === "boolean" ? $t("rogue-model.text_09e1c48812", { "value1": basic.finished_weekly ? $t("rogue-model.text_426e458a41") : $t("rogue-model.text_b9767701a9") }) : undefined,
      tag($t("rogue-model.text_917363249f"), weeklyTitle ?? weeklyBrief?.title)]);
  }
  const records = collection(details?.records, 64);
  if ((mode === "normal" || mode === "weekly") && !records[index - 1]) {
    return { message: $t("rogue-model.text_8ec04588b4", { "name": name, "index": index, "length": records.length }) };
  }
  if (!records.length && !stats.length && !intro.length && !destiny?.length) return { message: $t("rogue-model.text_163bb0c946", { "name": name }) };
  const visible = mode === "normal" || mode === "weekly" ? [battle(records[index - 1]!, mode, index, records.length)]
    : mode === "tourn" ? records.slice(0, 1).map(record => battle(record, mode, 1, records.length))
    : records.map((record, i) => battle(record, mode, i + 1, records.length));
  return { card: { name, identity, stats, intro, destiny, records: visible } };
}
