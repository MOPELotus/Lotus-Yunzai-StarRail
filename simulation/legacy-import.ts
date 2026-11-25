import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { readFile, stat } from "node:fs/promises";
import type { AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { WarpPity } from "./draw.ts";
import { createWarpArchive, integer, readWarpAccount, warpDay, warpDayMs, warpDayStart, warpRetentionDays, warpWeek,
  type WarpBalance, type WarpConversation } from "./store.ts";

const prefix = "Yz:flower-plugin:";
const legacyRetention = warpRetentionDays * warpDayMs;
const maxValueBytes = 256 * 1024;

type Scope = { readonly qq: string; readonly balance: boolean; readonly conversations: readonly string[] };
interface ImportOptions {
  readonly sourceUrl: string;
  readonly authorizationFile: string;
  readonly destinationDirectory: string;
  readonly apply: boolean;
  readonly now?: () => number;
  readonly signal?: AbortSignal;
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
}

function identity(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{0,15}$/u.test(value) && Number.isSafeInteger(Number(value));
}

async function authorizedScope(file: string): Promise<Scope[]> {
  let root: Record<string, unknown> | undefined;
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > 1024 * 1024) throw new Error();
    root = record(JSON.parse(await readFile(file, "utf8")));
  } catch { throw new TypeError($t("simulation.legacy-import.text_979882c890")); }
  const accounts = root?.accounts;
  if (root?.source !== "starrail-only-copy" || !Array.isArray(accounts) || accounts.length === 0 || accounts.length > 1000) {
    throw new TypeError($t("simulation.legacy-import.text_21fd3cd6ea"));
  }
  const seen = new Set<string>();
  return accounts.map((entry: unknown) => {
    const row = record(entry);
    const qq = row?.qq;
    const balance = row?.balance ?? false;
    const conversations: unknown = row?.conversations ?? [];
    if (!identity(qq) || seen.has(qq) || typeof balance !== "boolean" || !Array.isArray(conversations) ||
        (!balance && conversations.length === 0) || conversations.length > 200 ||
        conversations.some((key) => key !== "private" && !identity(key)) || new Set(conversations).size !== conversations.length) {
      throw new TypeError($t("simulation.legacy-import.text_706bea3105"));
    }
    seen.add(qq);
    return { qq, balance, conversations };
  });
}

type LegacySource = { readonly expiresAt: number; readonly data: Record<string, unknown> };
async function readKey(redis: InstanceType<typeof Bun.RedisClient>, key: string, now: () => number, maximumAge: number): Promise<LegacySource | "missing" | "expired"> {
  let raw: string | null;
  let expiresAt: unknown;
  const start = now();
  try {
    raw = await redis.get(key);
    if (raw === null) return "missing";
    expiresAt = await redis.send("PEXPIRETIME", [key]);
  } catch { throw new Error($t("simulation.legacy-import.text_793d124c50")); }
  if (expiresAt === -2 || (integer(expiresAt) && expiresAt <= now())) return "expired";
  if (!integer(expiresAt) || expiresAt > Math.max(start, now()) + maximumAge || Buffer.byteLength(raw, "utf8") > maxValueBytes) {
    throw new TypeError($t("simulation.legacy-import.text_c6d5482818"));
  }
  try {
    const data = record(JSON.parse(raw));
    if (data) return { data, expiresAt };
  } catch {}
  throw new TypeError($t("simulation.legacy-import.text_40cfe962b0"));
}

function balanceFrom({ data, expiresAt }: LegacySource, now: number): LegacyBalance | undefined {
  const day = warpDay(now);
  if (!integer(data.expire, Math.floor(Number.MAX_SAFE_INTEGER / 1000)) || !integer(data.pink) || !integer(data.blue)) {
    throw new TypeError($t("simulation.legacy-import.text_a7909776c6"));
  }
  const end = data.expire * 1000;
  if (expiresAt <= now || end <= warpDayStart(day)) return;
  const boundary = warpDayStart(day + 1);
  if (end !== boundary && end !== boundary - 1000) throw new TypeError($t("simulation.legacy-import.text_7e2f82bb66"));
  return { day, special: data.pink, regular: data.blue, expiresAt };
}

function pityFrom(value: unknown, hardLimit: number, hasFeatured: boolean): WarpPity {
  const data = record(value);
  if (!integer(data?.num4, 9) || !integer(data?.num5, hardLimit) || !integer(data?.isUp4, 1) || !integer(data?.isUp5, 1)) {
    throw new TypeError($t("simulation.legacy-import.text_e00c142ade"));
  }
  return { fiveMisses: Math.min(data.num5, hardLimit - 1), fourOrBetterMisses: data.num4,
    nextFourFeatured: hasFeatured && data.isUp4 === 1, nextFiveFeatured: hasFeatured && data.isUp5 === 1 };
}

type LegacyConversation = WarpConversation & { expiresAt: number };
type LegacyBalance = WarpBalance & { expiresAt: number };

