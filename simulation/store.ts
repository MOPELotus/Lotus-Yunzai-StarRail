import { lstat, mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { WarpPity } from "./draw.ts";
import type { CollaborationWarpKind, WarpKind } from "./pools.ts";

const stateDirectory = fileURLToPath(new URL("../../../data/starrail/simulation/", import.meta.url));
const states = ["character", "cone", "standard"] as const;
const collaborationStates = ["collaboration-character", "collaboration-cone"] as const;
const privateOrGroup = /^(?:private|[1-9]\d*)$/u;
const beijingDayShift = 14_400_000;
export const warpDayMs = 86_400_000;
export const warpRetentionDays = 14;
export const warpDay = (time: number) => Math.floor((time + beijingDayShift) / warpDayMs);
export const warpDayStart = (day: number) => day * warpDayMs - beijingDayShift;
export const warpWeek = (time: number) => Math.floor((time + 8 * 3_600_000 + 4 * warpDayMs) / (7 * warpDayMs));

export function warpStateDirectory() {
  return Bun.env.LOTUS_STAR_RAIL_WARP_STATE_DIR?.trim() || stateDirectory;
}

export function createWarpArchive(directory: string, lockFile: AcquireRoleArchiveLock) {
  return createRoleJsonArchive(directory, lockFile, {
    subject: "星铁模拟跃迁", lockSuffix: "warp-lock", maxBytes: 1024 * 1024, rejectNull: true,
  });
}

export async function lockWarpReincarnation(directory: string, qq: string, lock: AcquireRoleArchiveLock) {
  if (!/^[1-9]\d*$/u.test(qq) || !integer(Number(qq))) throw new TypeError("星铁转生的 QQ 无效。");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const root = join(await realpath(directory), "reincarnation-locks");
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (!(await lstat(root)).isDirectory() || await realpath(root) !== root) {
    throw new Error("星铁转生锁目录须为实体目录。");
  }
  return lock(join(root, `${qq}.sqlite`), "星铁转生");
}

export interface WarpBalance {
  day: number;
  special: number;
  regular: number;
  expiresAt?: number;
}
interface WarpFiveSummary {
  five: number;
  samples: { name: string; pity: number }[];
}
export interface WarpConversation {
  lastDay: number;
  expiresAt?: number;
  readonly pity: Record<Exclude<WarpKind, CollaborationWarpKind>, WarpPity> & Partial<Record<CollaborationWarpKind, WarpPity>>;
  today?: WarpFiveSummary & { day: number; standardAndCharacter: number; cone: number;
    collaboration?: Partial<Record<CollaborationWarpKind, WarpFiveSummary & { draws: number }>> };
  week?: { id: number; five: number };
}
interface WarpAccount {
  readonly version: 1;
  balance: WarpBalance;
  readonly conversations: Record<string, WarpConversation>;
  legacy?: { balance?: true; conversations: string[] };
  reincarnatedUntil?: number;
}

export function integer(value: unknown, upper = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= upper;
}

function validPity(pity: WarpPity | undefined, kind: WarpKind) {
  const cone = kind === "cone" || kind === "collaboration-cone";
  return !!pity && integer(pity.fiveMisses, cone ? 79 : 89) && integer(pity.fourOrBetterMisses, 9) &&
    typeof pity.nextFiveFeatured === "boolean" && typeof pity.nextFourFeatured === "boolean";
}

function validFiveSummary(summary: WarpFiveSummary) {
  return integer(summary.five) && Array.isArray(summary.samples) && summary.samples.length <= Math.min(7, summary.five) &&
    summary.samples.every(item => !!item && typeof item.name === "string" && item.name.length <= 120 && integer(item.pity, 90));
}

export function readWarpAccount(data: unknown): WarpAccount {
  if (data === null) return { version: 1, balance: { day: 0, special: 0, regular: 0 }, conversations: {} };
  if (typeof data !== "object") throw new TypeError("模拟跃迁存档格式无效。");
  const { version, balance, conversations, legacy, reincarnatedUntil } = data as Partial<WarpAccount>;
  if (version !== 1 || !balance || !integer(balance.day) || !integer(balance.special) || !integer(balance.regular) ||
      (balance.expiresAt !== undefined && !integer(balance.expiresAt)) ||
      !conversations || typeof conversations !== "object" || Array.isArray(conversations)) throw new TypeError("模拟跃迁存档格式无效。");
  for (const [key, state] of Object.entries(conversations)) {
    if (!privateOrGroup.test(key) || !state || !integer(state.lastDay) || (state.expiresAt !== undefined && !integer(state.expiresAt)) ||
        !state.pity || states.some(kind => !validPity(state.pity[kind], kind)) ||
        collaborationStates.some(kind => Object.hasOwn(state.pity, kind) && !validPity(state.pity[kind], kind))) {
      throw new TypeError("模拟跃迁保底格式无效。");
    }
    const { today, week } = state;
    if (today !== undefined && (!today || !integer(today.day) || !integer(today.standardAndCharacter) || !integer(today.cone) ||
        !validFiveSummary(today) || (today.collaboration !== undefined && (!today.collaboration || typeof today.collaboration !== "object" ||
          Array.isArray(today.collaboration) || Object.keys(today.collaboration).some(key => !collaborationStates.some(kind => kind === key)) ||
          Object.values(today.collaboration).some(value => !value || !integer(value.draws) || !validFiveSummary(value)))))) {
      throw new TypeError("模拟跃迁日统计格式无效。");
    }
    if (week !== undefined && (!week || !integer(week.id) || !integer(week.five))) throw new TypeError("模拟跃迁周统计格式无效。");
  }
  if (legacy !== undefined && (!legacy || (legacy.balance !== undefined && legacy.balance !== true) ||
      !Array.isArray(legacy.conversations) || legacy.conversations.some((key) => typeof key !== "string" || !privateOrGroup.test(key)) ||
      new Set(legacy.conversations).size !== legacy.conversations.length)) throw new TypeError("旧模拟跃迁迁移记录无效。");
  if (reincarnatedUntil !== undefined && !integer(reincarnatedUntil)) throw new TypeError("星铁转生冷却格式无效。");
  return { version, balance, conversations, legacy, reincarnatedUntil };
}
