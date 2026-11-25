import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { constants, type Stats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { convertStarRailUigfTimezone, exportStarRailUigf, validateStarRailUigfArchive, type StarRailUigfArchive,
  type StarRailUigfPool } from "./gacha-uigf.ts";

const pools = ["11", "12", "21", "22", "2", "1"] as const;
const maxArchiveBytes = 32 * 1024 * 1024;
const maxLegacyPoolBytes = 16 * 1024 * 1024;
const subject = $t("gacha-record-archive.text_3c76b74895");
const accountId = /^[1-9]\d{0,18}$/u;

interface Identity {
  readonly qq: string;
  readonly uid: string;
}

interface LegacyOptions {
  readonly legacyTimezone?: number;
}

export type StarRailGachaArchiveRead = {
  readonly status: "available";
  readonly source: "managed" | "legacy" | "backup" | "independent";
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
  if (typeof qq !== "string" || typeof uid !== "string" || !accountId.test(qq) || !accountId.test(uid)) {
    throw new TypeError($t("gacha-record-archive.text_76d6232bee"));
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

async function locateLegacy(directory: string, segments: readonly string[]): Promise<string | undefined> {
  const info = await readStat(directory);
  if (!info) return;
  if (!info.isDirectory()) corrupt($t("gacha-record-archive.text_fd6f9cc2c5"));
  const root = await realpath(directory);
  let path = root;
  for (const segment of segments) {
    path = join(path, segment);
    const info = await readStat(path);
    if (!info) return;
    if (!info.isDirectory() || await realpath(path) !== path) corrupt($t("gacha-record-archive.text_d995ef5a75"));
  }
  return path;
}

function changedLegacy(): never {
  throw new StarRailGachaArchiveError("io", $t("gacha-record-archive.text_686dfebda6"));
}

async function readLegacyPool(file: string, remaining: number) {
  const expected = await readStat(file);
  if (!expected) return;
  if (!expected.isFile()) corrupt($t("gacha-record-archive.text_83cbd00740"));
  if (expected.size > Math.min(remaining, maxLegacyPoolBytes)) corrupt($t("gacha-record-archive.text_7d46f9c8f4"));
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
      corrupt($t("gacha-record-archive.text_1724446b8d"));
    }
    if (!Array.isArray(parsed)) corrupt($t("gacha-record-archive.text_972b6223a3"));
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

async function readLegacy(directory: string, source: "legacy" | "backup" | "independent", segments: readonly string[], uid: string,
  { legacyTimezone }: LegacyOptions): Promise<StarRailGachaArchiveRead> {
  const path = await locateLegacy(directory, segments);
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
      if (!record(row) || !sameIdentifier(row.gacha_type, pool)) corrupt($t("gacha-record-archive.text_b3da348a16"));
      if (row.uid !== undefined && !sameIdentifier(row.uid, uid)) corrupt($t("gacha-record-archive.text_e9ea856932"));
      // These summaries can share a pool file with real game records.
      if (row.xhh_ph === 1 || row.xhh_src === "mini") {
        hasSummaryRows = true;
        continue;
      }
      if (source === "independent" && row.uid === undefined) corrupt($t("gacha-record-archive.text_c5f5bdea78"));
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
  if (legacyTimezone === undefined) corrupt($t("gacha-record-archive.text_fe29cd3b99"));
  const lang = languages.size === 1 ? languages.values().next().value : undefined;
  try {
    const archive = validateStarRailUigfArchive({ uid, timezone: legacyTimezone, lang, records }, uid);
    return { status: "available", source, archive };
  } catch (error) {
    corrupt(error instanceof TypeError ? error.message : $t("gacha-record-archive.text_a21cb9fe1b"));
  }
}

export async function prepareIndependentStarRailGachaImport(directory: string, uid: string, timezone: number) {
  if (typeof uid !== "string" || !accountId.test(uid)) throw new TypeError($t("gacha-record-archive.text_3e846de7c1"));
  const result = await readLegacy(directory, "independent", [uid], uid, { legacyTimezone: timezone });
  if (result.status !== "available") {
    corrupt(result.reason === "mirror"
      ? $t("gacha-record-archive.text_76b4fac4c0")
      : $t("gacha-record-archive.text_302c49110a"));
  }
  const { archive } = result;
  // UIGF v4 uses whole-hour offsets. UTC preserves draw instants for archives with fractional offsets.
  const normalized = Number.isInteger(archive.timezone) ? archive : convertStarRailUigfTimezone(archive, 0);
  const document = exportStarRailUigf(normalized, {
    uid, exportedAt: new Date(), app: { name: "Lotus-Yunzai", version: "independent-legacy-import" },
  });
  return { document, count: normalized.records.length };
}

function decodeManaged(value: unknown, identity: Identity): StarRailUigfArchive {
  if (!record(value) || value.version !== 1 || value.qq !== identity.qq || value.uid !== identity.uid) {
    corrupt($t("gacha-record-archive.text_56627ad386"));
  }
  try {
    return validateStarRailUigfArchive(value, identity.uid);
  } catch (error) {
    corrupt(error instanceof TypeError ? error.message : $t("gacha-record-archive.text_bed122677f"));
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
      const segments = [identity.qq, identity.uid];
      const live = await readLegacy(legacyDirectory, "legacy", segments, identity.uid, options);
      if (live.status === "available") return live;
      const backup = await readLegacy(legacyBackupDirectory, "backup", segments, identity.uid, options);
      return backup.status === "available" || backup.reason === "mirror" ? backup : live;
    } catch (error) {
      if (error instanceof StarRailGachaArchiveError) throw error;
      throw new StarRailGachaArchiveError("io", $t("gacha-record-archive.text_f46025d0da"));
    }
  }

  return {
    async read(identity: Identity, options: LegacyOptions): Promise<StarRailGachaArchiveRead> {
      checkIdentity(identity);
      let saved: unknown;
      try { saved = await managed.read(identity.qq, identity.uid); }
      catch { corrupt($t("gacha-record-archive.text_3315847567")); }
      if (saved !== null) return { status: "available", source: "managed", archive: decodeManaged(saved, identity) };
      return existingLegacy(identity, options);
    },
    async prepareLegacyHandback(identity: Identity, legacyTimezone: number) {
      checkIdentity(identity);
      const saved = await managed.read(identity.qq, identity.uid);
      if (saved === null) throw new Error($t("gacha-record-archive.text_ed7d2aec24"));
      const modern = convertStarRailUigfTimezone(decodeManaged(saved, identity), legacyTimezone);
      const local = await readLegacy(legacyDirectory, "legacy", [identity.qq, identity.uid], identity.uid, { legacyTimezone });
      if (local.status === "unavailable" && local.reason === "mirror") {
        throw new Error($t("gacha-record-archive.text_52ceb5e573"));
      }
      const legacy = local.status === "available" ? local.archive : undefined;
      if (legacy?.lang && modern.lang && legacy.lang !== modern.lang) {
        throw new Error($t("gacha-record-archive.text_cb538a8d41"));
      }

      const legacyRows = legacy?.records ?? [];
      const existing = new Map(legacyRows.map(row => [row.id, row]));
      for (const row of modern.records) {
        const previous = existing.get(row.id);
        if ((previous?.name && row.name && previous.name !== row.name) ||
            (previous?.item_type && row.item_type && previous.item_type !== row.item_type)) {
          throw new Error($t("gacha-record-archive.text_91d2483f78"));
        }
      }
      const merged = validateStarRailUigfArchive({
        ...modern, lang: legacy?.lang ?? modern.lang, records: [...legacyRows, ...modern.records],
      }, identity.uid);
      // The old importer requests metadata only when its first row lacks it.
      if (merged.records.some(({ name, item_type, rank_type }) =>
        !name || (item_type !== "角色" && item_type !== "光锥" && item_type !== "武器") || !rank_type)) {
        throw new Error($t("gacha-record-archive.text_2c8dff64e1"));
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
            throw new StarRailGachaArchiveError("conflict", error instanceof TypeError ? error.message : $t("gacha-record-archive.text_f1c0a168d8"));
          }
        }
        const result = summarize(archive, incoming, previous);
        if (snapshot !== null && JSON.stringify(previous) === JSON.stringify(archive)) return { result };
        return { document: { version: 1, qq: identity.qq, ...archive }, result };
      });
    },
  };
}
