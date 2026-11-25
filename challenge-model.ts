import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
// Adapted from Lotus-ReFactor services/starRailChallenge/service.js and
// core/render/starrail-abyss.js. Source and asset details are in README.md.
import { gameCommandProfileId, MAX_PROFILE_ID } from "@lotus-yunzai/account";
import type { StarRailChallengeKind, StarRailChallengeOptions, StarRailChallengePeriod } from "@lotus-yunzai/hoyo-client";

const words = /^(?:#星铁|\*)(往期|上期|本期|最新|当期)?(简易)?(深渊|忘却之庭|忘却|混沌回忆|混沌|虚构叙事|虚构|末日幻影|末日|异相仲裁|异乡|异相|异向|仲裁)\s*([1-9]\d{0,2})?$/u;
const labels = { hall: $t("challenge-model.text_59977c7f79"), story: $t("challenge-model.text_d66b949b63"), boss: $t("challenge-model.text_8dae72d970"), peak: $t("challenge-model.text_fdc6c58c58") } as const;
const aliases: Record<string, StarRailChallengeKind> = {
  忘却之庭: "hall", 忘却: "hall", 混沌回忆: "hall", 混沌: "hall",
  虚构叙事: "story", 虚构: "story", 末日幻影: "boss", 末日: "boss",
  异相仲裁: "peak", 异乡: "peak", 异相: "peak", 异向: "peak", 仲裁: "peak",
};
const coreKinds = ["hall", "story", "boss"] as const;
const rotation = ["boss", "story", "hall"] as const;
const rotationStart = Date.parse("2024-06-24T04:00:00+08:00");
const rotationPeriodMs = 14 * 24 * 60 * 60 * 1000;
export type ChallengeQuery = NonNullable<ReturnType<typeof parseChallengeQuery>>;

export function parseChallengeQuery(message: string) {
  const match = words.exec(message);
  if (!match) return;
  const [, modifier, simple, word, id] = match;
  const profileId = gameCommandProfileId("sr", id);
  if (profileId > MAX_PROFILE_ID) return;
  const period = modifier === "上期" ? "last" : modifier === "往期" ? "recent" : "current";
  const latest = word === "深渊" && (modifier === "最新" || modifier === "当期");
  const kind = aliases[word ?? ""];
  const kinds = kind ? [kind] : coreKinds;
  return { profileId, latest, kinds, simple: Boolean(simple), period } satisfies StarRailChallengeOptions & { profileId: number; latest: boolean };
}

type Json = Record<string, unknown>;
type NumberOrBlank = number | "";
export type ChallengeRecord = { kind: StarRailChallengeKind; schedule: StarRailChallengePeriod; simple: boolean; data: Json };
type NameLookup = (id: string) => string | undefined;

function object(value: unknown): Json | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Json;
}

function items(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(object).filter((row): row is Json => row !== undefined) : [];
}

function text(value: unknown, limit = 120): string {
  return typeof value === "string" ? value.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim().slice(0, limit) : "";
}

function number(value: unknown, limit = 99_999_999): NumberOrBlank {
  const n = typeof value === "string" && /^\d{1,9}$/u.test(value) ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= limit ? n : "";
}

function flag(value: unknown) {
  if (typeof value === "boolean") return value;
}

function dateParts(value: unknown) {
  if (typeof value === "string") {
    const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2})?)?$/u.exec(value);
    if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
      hour: Number(match[4] ?? 0), minute: Number(match[5] ?? 0) };
    return;
  }
  const time = object(value);
  const year = number(time?.year, 2099), month = number(time?.month, 12), day = number(time?.day, 31);
  if (!year || year < 2010 || !month || !day) return;
  return { year, month, day, hour: number(time?.hour, 23) || 0, minute: number(time?.minute, 59) || 0 };
}

function timestamp(value: unknown) {
  const date = dateParts(value);
  return date ? Date.UTC(date.year, date.month - 1, date.day, date.hour - 8, date.minute) : 0;
}

