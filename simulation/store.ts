import { fileURLToPath } from "node:url";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { WarpPity } from "./draw.ts";
import type { WarpKind } from "./pools.ts";

const stateDirectory = fileURLToPath(new URL("../../../data/starrail/simulation/", import.meta.url));
const states = ["character", "cone", "standard"] as const;
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

export interface WarpBalance {
  day: number;
  special: number;
  regular: number;
  expiresAt?: number;
}
export interface WarpConversation {
  lastDay: number;
  expiresAt?: number;
  readonly pity: Record<WarpKind, WarpPity>;
  today?: { day: number; standardAndCharacter: number; cone: number; five: number; samples: { name: string; pity: number }[] };
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

export function readWarpAccount(data: unknown): WarpAccount {
  if (data === null) return { version: 1, balance: { day: 0, special: 0, regular: 0 }, conversations: {} };
  if (typeof data !== "object") throw new TypeError("模拟跃迁存档格式无效。");
  const { version, balance, conversations, legacy, reincarnatedUntil } = data as Partial<WarpAccount>;
  if (version !== 1 || !balance || !integer(balance.day) || !integer(balance.special) || !integer(balance.regular) ||
      (balance.expiresAt !== undefined && !integer(balance.expiresAt)) ||
      !conversations || typeof conversations !== "object" || Array.isArray(conversations)) throw new TypeError("模拟跃迁存档格式无效。");
  for (const [key, state] of Object.entries(conversations)) {
    if (!privateOrGroup.test(key) || !state || !integer(state.lastDay) || (state.expiresAt !== undefined && !integer(state.expiresAt)) || !state.pity || states.some((kind) => {
      const p = state.pity[kind];
      return !p || !integer(p.fiveMisses, kind === "cone" ? 79 : 89) || !integer(p.fourOrBetterMisses, 9) ||
        typeof p.nextFiveFeatured !== "boolean" || typeof p.nextFourFeatured !== "boolean";
    })) throw new TypeError("模拟跃迁保底格式无效。");
    const { today, week } = state;
    if (today !== undefined && (!today || !integer(today.day) || !integer(today.standardAndCharacter) || !integer(today.cone) ||
        !integer(today.five) || !Array.isArray(today.samples) || today.samples.length > Math.min(7, today.five) ||
        today.samples.some(item => !item || typeof item.name !== "string" || item.name.length > 120 || !integer(item.pity, 90)))) {
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
