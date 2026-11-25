import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { builtinResourceDirectory } from "../../../lib/builtin-resources.ts";
import { reportResourceProgress, type ResourceProgressCallback } from "../../../lib/resource-progress.ts";
import { createHash } from "node:crypto";
import { link, lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readMigrationSourceFile } from "../../../lib/migration-files.ts";
import { reincarnationOriginals } from "./reincarnation-assets.ts";

const assetRoot = "data/starrail/reincarnation-theme";
const originalFolder = "plugins/flower-plugin/GachaMOD/StarRail/resources";
const flowerFolder = "plugins/flower-plugin/resources";
const fontSource = ["Nwflower/flower-plugin", "32139ee8b48c9bbea85f2ce48dd36007811b35c2"] as const;
const imageSource = ["jiuyixian/StarRail", "7ce226b6c2374996249ca54ac2acac1a549bb860"] as const;
const installed = new URL("../../../", import.meta.url);
type Entry = (typeof reincarnationOriginals)[number];
type Download = (url: string, init: RequestInit) => Promise<Response>;

export function starRailReincarnationThemeDirectory() {
  return Bun.env.LOTUS_STAR_RAIL_WARP_THEME_DIR?.trim() || builtinResourceDirectory("games/starrail-reincarnation");
}

async function file(root: string, path: string, maximum: number, signal?: AbortSignal) {
  return (await readMigrationSourceFile(root, path, maximum, signal).catch(() => undefined))?.bytes;
}

async function publish(root: string, output: string, bytes: Uint8Array, signal?: AbortSignal) {
  let directory = root;
  for (const segment of relative(root, dirname(output)).split(sep)) {
    directory = join(directory, segment);
    await mkdir(directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    if (!(await lstat(directory)).isDirectory() || await realpath(directory) !== directory) throw new Error($t("simulation.reincarnation-theme.text_6189f7cd00"));
  }
  const temporary = await mkdtemp(join(directory, ".relife-asset-"));
  try {
    const staged = join(temporary, "asset");
    await writeFile(staged, bytes, { mode: 0o600, flag: "wx", signal });
    signal?.throwIfAborted();
    await link(staged, output);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function readOriginal(url: string, [, size, digest]: Entry, fetchAsset: Download, signal: AbortSignal) {
  try {
    const response = await fetchAsset(url, { signal, redirect: "error", credentials: "omit" });
    if (response.status !== 200 || !response.body || response.redirected || Number(response.headers.get("Content-Length")) > size) {
      await response.body?.cancel().catch(() => {});
      return;
    }
    const reader = response.body.getReader();
    const output = Buffer.alloc(size);
    let length = 0;
    try {
      while (true) {
        signal.throwIfAborted();
        const next = await reader.read();
        if (next.done) break;
        if (length + next.value.length > size) return;
        output.set(next.value, length);
        length += next.value.length;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    if (length === size && createHash("sha256").update(output).digest("hex") === digest) return output;
  } catch {
    return;
  }
}

async function downloadAsset(entry: Entry, request: Download, signal: AbortSignal) {
  const [name] = entry;
  const [repo, revision] = name.startsWith("font/") ? fontSource : imageSource;
  const path = name.split("/").map(encodeURIComponent).join("/");
  const primary = `https://raw.githubusercontent.com/${repo}/${revision}/resources/${path}`;
  const mirror = `https://cdn.jsdelivr.net/gh/${repo}@${revision}/resources/${path}`;
  for (const url of [primary, mirror, primary]) {
    if (signal.aborted) return;
    const bytes = await readOriginal(url, entry, request, signal);
    if (bytes) return bytes;
  }
}

export async function prepareStarRailReincarnationTheme(root: URL, {
  source = root, override, download, signal, onProgress,
}: { readonly source?: URL; readonly override?: string; readonly download?: boolean | Download; readonly signal?: AbortSignal; readonly onProgress?: ResourceProgressCallback } = {}) {
  const report = (message: string, completed?: number, total?: number) => reportResourceProgress(onProgress, signal, "relife-theme", message, completed, total);
  report($t("simulation.reincarnation-theme.text_1cceb6cfa9"));
  if (override?.trim()) return { installed: 0, missing: [] as string[] };
  const [target, legacy] = await Promise.all([realpath(fileURLToPath(root)), realpath(fileURLToPath(source))]);
  const pending: Entry[] = [];
  const missing: string[] = [];
  let installed = 0;
  for (const [position, entry] of reincarnationOriginals.entries()) {
    report($t("simulation.reincarnation-theme.text_a7fe699ca9", { "value1": entry[0] }), position, reincarnationOriginals.length);
    signal?.throwIfAborted();
    const [name, size, digest] = entry;
    const output = join(target, assetRoot, name);
    const existing = await lstat(output).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (existing) {
      const bytes = await file(target, output, size, signal);
      if (!bytes || bytes.length !== size || createHash("sha256").update(bytes).digest("hex") !== digest) missing.push(name);
      continue;
    }
    const directory = name.startsWith("font/") ? flowerFolder : originalFolder;
    const sources = new Set([
      join(builtinResourceDirectory("games/starrail-reincarnation", root), name),
      join(builtinResourceDirectory("games/starrail-reincarnation", source), name),
      join(legacy, assetRoot, name),
      join(legacy, directory, name),
    ]);
    let local: Uint8Array | undefined;
    for (const path of sources) {
      const owner = path.startsWith(target + sep) ? target : legacy;
      const candidate = await file(owner, path, size, signal);
      if (candidate?.length === size && createHash("sha256").update(candidate).digest("hex") === digest) {
        local = candidate;
        break;
      }
    }
    if (local) {
      if (await publish(target, output, local, signal)) installed++;
    } else pending.push(entry);
  }
  const end = AbortSignal.timeout(12_000);
  const downloadSignal = signal ? AbortSignal.any([end, signal]) : end;
  for (let offset = 0; offset < pending.length; offset += 6) {
    const batch = pending.slice(offset, offset + 6);
    report($t("simulation.reincarnation-theme.text_3ad1b4334b"), offset, pending.length);
    const bytes = download ? await Promise.all(batch.map(entry =>
      downloadAsset(entry, typeof download === "function" ? download : fetch, downloadSignal))) : [];
    for (const [index, [name]] of batch.entries()) {
      signal?.throwIfAborted();
      const data = bytes[index];
      if (!data) missing.push(name);
      else if (await publish(target, join(target, assetRoot, name), data, signal)) installed++;
      report($t("simulation.reincarnation-theme.text_86955f2188", { "name": name }), offset + index + 1, pending.length);
    }
  }
  return { installed, missing };
}
