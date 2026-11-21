import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadOfficialArtwork, normalizeProfileRoleArtworkUrl } from "@lotus-yunzai/account";
import { loadImage, type Image } from "skia-canvas";
import characterNames from "./challenge-character-names.json";
import type { StarRailRecordItemResolver } from "./gacha-record-source.ts";

const defaultCache = fileURLToPath(new URL("../../data/starrail/challenge-portraits.sqlite", import.meta.url));
const maxCached = 256;
const maxOfficialBytes = 1024 * 1024;
const maxLocalBytes = 4 * maxOfficialBytes;
const maxImageSide = 4096;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const names: Readonly<Record<string, string>> = characterNames;
type Avatar = { readonly id: number | ""; readonly icon: string };

export interface ChallengePortraitOptions {
  readonly themeDirectory?: string;
  readonly challengeThemeDirectory?: string;
  readonly resolveItem?: StarRailRecordItemResolver;
  readonly cacheFile?: string;
  readonly transport?: NonNullable<Parameters<typeof loadOfficialArtwork>[1]>["transport"];
}

function cacheKey(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

async function openCache(file: string) {
  let db: Database | undefined;
  try {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    db = new Database(file, { create: true, strict: true });
    db.exec("PRAGMA busy_timeout=200; CREATE TABLE IF NOT EXISTS portraits (key TEXT PRIMARY KEY, bytes BLOB NOT NULL, saved INTEGER NOT NULL)");
    return db;
  } catch {
    db?.close();
  }
}

async function decode(bytes: Uint8Array | null | undefined, maxBytes: number) {
  if (!bytes?.length || bytes.length > maxBytes) return;
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const png = data.length > 24 && data.subarray(0, 8).equals(pngSignature);
  const jpeg = data[0] === 255 && data[1] === 216;
  const webp = data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  if ((!png && !jpeg && !webp) || (png && (data.readUInt32BE(16) > maxImageSide || data.readUInt32BE(20) > maxImageSide))) return;
  const image = await loadImage(data).catch(() => undefined);
  if (image && image.width > 0 && image.height > 0 && image.width <= maxImageSide && image.height <= maxImageSide) return image;
}

async function localArtwork(root: string, candidate: string, signal: AbortSignal) {
  signal.throwIfAborted();
  try {
    const file = await realpath(join(root, candidate));
    const path = relative(root, file);
    if (!path || path === ".." || path.startsWith(".." + sep) || isAbsolute(path)) return;
    const input = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await input.stat();
      if (!info.isFile() || info.size <= 0 || info.size > maxLocalBytes) return;
      // Read at most the validated size plus one byte if a concurrent writer grows the file.
      const bytes = Buffer.alloc(info.size + 1);
      const count = (await input.read({ buffer: bytes, position: 0 })).bytesRead;
      if (count === info.size) return await decode(bytes.subarray(0, count), maxLocalBytes);
    } finally {
      await input.close();
    }
  } catch {
    // Missing or invalid theme files are local misses.
  }
}

async function localPortrait(root: string, name: string, signal: AbortSignal) {
  if (!name || name === "." || name === ".." || /[/\\\p{Cc}]/u.test(name)) return;
  for (const filename of ["face.webp", "face-q.webp"]) {
    const image = await localArtwork(root, join("meta-sr", "character", name, "imgs", filename), signal);
    if (image) return image;
  }
}

function cached(db: Database | undefined, url: string) {
  try {
    return db?.query<{ bytes: Uint8Array }, [string]>("SELECT bytes FROM portraits WHERE key = ?").get(cacheKey(url))?.bytes;
  } catch {
    return undefined;
  }
}

function remember(db: Database | undefined, rows: readonly (readonly [string, Uint8Array])[]) {
  if (!db || !rows.length) return;
  try {
    const write = db.query("INSERT OR REPLACE INTO portraits (key, bytes, saved) VALUES (?, ?, ?)");
    db.transaction(() => {
      const now = Date.now();
      for (const [url, bytes] of rows) write.run(cacheKey(url), bytes, now);
      db.query("DELETE FROM portraits WHERE key IN (SELECT key FROM portraits ORDER BY saved DESC, rowid DESC LIMIT -1 OFFSET ?)").run(maxCached);
    })();
  } catch {
    // A cache failure cannot prevent independently obtained artwork from appearing.
  }
}

export async function loadStarRailChallengePortraits<T extends Avatar>(avatars: readonly T[], signal: AbortSignal,
  { themeDirectory, challengeThemeDirectory, resolveItem, cacheFile = defaultCache, transport }: ChallengePortraitOptions = {}) {
  const urls = avatars.map(({ icon }) => normalizeProfileRoleArtworkUrl(icon));
  const images = new Map<string, Image>();
  const requested = [...new Set(urls.filter((url): url is string => url !== undefined))];
  const db = requested.length && !signal.aborted ? await openCache(cacheFile) : undefined;
  try {
    for (let start = 0; start < requested.length; start += 12) {
      signal.throwIfAborted();
      const batch = requested.slice(start, start + 12);
      await Promise.all(batch.map(async url => {
        const image = await decode(cached(db, url), maxOfficialBytes);
        if (image) images.set(url, image);
      }));
      const fetched = await loadOfficialArtwork(batch.filter(url => !images.has(url)), { signal, transport });
      const rows: Array<readonly [string, Uint8Array]> = [];
      for (const [url, bytes] of fetched) {
        signal.throwIfAborted();
        const image = await decode(bytes, maxOfficialBytes);
        if (!image) continue;
        images.set(url, image);
        rows.push([url, bytes]);
      }
      signal.throwIfAborted();
      remember(db, rows);
    }
  } finally {
    db?.close();
  }

  const result = new Map<T, Image>();
  const unresolved = avatars.flatMap((avatar, index) => {
    const url = urls[index];
    const image = url && images.get(url);
    if (image) result.set(avatar, image);
    return image ? [] : [avatar];
  });
  const root = unresolved.length && themeDirectory ? await realpath(themeDirectory).catch(() => undefined) : undefined;
  const fallback = unresolved.length && challengeThemeDirectory ? await realpath(challengeThemeDirectory).catch(() => undefined) : undefined;
  if (!root && !fallback) return result;
  const local = new Map<string, Promise<Image | undefined>>();
  for (const avatar of unresolved) {
    signal.throwIfAborted();
    if (!Number.isSafeInteger(avatar.id) || Number(avatar.id) <= 0) continue;
    const id = String(avatar.id);
    const item = resolveItem?.(id);
    const name = item?.kind === "char" && item.id === id ? item.name : names[id];
    let image = local.get(id);
    if (!image) {
      image = (async () => {
        const configured = root && name ? await localPortrait(root, name, signal) : undefined;
        return configured ?? (fallback ? localArtwork(fallback, join("portraits", id + ".webp"), signal) : undefined);
      })();
      local.set(id, image);
    }
    const portrait = await image;
    if (portrait) result.set(avatar, portrait);
  }
  return result;
}