function conversationFrom({ data, expiresAt }: LegacySource, now: number): LegacyConversation {
  const weapon = record(data.weapon);
  if (weapon && ("type" in weapon || "lifeNum" in weapon || "bingWeapon" in weapon)) {
    throw new TypeError($t("simulation.legacy-import.text_1393fcdf20"));
  }
  const conversation: LegacyConversation = {
    lastDay: warpDay(expiresAt - legacyRetention), expiresAt,
    pity: { character: pityFrom(data.role, 90, true), cone: pityFrom(weapon, 80, true), standard: pityFrom(data.permanent, 90, false) },
  };
  const today = record(data.today), week = record(data.week);
  const day = warpDay(now);
  if (integer(today?.expire, Math.floor(Number.MAX_SAFE_INTEGER / 1_000)) &&
      today.expire * 1_000 >= warpDayStart(day + 1) - 1_000 && today.expire * 1_000 <= warpDayStart(day + 1) &&
      integer(today.num) && integer(today.weaponNum) && Array.isArray(today.star)) {
    const stars = today.star.flatMap(entry => {
      const row = record(entry);
      return typeof row?.name === "string" && row.name.length <= 120 && integer(row.num, 90)
        ? [{ name: row.name, pity: row.num }] : [];
    });
    conversation.today = { day, standardAndCharacter: today.num, cone: today.weaponNum, five: stars.length, samples: stars.slice(0, 7) };
  }
  if (integer(week?.expire, Math.floor(Number.MAX_SAFE_INTEGER / 1_000)) && now < week.expire * 1_000 &&
      week.expire * 1_000 < now + 8 * warpDayMs && integer(week.num)) {
    conversation.week = { id: warpWeek(now), five: week.num };
  }
  return conversation;
}

export async function importLegacyWarps(options: ImportOptions, lockFile: AcquireRoleArchiveLock) {
  const { sourceUrl, authorizationFile, destinationDirectory, apply, now = Date.now, signal = new AbortController().signal } = options;
  const scope = await authorizedScope(authorizationFile);
  const protocol = URL.parse(sourceUrl)?.protocol;
  if (protocol !== "redis:" && protocol !== "rediss:") throw new TypeError($t("simulation.legacy-import.text_639534be71"));
  const target = createWarpArchive(destinationDirectory, lockFile);
  const source = new Bun.RedisClient(sourceUrl, { autoReconnect: false, enableOfflineQueue: false, connectionTimeout: 2000 });
  try {
    try { await source.connect(); }
    catch { throw new Error($t("simulation.legacy-import.text_101fbd0972")); }
    const totals = { accounts: scope.length, balances: 0, conversations: 0, existing: 0, missing: 0, expired: 0 };
    for (const { qq, balance, conversations } of scope) {
      signal.throwIfAborted();
      const current = readWarpAccount(await target.read(qq, "1"));
      const candidates = new Map<string, LegacyConversation>();
      let wallet: LegacyBalance | undefined;
      if (balance) {
        if (current.legacy?.balance || current.balance.day >= warpDay(now())) totals.existing++;
        else {
          const coin = await readKey(source, `${prefix}coin:${qq}`, now, warpDayMs);
          if (typeof coin === "string") totals[coin]++;
          else {
            const value = balanceFrom(coin, now());
            if (value) wallet = value;
            else totals.expired++;
          }
        }
      }
      for (const key of conversations) {
        if (current.conversations[key] || current.legacy?.conversations.includes(key)) totals.existing++;
        else {
          const entry = await readKey(source, `${prefix}gacha:${key}:${qq}`, now, legacyRetention);
          if (typeof entry === "string") totals[entry]++;
          else candidates.set(key, conversationFrom(entry, now()));
        }
      }
      if (!wallet && !candidates.size) continue;
      function merge(value: unknown) {
        const account = readWarpAccount(value);
        const at = now();
        const legacy = account.legacy ?? { conversations: [] };
        const result = { balances: 0, conversations: 0, existing: 0, expired: 0 };
        if (wallet) {
          if (wallet.day !== warpDay(at) || wallet.expiresAt <= at) result.expired++;
          else if (legacy.balance || account.balance.day >= wallet.day) result.existing++;
          else {
            account.balance = wallet;
            legacy.balance = true;
            result.balances++;
          }
        }
        for (const [key, candidate] of candidates) {
          if (candidate.expiresAt <= at) result.expired++;
          else if (account.conversations[key] || legacy.conversations.includes(key)) result.existing++;
          else {
            account.conversations[key] = candidate;
            legacy.conversations.push(key);
            result.conversations++;
          }
        }
        account.legacy = legacy;
        return result.balances || result.conversations ? { document: account, result } : { result };
      }
      const counts = apply ? await target.update({ qq, uid: "1" }, async () => signal.throwIfAborted(), merge) : merge(current).result;
      totals.balances += counts.balances;
      totals.conversations += counts.conversations;
      totals.existing += counts.existing;
      totals.expired += counts.expired;
    }
    return totals;
  } finally { source.close(); }
}