function dateText(value: unknown, withTime = false): string {
  const date = dateParts(value);
  if (!date) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = `${date.year}.${pad(date.month)}.${pad(date.day)}`;
  return withTime ? `${day} ${pad(date.hour)}:${pad(date.minute)}` : day;
}

function periodText(begin: unknown, end: unknown) {
  return [dateText(begin), dateText(end)].filter(Boolean).join(" - ");
}

function avatar(row: Json, names: NameLookup) {
  const id = number(row.id ?? row.avatar_id);
  return {
    id, name: text(row.name_mi18n) || text(row.name) || names(String(id)) || (id ? $t("challenge-model.text_74ec23c7dc", { "id": id }) : ""),
    icon: text(row.icon, 2048), rarity: number(row.rarity, 5), rank: number(row.rank, 6), level: number(row.level, 100),
  };
}

function node(row: Json | undefined, label: string, names: NameLookup) {
  if (!row) return;
  const buff = object(row.buff);
  const value = {
    label, score: number(row.score), round: number(row.round_num), defeated: flag(row.boss_defeated),
    time: dateText(row.challenge_time, true) || dateText(row.challengeTime, true),
    buff: [text(buff?.name_mi18n) || text(buff?.name), text(buff?.desc_mi18n, 240)].filter(Boolean).join("："),
    avatars: items(row.avatars).slice(0, 8).map(row => avatar(row, names)),
  };
  if (value.score !== "" || value.round !== "" || value.defeated !== undefined || value.time || value.buff || value.avatars.length) return value;
}

function floor(row: Json, names: NameLookup) {
  if (row.is_fast === true) return;
  const nodes = ["node_1", "node_2", "node_3"].flatMap((key, index) => node(object(row[key]), $t("challenge-model.text_84fea9b648", { "value1": index + 1 }), names) ?? []);
  const value = {
    mazeId: number(row.maze_id), title: text(row.name) || text(row.floor) || $t("challenge-model.text_ff534801b8"),
    score: number(row.score), stars: number(row.star_num, 4), round: number(row.round_num), tierce: row.is_tierce === true, nodes,
  };
  if (value.score !== "" || value.stars !== "" || value.round !== "" || nodes.length) return value;
}

function peakFight(row: Json, names: NameLookup) {
  return {
    stars: number(row.star_num, 3), round: number(row.round_num),
    cleared: flag(row.has_challenge_record),
    time: dateText(row.challenge_time, true),
    avatars: items(row.avatars).slice(0, 8).map(row => avatar(row, names)),
  };
}

function peakRecord(row: Json, names: NameLookup, summaryBattleNum: NumberOrBlank) {
  const group = object(row.group);
  const boss = object(row.boss_record);
  const bossInfo = object(row.boss_info);
  const mobs = items(row.mob_records);
  const battleNum = number(row.battle_num);
  return {
    title: [text(group?.game_version), text(group?.name_mi18n) || $t("challenge-model.text_fdc6c58c58")].filter(Boolean).join(" "),
    period: periodText(group?.begin_time, group?.end_time), ended: group?.status === "End", bossStars: number(row.boss_stars),
    mobStars: number(row.mob_stars), battleNum: battleNum === "" ? summaryBattleNum : battleNum,
    boss: boss && {
      ...peakFight(boss, names), title: text(bossInfo?.name_mi18n) || $t("challenge-model.text_eb437ddad0"),
      icon: text(bossInfo?.icon, 2048), hard: boss.hard_mode === true,
    },
    mobs: items(row.mob_infos).slice(0, 3).map((info, index) => {
      const id = number(info.maze_id);
      const record = (id === "" ? undefined : mobs.find(mob => number(mob.maze_id) === id)) ?? mobs[index] ?? {};
      return {
        ...peakFight(record, names),
        title: [text(info.name), text(info.monster_name)].filter(Boolean).join(" · ") || $t("challenge-model.text_e582bdeb29", { "value1": index + 1 }),
        icon: text(info.monster_icon, 2048), fast: record.is_fast === true,
      };
    }),
  };
}

