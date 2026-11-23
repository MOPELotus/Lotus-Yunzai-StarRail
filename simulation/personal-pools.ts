import { join } from "node:path";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { validWarpPoolName } from "./settings.ts";

export const personalWarpPoolFileLimit = 128 * 1024;
export const personalWarpPoolFolder = "personal-pools";
const pools = ["up5", "up5_2", "up4", "weapon5", "weapon4"] as const;

export interface LegacyPersonalPhase {
  readonly start?: number;
  readonly end?: number;
  readonly up5: readonly string[];
  readonly up5_2: readonly string[];
  readonly up4: readonly string[];
  readonly weapon5: readonly string[];
  readonly weapon4: readonly string[];
}

interface PersonalPools {
  readonly version: 1;
  readonly phases: readonly LegacyPersonalPhase[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return value as Record<string, unknown>;
}

function checkedNames(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20 || !value.every(validWarpPoolName)) throw new TypeError("个人跃迁卡池名单无效。");
  return [...new Set(value)];
}

function legacyTime(value: unknown): number | undefined {
  if (value === undefined) return;
  if (typeof value !== "string") throw new TypeError("个人跃迁卡池日期无效。");
  const normal = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/u.test(value)
    ? value.replace(" ", "T") + "+08:00" : value;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d)$/u.test(normal)) throw new TypeError("个人跃迁卡池日期无效。");
  const time = Date.parse(normal);
  if (!Number.isSafeInteger(time)) throw new TypeError("个人跃迁卡池日期无效。");
  return time;
}

function phase(raw: unknown, legacy: boolean): LegacyPersonalPhase {
  const row = record(raw);
  if (!row) throw new TypeError("个人跃迁卡池须为对象。");
  const start = legacy ? legacyTime(row.startTime) : row.start;
  const end = legacy ? legacyTime(row.endTime) : row.end;
  if ((start !== undefined && (typeof start !== "number" || !Number.isSafeInteger(start))) ||
      (end !== undefined && (typeof end !== "number" || !Number.isSafeInteger(end))) ||
      (start !== undefined && end !== undefined && start >= end)) throw new TypeError("个人跃迁卡池活动时间无效。");
  const names = Object.fromEntries(pools.map(key => [key, checkedNames(row[key])])) as Record<(typeof pools)[number], string[]>;
  if (!names.up5.length && !names.up5_2.length && !names.weapon5.length) throw new TypeError("个人跃迁卡池缺少五星名单。");
  return { ...names, ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) };
}

function parsePhases(value: unknown, legacy: boolean) {
  if (!Array.isArray(value) || !value.length || value.length > 128) throw new TypeError("个人跃迁卡池期数无效。");
  return value.map(row => phase(row, legacy));
}

export function parseLegacyPersonalPools(input: unknown): PersonalPools {
  const row = record(input);
  const single = row && [...pools, "startTime", "endTime"].some(key => Object.hasOwn(row, key));
  const periods = row ? single ? [row] : Object.values(row) : input;
  return { version: 1, phases: parsePhases(periods, true) };
}

export function pickPersonalPhase(phases: readonly LegacyPersonalPhase[], at: number): LegacyPersonalPhase | undefined {
  const active = phases.find(({ start, end }) => start !== undefined && end !== undefined && start < at && at < end);
  if (active) return active;
  let upcoming: LegacyPersonalPhase | undefined;
  for (const entry of phases) {
    if (entry.start !== undefined && entry.start > at && (upcoming?.start === undefined || entry.start < upcoming.start)) upcoming = entry;
  }
  return upcoming ?? phases.at(-1);
}

export function createPersonalWarpPoolReader(directory: string, lockFile: AcquireRoleArchiveLock) {
  const archive = createRoleJsonArchive(join(directory, personalWarpPoolFolder), lockFile,
    { subject: "个人跃迁卡池", lockSuffix: "personal-warp-pool", maxBytes: personalWarpPoolFileLimit, rejectNull: true });
  return async (qq: string, at: number) => {
    const value = await archive.read(qq, "1");
    if (value === null) return;
    const saved = record(value);
    if (saved?.version !== 1) throw new TypeError("个人跃迁卡池存档版本无效。");
    return pickPersonalPhase(parsePhases(saved.phases, false), at);
  };
}
