import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const targetPath = "data/starrail/challenge-theme";
const installedCheckout = new URL("../../", import.meta.url);
const defaultTheme = fileURLToPath(new URL(targetPath + "/", installedCheckout));
const backdropRoots = ["plugins/Lotus-ReFactor/resources/starrail-abyss", "plugins/Lotus-Plugin/resources/starrail-abyss"];
const portraitsRoot = "plugins/miao-plugin/resources/meta-sr/character";
const maxPortraitBytes = 4 * 1024 * 1024;
const rawTemplateRoot = "https://raw.githubusercontent.com/MOPELotus/Lotus-ReFactor/eaf7675324dae64e51652bf9669ef93247d02b42/resources/starrail-abyss/";
const templateDownloadTimeoutMs = 12_000;

// Exact originals from Lotus-ReFactor eaf7675324dae64e51652bf9669ef93247d02b42.
const template = [
  ["floor12.png", "img/abyss/floor12.png", 53663, "294d635062bfff1d0cb6e5a30259b8119b8a33eec46e9b97dd5e9bb5446bca2f"],
  ["star.png", "img/abyss/star.png", 2586, "76b9e65b21309733d0e5720a819d0a3a924de4babf7abd3dea272457e9116e7f"],
  ["fonts/HYWenHei-55W.ttf", "font/HYWenHei-55W.ttf", 3243096, "29e982b71514c7000f9e726cf354c5dabc686a1ceae5961713d0b07e9528a60c"],
  ["fonts/tttgbnumber.ttf", "font/tttgbnumber.ttf", 20056, "2397a53ac610214da8a6823968c9573c99704b767759d9781707cdb4efde1005"],
] as const;
type TemplateAsset = typeof template[number];
type TemplateFetch = (url: string, init: RequestInit) => Promise<Response>;

export function starRailChallengeThemeDirectory() {
  return Bun.env.LOTUS_STAR_RAIL_CHALLENGE_THEME_DIR?.trim() || defaultTheme;
}

