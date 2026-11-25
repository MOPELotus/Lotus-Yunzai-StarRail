import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
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
  if (!Array.isArray(value) || value.length > 20 || !value.every(validWarpPoolName)) throw new TypeError($t("simulation.personal-pools.text_050559e78f"));
  return [...new Set(value)];
}

function legacyTime(value: unknown): number | undefined {
  if (value === undefined) return;
  if (typeof value !== "string") throw new TypeError($t("simulation.personal-pools.text_01eaadffb9"));
  const normal = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d$/u.test(value)
    ? value.replace(" ", "T") + "+08:00" : value;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d)$/u.test(normal)) throw new TypeError($t("simulation.personal-pools.text_01eaadffb9"));
  const time = Date.parse(normal);
  if (!Number.isSafeInteger(time)) throw new TypeError($t("simulation.personal-pools.text_01eaadffb9"));
  return time;
}

function phase(raw: unknown, legacy: boolean): LegacyPersonalPhase {
  const row = record(raw);
  if (!row) throw new TypeError($t("simulation.personal-pools.text_6effed0111"));
  const start = legacy ? legacyTime(row.startTime) : row.start;
  const end = legacy ? legacyTime(row.endTime) : row.end;
  if ((start !== undefined && (typeof start !== "number" || !Number.isSafeInteger(start))) ||
      (end !== undefined && (typeof end !== "number" || !Number.isSafeInteger(end))) ||
      (start !== undefined && end !== undefined && start >= end)) throw new TypeError($t("simulation.personal-pools.text_2be3bc6375"));
  const names = Object.fromEntries(pools.map(key => [key, checkedNames(row[key])])) as Record<(typeof pools)[number], string[]>;
  if (!names.up5.length && !names.up5_2.length && !names.weapon5.length) throw new TypeError($t("simulation.personal-pools.text_2b72efbff7"));
  return { ...names, ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) };
}

function parsePhases(value: unknown, legacy: boolean) {
  if (!Array.isArray(value) || !value.length || value.length > 128) throw new TypeError($t("simulation.personal-pools.text_1de1f595d1"));
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
    { subject: $t("simulation.personal-pools.text_f20d87a853"), lockSuffix: "personal-warp-pool", maxBytes: personalWarpPoolFileLimit, rejectNull: true });
  return async (qq: string, at: number) => {
    const value = await archive.read(qq, "1");
    if (value === null) return;
    const saved = record(value);
    if (saved?.version !== 1) throw new TypeError($t("simulation.personal-pools.text_cdc1b12ba9"));
    return pickPersonalPhase(parsePhases(saved.phases, false), at);
  };
}
