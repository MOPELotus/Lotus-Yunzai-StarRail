import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readMiaoArrayExport } from "@lotus-yunzai/gacha/miao-data";
import type { StarRailGachaDetailOptions } from "./gacha-detail.ts";

interface Period {
  readonly version: string;
  readonly half: string;
  readonly from: string;
  readonly to: string;
  readonly char5: readonly string[];
  readonly weapon5: readonly string[];
}

const localTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;

function timestamp(time: unknown): number {
  if (typeof time !== "string") return NaN;
  return Date.parse(localTime.test(time) ? `${time.replace(" ", "T")}+08:00` : time);
}

function names(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((name) => typeof name === "string" && name.trim() === name && !!name);
}

function period(row: unknown): row is Period {
  if (!row || typeof row !== "object") return false;
  const { version, half, from, to, char5, weapon5 } = row as Partial<Period>;
  return typeof version === "string" && /^\d+(?:\.\d+)+$/u.test(version) && typeof half === "string" && !!half &&
    typeof from === "string" && localTime.test(from) && typeof to === "string" && localTime.test(to) &&
    timestamp(from) < timestamp(to) && names(char5) && names(weapon5);
}

/** The original export uses literal flow collections, which can be read without running the theme's JavaScript. */
export function parseStarRailGachaSchedule(source: string): readonly Period[] {
  const periods = readMiaoArrayExport(source, "poolDetailSr");
  return periods.every(period) ? periods : [];
}

export async function readStarRailGachaSchedule(root: string): Promise<readonly Period[]> {
  try {
    const source = await readFile(join(root, "meta-sr", "info", "index.js"), "utf8");
    return parseStarRailGachaSchedule(source);
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === "ENOENT" || code === "ENOTDIR") return [];
    throw error;
  }
}

export function resolveStarRailDetailPool(schedule: readonly Period[]): NonNullable<StarRailGachaDetailOptions["resolvePool"]> {
  const periods = schedule.map((row) => ({ ...row, start: timestamp(row.from), end: timestamp(row.to) }));
  const last = periods.at(-1);
  return ({ time, name, gacha_type }) => {
    if (gacha_type !== "11" && gacha_type !== "12") return;
    const when = timestamp(time);
    const match = periods.find(({ start, end }) => start < when && when < end);
    if (match) return { isUp: (gacha_type === "11" ? match.char5 : match.weapon5).includes(name), isNewPool: false };
    if (last && when > last.end) return { isNewPool: true };
  };
}