async function entry(path: string) {
  try { return await lstat(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

async function readLocal(path: string, maximum: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const expected = await entry(path);
  if (!expected?.isFile() || expected.nlink !== 1 || !expected.size || expected.size > maximum ||
      await realpath(path) !== path) return;
  const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const same = async () => {
      const actual = await handle.stat();
      return actual.size === expected.size && actual.dev === expected.dev && actual.ino === expected.ino &&
        actual.ctimeMs === expected.ctimeMs && actual.mtimeMs === expected.mtimeMs;
    };
    if (!await same()) return;
    const bytes = Buffer.alloc(expected.size);
    for (let start = 0; start < bytes.length;) {
      signal?.throwIfAborted();
      const { bytesRead } = await handle.read(bytes, start, bytes.length - start, start);
      if (!bytesRead) return;
      start += bytesRead;
    }
    if (await same() && await realpath(path) === path) return bytes;
  } finally {
    await handle.close();
  }
}

function matches(bytes: Buffer, [, , size, digest]: TemplateAsset) {
  return bytes.length === size && createHash("sha256").update(bytes).digest("hex") === digest;
}

async function readOriginal(asset: TemplateAsset, request: TemplateFetch, signal: AbortSignal) {
  const [name, , size] = asset;
  const response = await request(rawTemplateRoot + name, { redirect: "error", credentials: "omit", signal });
  if (response.status !== 200 || response.redirected || !response.body ||
      Number(response.headers.get("content-length")) > size) {
    await response.body?.cancel().catch(() => {});
    return;
  }
  const reader = response.body.getReader();
  const bytes = Buffer.alloc(size);
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > size) return;
      bytes.set(value, length);
      length += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (length === size && matches(bytes, asset)) return bytes;
}

async function downloadOriginal(asset: TemplateAsset, request: TemplateFetch, signal: AbortSignal) {
  try {
    return await readOriginal(asset, request, signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (!signal.aborted && (code === "ECONNRESET" || code === "EPIPE" || code === "ETIMEDOUT")) {
      return readOriginal(asset, request, signal).catch(() => undefined);
    }
  }
}

async function store(root: string, path: string, bytes: Buffer, signal?: AbortSignal) {
  for (const relative of ["data", "data/starrail", targetPath]) {
    const directory = join(root, relative);
    await mkdir(directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    if (!(await entry(directory))?.isDirectory() || await realpath(directory) !== directory) return false;
  }
  const parent = dirname(path);
  await mkdir(parent, { mode: 0o700, recursive: true });
  if (!(await entry(parent))?.isDirectory() || await realpath(parent) !== parent) return false;
  signal?.throwIfAborted();
  const stage = await mkdtemp(join(parent, ".challenge-theme-"));
  try {
    const temporary = join(stage, basename(path));
    await writeFile(temporary, bytes, { mode: 0o600, flag: "wx", signal });
    signal?.throwIfAborted();
    await link(temporary, path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function copyPortraits(donor: string, root: string, target: string, signal?: AbortSignal) {
  const original = join(donor, portraitsRoot);
  const index = await readLocal(join(original, "data.json"), 1024 * 1024, signal);
  if (!index) return 0;
  let data: Record<string, { readonly id?: unknown; readonly name?: unknown } | undefined>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(index));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return 0;
    data = parsed as typeof data;
  } catch { return 0; }

  let copied = 0;
  for (const [id, row] of Object.entries(data)) {
    signal?.throwIfAborted();
    const name = row?.name;
    if (!/^[1-9]\d{3,8}$/u.test(id) || String(row?.id) !== id || typeof name !== "string" ||
        !name || name === "." || name === ".." || /[\\/\p{Cc}\p{Cf}]/u.test(name)) continue;
    const targetFile = join(target, "portraits", id + ".webp");
    if (await entry(targetFile)) continue;
    for (const filename of ["face.webp", "face-q.webp"]) {
      const bytes = await readLocal(join(original, name, "imgs", filename), maxPortraitBytes, signal);
      if (!bytes || bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" ||
          bytes.readUInt32LE(4) + 8 !== bytes.length || bytes.toString("ascii", 8, 12) !== "WEBP") continue;
      if (await store(root, targetFile, bytes, signal)) copied++;
      break;
    }
  }
  return copied;
}

/** Restore the original assets from an installation copy, with an explicit first-install download option. */
export async function prepareStarRailChallengeTheme(checkout: URL, {
  source = checkout, override, signal, download,
}: {
  readonly source?: URL;
  readonly override?: string;
  readonly signal?: AbortSignal;
  readonly download?: boolean | TemplateFetch;
} = {}) {
  if (override?.trim()) return { templates: 0, portraits: 0, missing: [] as string[] };
  const [root, donor] = await Promise.all([realpath(fileURLToPath(checkout)), realpath(fileURLToPath(source))]);
  const target = join(root, targetPath);
  let templates = 0;
  const absent: TemplateAsset[] = [];
  for (const candidate of template) {
    const [asset, genshin, size] = candidate;
    const output = join(target, asset);
    if (!(await entry(output))) {
      const sources = [...backdropRoots.map(relative => join(donor, relative, asset)),
        join(donor, "plugins/genshin/resources", genshin)];
      for (const file of sources) {
        const bytes = await readLocal(file, size, signal);
        if (!bytes || !matches(bytes, candidate)) continue;
        if (await store(root, output, bytes, signal)) templates++;
        break;
      }
      if (!(await entry(output))) absent.push(candidate);
    }
  }
  if (download && absent.length) {
    const deadline = AbortSignal.timeout(templateDownloadTimeoutMs);
    const downloadSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const request = typeof download === "function" ? download : fetch;
    const originals = await Promise.all(absent.map(asset => downloadOriginal(asset, request, downloadSignal)));
    signal?.throwIfAborted();
    if (originals.every(bytes => bytes !== undefined)) {
      for (const [index, bytes] of originals.entries()) {
        if (await store(root, join(target, absent[index]![0]), bytes, signal)) templates++;
      }
    }
  }
  const missing: string[] = [];
  for (const [asset] of template) {
    const info = await entry(join(target, asset));
    if (!info?.isFile() || !info.size) missing.push(asset);
  }
  const portraits = await copyPortraits(donor, root, target, signal);
  return { templates, portraits, missing };
}
