import { constants, type Stats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { convertStarRailUigfTimezone, exportStarRailUigf, validateStarRailUigfArchive, type StarRailUigfArchive,
  type StarRailUigfPool } from "./gacha-uigf.ts";

const pools = ["11", "12", "21", "22", "2", "1"] as const;
const maxArchiveBytes = 32 * 1024 * 1024;
const maxLegacyPoolBytes = 16 * 1024 * 1024;
const subject = "星铁逐抽档案";

interface Identity {
  readonly qq: string;
  readonly uid: string;
}

interface LegacyOptions {
  readonly legacyTimezone?: number;
}

export type StarRailGachaArchiveRead = {
  readonly status: "available";
  readonly source: "managed" | "legacy" | "backup";
  readonly archive: StarRailUigfArchive;
} | {
  readonly status: "unavailable";
  readonly reason: "missing" | "mirror";
};

export class StarRailGachaArchiveError extends Error {
  constructor(readonly code: "corrupt" | "conflict" | "io", message: string) {
    super(message);
  }
}

function corrupt(message: string): never {
  throw new StarRailGachaArchiveError("corrupt", message);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

function checkIdentity({ qq, uid }: Identity) {
  if (typeof qq !== "string" || typeof uid !== "string" || !/^[1-9]\d{0,18}$/u.test(qq) || !/^[1-9]\d{0,18}$/u.test(uid)) {
    throw new TypeError("星铁逐抽档案的 QQ 或 UID 无效。");
  }
}

function sameIdentifier(value: unknown, expected: string) {
  return value === expected || (typeof value === "number" && Number.isSafeInteger(value) && String(value) === expected);
}

function sameFile(a: Stats, b: Stats | undefined): boolean {
  return b !== undefined && a.dev === b.dev && a.ino === b.ino && a.size === b.size &&
    a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

async function readStat(path: string): Promise<Stats | undefined> {
  return lstat(path).catch((error: unknown) => {
    if (!missing(error)) throw error;
    return undefined;
  });
}

async function locateLegacy(directory: string, { qq, uid }: Identity): Promise<string | undefined> {
  const info = await readStat(directory);
  if (!info) return;
  if (!info.isDirectory()) corrupt("星铁旧逐抽档案的根须为实际目录。");
  const root = await realpath(directory);
  let path = root;
  for (const segment of [qq, uid]) {
    path = join(path, segment);
    const info = await readStat(path);
    if (!info) return;
    if (!info.isDirectory() || await realpath(path) !== path) corrupt("星铁旧逐抽档案的 QQ 和 UID 须为实际目录。");
  }
  return path;
}

function changedLegacy(): never {
  throw new StarRailGachaArchiveError("io", "星铁旧逐抽档案正在变化，请稍后重试。");
}

async function readLegacyPool(file: string, remaining: number) {
  const expected = await readStat(file);
  if (!expected) return;
  if (!expected.isFile()) corrupt("星铁旧逐抽档案的卡池须为普通 JSON 文件。");
  if (expected.size > Math.min(remaining, maxLegacyPoolBytes)) corrupt("星铁旧逐抽档案超过可读取大小。");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || !sameFile(expected, info)) changedLegacy();
    const bytes = Buffer.alloc(info.size);
    for (let offset = 0; offset < bytes.length;) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) changedLegacy();
      offset += bytesRead;
    }
    if (!sameFile(info, await handle.stat())) changedLegacy();
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      corrupt("星铁旧逐抽档案的卡池 JSON 无效。");
    }
    if (!Array.isArray(parsed)) corrupt("星铁旧逐抽档案的卡池须为逐抽数组。");
    return { info, records: parsed as unknown[] };
  } finally {
    await handle.close();
  }
}

function mirrorDatum(row: Record<string, unknown>) {
  return typeof row.id === "string" && /^lotus-/iu.test(row.id) ||
    row.name === "占位记录" || row.time === "1970-01-01 00:00:00";
}

function mirrorFiveStar(row: Record<string, unknown>) {
  return row.gacha_id === undefined && row.item_id === undefined && sameIdentifier(row.rank_type, "5") &&
    (row.item_type === "角色" || row.item_type === "光锥") && typeof row.name === "string";
}