function toResult({ kind, schedule, simple, data }: ChallengeRecord, query: ChallengeQuery, names: NameLookup) {
  const groups = items(data.groups);
  const group = groups.find(group => String(group.schedule_id) === String(data.schedule_id) && data.schedule_id !== undefined)
    ?? groups.find(group => group.status === (schedule === "1" ? "New" : "End")) ?? groups[0];
  const begin = kind === "hall" ? data.begin_time ?? group?.begin_time : group?.begin_time ?? data.begin_time;
  const end = kind === "hall" ? data.end_time ?? group?.end_time : group?.end_time ?? data.end_time;
  const floorRows = items(data.all_floor_detail);
  const maxFloor = object(data.max_floor_detail);
  if (maxFloor) floorRows.push(maxFloor);
  const peakRows = items(data.challenge_peak_records);
  const groupStatus = (row: Json) => object(row.group)?.status;
  const previous = peakRows.find(row => groupStatus(row) === "End") ?? (peakRows.some(row => groupStatus(row) === "New") ? undefined : peakRows[0]);
  const peak = query.period === "recent" ? peakRows
    : [query.period === "last" ? previous : peakRows[0]].filter((value): value is Json => Boolean(value));
  const summaryBattleNum = number(object(data.challenge_peak_best_record_brief)?.total_battle_num);
  const periodLabel = query.period === "last" ? $t("challenge-model.text_76ad936906") : query.period === "recent" && kind === "peak" ? $t("challenge-model.text_d804b36cc9") : $t("challenge-model.text_ad7d0caa30");
  return {
    kind, label: labels[kind], periodLabel, simple, startedAt: timestamp(begin), endsAt: timestamp(end),
    period: periodText(begin, end), stars: number(data.star_num ?? data.total_star), extraStars: number(data.extra_star_num),
    maxFloor: text(data.max_floor), maxFloorId: number(data.max_floor_id), battleNum: number(data.battle_num),
    floors: floorRows.flatMap(row => floor(row, names) ?? []), peak: peak.map(row => peakRecord(row, names, summaryBattleNum)),
  };
}

export function normalizeStarRailChallenge(records: readonly ChallengeRecord[], query: ChallengeQuery, names: NameLookup, now = Date.now()) {
  const results = records.map(record => toResult(record, query, names));
  if (!query.latest || results.length < 2) return results;
  const dated = results.filter(({ startedAt, endsAt }) => startedAt > 0 && startedAt <= now && (!endsAt || endsAt > now));
  if (dated.length) return [dated.reduce((latest, record) => record.startedAt > latest.startedAt ? record : latest)];
  // The original command uses the fixed fourteen-day cycle when the API has no usable period dates.
  const period = Math.max(0, Math.floor((now - rotationStart) / rotationPeriodMs));
  const current = results.find(({ kind }) => kind === rotation[period % rotation.length]);
  return current ? [current] : results;
}

export type ChallengeResult = ReturnType<typeof normalizeStarRailChallenge>[number];

export function makeChallengeText(uid: string, results: readonly ChallengeResult[]) {
  const present = (value: NumberOrBlank) => value === "" ? $t("challenge-model.text_b336a174cd") : $t("challenge-model.text_31af0a4666", { "value": value });
  return [$t("challenge-model.text_c826a64644", { "uid": uid }), ...results.flatMap(result => [
    `${result.label}${result.simple ? $t("challenge-model.text_71348487cd") : ""}${result.period ? ` · ${result.period}` : ""}`,
    ...(result.kind === "peak" ? result.peak.length
      ? result.peak.map(record => $t("challenge-model.text_1232770238", { "title": record.title, "value2": present(record.bossStars), "value3": present(record.mobStars) }))
      : [$t("challenge-model.text_e56e895cf1")] : [$t("challenge-model.text_d7c0389bf3", { "value1": present(result.stars), "value2": result.maxFloor ? ` · ${result.maxFloor}` : "" })]),
  ])].join("\n");
}
