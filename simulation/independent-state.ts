import { join } from "node:path";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { simulateIndependentWarps, type WarpPity, type WarpPull } from "./draw.ts";
import type { WarpPool, WarpKind } from "./pools.ts";
import type { IndependentWarpSettings } from "./independent-settings.ts";
import { integer, warpDayMs, warpRetentionDays } from "./store.ts";

const names = { character: "up-char", cone: "up-weapon", standard: "normal",
  "collaboration-character": "collab-char", "collaboration-cone": "collab-weapon" } as const;
const kinds = Object.keys(names) as WarpKind[];
const retention = warpRetentionDays * warpDayMs;
const maxValueBytes = 256 * 1024;

interface PoolState extends WarpPity {
  draws: number;
  five: number;
}

interface State {
  readonly day: string;
  expiresAt: number;
  readonly pools: Record<WarpKind, PoolState>;
}

export type ReadIndependentWarpKey = (key: string) => Promise<{ raw: string; expiresAt: number } | undefined>;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function localDay(at: number) {
  const date = new Date(at);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function empty(): PoolState {
  return { fiveMisses: 0, fourOrBetterMisses: 0, nextFiveFeatured: false, nextFourFeatured: false, draws: 0, five: 0 };
}
function makeState(day: string, expiresAt: number, pool: (kind: WarpKind) => PoolState): State {
  return { day, expiresAt, pools: Object.fromEntries(kinds.map(kind => [kind, pool(kind)])) as State["pools"] };
}
function invalid(): never {
  throw new TypeError("独立星铁旧模拟保底存档格式无效。");
}

function readCurrent(input: unknown, day: string, time: number): State {
  const source = record(input);
  if (!source || !integer(source.expiresAt) || typeof source.day !== "string") invalid();
  if (source.expiresAt <= time) return makeState(day, time + retention, empty);
  const rawPools = record(source.pools);
  return makeState(day, source.expiresAt, kind => {
    const pool = record(rawPools?.[kind]);
    if (!pool || !integer(pool.fiveMisses, 90) || !integer(pool.fourOrBetterMisses) ||
        typeof pool.nextFiveFeatured !== "boolean" || typeof pool.nextFourFeatured !== "boolean" ||
        !integer(pool.draws) || !integer(pool.five, pool.draws)) invalid();
    return { fiveMisses: pool.fiveMisses, fourOrBetterMisses: pool.fourOrBetterMisses,
      nextFiveFeatured: pool.nextFiveFeatured, nextFourFeatured: pool.nextFourFeatured,
      draws: source.day === day ? pool.draws : 0, five: source.day === day ? pool.five : 0 };
  });
}

function readLegacy(entry: Awaited<ReturnType<ReadIndependentWarpKey>>, day: string, time: number): State {
  if (!entry || entry.expiresAt <= time) return makeState(day, time + retention, empty);
  if (!integer(entry.expiresAt) || entry.expiresAt > time + retention || Buffer.byteLength(entry.raw) > maxValueBytes) invalid();
  const source = record(JSON.parse(entry.raw));
  if (typeof source?.time !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(source.time)) invalid();
  return makeState(day, entry.expiresAt, kind => {
    const value = source[names[kind]];
    if (!value) return empty();
    const pool = record(value);
    if (!pool || !integer(pool.num4) || !integer(pool.num5, 90) ||
        typeof pool.isUp4 !== "boolean" || typeof pool.isUp5 !== "boolean") invalid();
    const stars = record(pool.today)?.stars;
    if (!Array.isArray(stars) || !stars.every(row => [3, 4, 5].includes(record(row)?.star as number))) invalid();
    return { fiveMisses: pool.num5, fourOrBetterMisses: pool.num4, nextFiveFeatured: pool.isUp5,
      nextFourFeatured: pool.isUp4, draws: source.time === day ? stars.length : 0,
      five: source.time === day ? stars.filter(row => record(row)?.star === 5).length : 0 };
  });
}

export function createIndependentWarpDraw(lock: AcquireRoleArchiveLock, directory: string,
  readPrevious: ReadIndependentWarpKey | undefined, signal: AbortSignal) {
  const options = { subject: "独立星铁模拟跃迁", lockSuffix: "independent-warp", maxBytes: 64 * 1024, rejectNull: true };
  const groupArchive = createRoleJsonArchive(join(directory, "independent-group"), lock, options);
  const privateArchive = createRoleJsonArchive(join(directory, "independent-private"), lock, options);
  return async ({ qq, group, time, now, pool, random, isOwner, rules }: {
    qq: string; group?: string; time: number; now: () => number; pool: WarpPool;
    random: () => number; isOwner: () => boolean; rules: IndependentWarpSettings;
  }) => {
    const archive = group ? groupArchive : privateArchive;
    const id = { qq, uid: group ?? "1" };
    const previous = await archive.read(id.qq, id.uid) === null && readPrevious
      ? await readPrevious(group ? `sr-gacha:group:${group}:user:${qq}` : `sr-gacha:private:${qq}`) : undefined;
    return archive.update<{ text: string } | { pulls: WarpPull[]; pity: number }>(id, async () => signal.throwIfAborted(), input => {
      const current = Math.max(time, now());
      const day = localDay(current);
      const state = input === null ? readLegacy(previous, day, current) : readCurrent(input, day, current);
      const selected = state.pools[pool.kind];
      if (!isOwner() && rules.dailyTenPulls !== 0 && Math.floor(selected.draws / 10) >= rules.dailyTenPulls) {
        const result = { text: `今日已抽 ${selected.draws} 抽，其中${selected.five ? `有 ${selected.five} 个五星` : "没有五星"}，明日再来吧。` };
        return input === null ? { document: state, result } : { result };
      }
      const pulls = simulateIndependentWarps(pool, selected, random);
      selected.draws = Math.min(Number.MAX_SAFE_INTEGER, selected.draws + pulls.length);
      selected.five = Math.min(Number.MAX_SAFE_INTEGER, selected.five + pulls.filter(pull => pull.rarity === 5).length);
      state.expiresAt = current + retention;
      return { document: state, result: { pulls, pity: selected.fiveMisses } };
    });
  };
}