async function readLegacy(directory: string, source: "legacy" | "backup", identity: Identity,
  { legacyTimezone }: LegacyOptions): Promise<StarRailGachaArchiveRead> {
  const path = await locateLegacy(directory, identity);
  if (!path) return { status: "unavailable", reason: "missing" };
  const records: Record<string, unknown>[] = [];
  const fingerprints = new Map<string, Stats | undefined>();
  const languages = new Set<string>();
  let hasSummaryRows = false;
  let availableBytes = maxArchiveBytes;
  for (const pool of pools) {
    const file = join(path, `${pool}.json`);
    const snapshot = await readLegacyPool(file, availableBytes);
    fingerprints.set(file, snapshot?.info);
    if (!snapshot) continue;
    availableBytes -= snapshot.info.size;
    for (const row of snapshot.records) {
      if (!record(row) || !sameIdentifier(row.gacha_type, pool)) corrupt("星铁旧逐抽档案的卡池编号与文件不一致。");
      if (row.uid !== undefined && !sameIdentifier(row.uid, identity.uid)) corrupt("星铁旧逐抽档案包含其他 UID 的记录。");
      // These summaries can share a pool file with real game records.
      if (row.xhh_ph === 1 || row.xhh_src === "mini") {
        hasSummaryRows = true;
        continue;
      }
      if (typeof row.lang === "string" && row.lang.trim()) languages.add(row.lang.trim());
      records.push(row);
    }
  }
  if (await realpath(path) !== path) changedLegacy();
  for (const [file, original] of fingerprints) {
    const current = await readStat(file);
    if (original ? !sameFile(original, current) : current !== undefined) changedLegacy();
  }
  if (!records.length) return { status: "unavailable", reason: hasSummaryRows ? "mirror" : "missing" };
  if (records.some(mirrorDatum) || records.every(mirrorFiveStar)) return { status: "unavailable", reason: "mirror" };
  if (legacyTimezone === undefined) corrupt("无法确认星铁旧逐抽档案的服务器时区，请使用带时区的 UIGF 文件。");
  const lang = languages.size === 1 ? languages.values().next().value : undefined;
  try {
    const archive = validateStarRailUigfArchive({ uid: identity.uid, timezone: legacyTimezone, lang, records }, identity.uid);
    return { status: "available", source, archive };
  } catch (error) {
    corrupt(error instanceof TypeError ? error.message : "星铁旧逐抽档案的格式无效。");
  }
}

function decodeManaged(value: unknown, identity: Identity): StarRailUigfArchive {
  if (!record(value) || value.version !== 1 || value.qq !== identity.qq || value.uid !== identity.uid) {
    corrupt("星铁逐抽档案的版本或 QQ、UID 不匹配。");
  }
  try {
    return validateStarRailUigfArchive(value, identity.uid);
  } catch (error) {
    corrupt(error instanceof TypeError ? error.message : "星铁逐抽档案的格式无效。");
  }
}

function summarize(archive: StarRailUigfArchive, incoming: StarRailUigfArchive, previous?: StarRailUigfArchive) {
  const existing = new Set(previous?.records.map(({ id }) => id));
  const counts = new Map<StarRailUigfPool, { pool: StarRailUigfPool; received: number; added: number; total: number }>();
  for (const pool of pools) counts.set(pool, { pool, received: 0, added: 0, total: 0 });
  for (const { gacha_type, id } of incoming.records) {
    const count = counts.get(gacha_type)!;
    count.received++;
    if (!existing.has(id)) count.added++;
  }
  for (const { gacha_type } of archive.records) counts.get(gacha_type)!.total++;
  return { archive, received: incoming.records.length, added: archive.records.length - existing.size,
    total: archive.records.length, pools: [...counts.values()] };
}

export function createStarRailGachaRecordArchive({ directory, legacyDirectory, legacyBackupDirectory = `${resolve(legacyDirectory)}.backup` }: {
  readonly directory: string;
  readonly legacyDirectory: string;
  readonly legacyBackupDirectory?: string;
}, acquireLock: AcquireRoleArchiveLock) {
  const managed = createRoleJsonArchive(directory, acquireLock, {
    subject, lockSuffix: "lotus-gacha-rows", maxBytes: maxArchiveBytes, rejectNull: true,
  });

  async function existingLegacy(identity: Identity, options: LegacyOptions): Promise<StarRailGachaArchiveRead> {
    try {
      const live = await readLegacy(legacyDirectory, "legacy", identity, options);
      if (live.status === "available") return live;
      const backup = await readLegacy(legacyBackupDirectory, "backup", identity, options);
      return backup.status === "available" || backup.reason === "mirror" ? backup : live;
    } catch (error) {
      if (error instanceof StarRailGachaArchiveError) throw error;
      throw new StarRailGachaArchiveError("io", "无法读取星铁旧逐抽档案。");
    }
  }

  return {
    async read(identity: Identity, options: LegacyOptions): Promise<StarRailGachaArchiveRead> {
      checkIdentity(identity);
      let saved: unknown;
      try { saved = await managed.read(identity.qq, identity.uid); }
      catch { corrupt("无法读取星铁逐抽档案，请核对 JSON 文件、大小和目录。"); }
      if (saved !== null) return { status: "available", source: "managed", archive: decodeManaged(saved, identity) };
      return existingLegacy(identity, options);
    },
    async prepareLegacyHandback(identity: Identity, legacyTimezone: number) {
      checkIdentity(identity);
      const saved = await managed.read(identity.qq, identity.uid);
      if (saved === null) throw new Error("没有找到指定 QQ 和 UID 的新版星铁逐抽档案副本。");
      const modern = convertStarRailUigfTimezone(decodeManaged(saved, identity), legacyTimezone);
      const local = await readLegacy(legacyDirectory, "legacy", identity, { legacyTimezone });
      if (local.status === "unavailable" && local.reason === "mirror") {
        throw new Error("旧逐抽副本含显示占位记录，无法安全交还。");
      }
      const legacy = local.status === "available" ? local.archive : undefined;
      if (legacy?.lang && modern.lang && legacy.lang !== modern.lang) {
        throw new Error("新旧星铁逐抽档案的语言不同，无法安全交还到同一旧档。");
      }

      const legacyRows = legacy?.records ?? [];
      const existing = new Map(legacyRows.map(row => [row.id, row]));
      for (const row of modern.records) {
        const previous = existing.get(row.id);
        if ((previous?.name && row.name && previous.name !== row.name) ||
            (previous?.item_type && row.item_type && previous.item_type !== row.item_type)) {
          throw new Error("星铁抽卡文件存在编号相同但名称或物品种类不同的记录。");
        }
      }
      const merged = validateStarRailUigfArchive({
        ...modern, lang: legacy?.lang ?? modern.lang, records: [...legacyRows, ...modern.records],
      }, identity.uid);
      // The old importer requests metadata only when its first row lacks it.
      if (merged.records.some(({ name, item_type, rank_type }) =>
        !name || (item_type !== "角色" && item_type !== "光锥" && item_type !== "武器") || !rank_type)) {
        throw new Error("旧导入需要每条记录的名称、物品种类和星级，无法安全交还缺少旧显示字段的记录。");
      }

      const version = merged.lang && !merged.records.some(({ gacha_type }) => gacha_type === "21" || gacha_type === "22") ? "v2" : "v4";
      const latestDraw = merged.records.reduce((latest, { time }) => time > latest ? time : latest, "");
      // Anchor the export metadata to a record instant so identical input produces identical bytes.
      const exportedAt = new Date(Date.parse(latestDraw.replace(" ", "T") + "Z") - Math.round(legacyTimezone * 60) * 60_000);
      const document = exportStarRailUigf(merged, {
        uid: identity.uid, version, exportedAt, app: { name: "Lotus-Yunzai", version: "legacy-handoff" },
      });
      return {
        document, format: version === "v2" ? "SRGF v1.0" : "UIGF v4.1",
        counts: { modern: modern.records.length, legacy: legacyRows.length, total: merged.records.length },
      };
    },
    async merge(identity: Identity, input: StarRailUigfArchive, verifyProfile: () => Promise<void>, options: LegacyOptions) {
      checkIdentity(identity);
      const incoming = validateStarRailUigfArchive(input, identity.uid);
      return managed.update(identity, verifyProfile, async (snapshot) => {
        const legacy = snapshot === null ? await existingLegacy(identity, options) : undefined;
        const previous = legacy ? legacy.status === "available" ? legacy.archive : undefined : decodeManaged(snapshot, identity);
        const normalized = previous && previous.timezone !== incoming.timezone
          ? convertStarRailUigfTimezone(incoming, previous.timezone) : incoming;
        let archive = normalized;
        if (previous) {
          try {
            archive = validateStarRailUigfArchive({ ...previous, lang: previous.lang ?? normalized.lang,
              records: [...previous.records, ...normalized.records] }, identity.uid);
          } catch (error) {
            throw new StarRailGachaArchiveError("conflict", error instanceof TypeError ? error.message : "星铁逐抽档案合并冲突。");
          }
        }
        const result = summarize(archive, incoming, previous);
        if (snapshot !== null && JSON.stringify(previous) === JSON.stringify(archive)) return { result };
        return { document: { version: 1, qq: identity.qq, ...archive }, result };
      });
    },
  };
}
