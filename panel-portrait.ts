import { createHash, randomInt } from "node:crypto";
import { constants } from "node:fs";
import { open, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { loadImage } from "skia-canvas";
import { isSyncedPanelGallerySnapshot, localPanelGalleryRoot, readSyncedPanelGalleryRoot, retainedPanelGalleryDirectory } from "../../lib/panel-gallery-paths.ts";
import characterNames from "./challenge-character-names.json";

const names: Readonly<Record<string, string>> = characterNames;
// The original role alias table identifies the older gallery name for this role.
const legacyGalleryNames = new Map([["1511", "虚照"]]);
const extensions = [".webp", ".png", ".jpg", ".jpeg"];
const maxBytes = 8 * 1024 * 1024;

type PortraitRoot = "theme" | "gallery" | "retained" | "synced";
export type StarRailLocalPanelPhoto = { readonly root: PortraitRoot; readonly path: readonly string[];
  readonly sha256: string; readonly snapshot?: string };
type Location = { readonly root: PortraitRoot; readonly base: string; readonly snapshot?: string };

export const panelPhotoHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function safePart(part: unknown) {
  return typeof part === "string" && !!part && part !== "." && part !== ".." && Buffer.byteLength(part) <= 255 &&
    !/[\/\\\p{Cc}\p{Cf}]/u.test(part);
}

export function isStarRailLocalPanelPhoto(value: unknown): value is StarRailLocalPanelPhoto {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StarRailLocalPanelPhoto>;
  if (typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || !Array.isArray(item.path) ||
      !item.path.every(safePart) || !/\.(?:webp|png|jpe?g)$/iu.test(item.path.at(-1) ?? "")) return false;
  if (item.root === "synced") return isSyncedPanelGallerySnapshot(item.snapshot) && item.path.length <= 2;
  if (item.snapshot !== undefined) return false;
  if (item.root === "gallery" || item.root === "retained") return item.path.length <= 3;
  return item.root === "theme" && (item.path[0] === "profile" && item.path.length <= 4 ||
    item.path[0] === "meta-sr" && item.path[1] === "character" && item.path[3] === "imgs" && item.path.length === 5);
}

async function portraitBytes(file: string) {
  try {
    if (await realpath(dirname(file)) !== dirname(file)) return;
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await handle.stat();
      if (!info.isFile() || !info.size || info.size > maxBytes) return;
      const bytes = Buffer.alloc(info.size);
      for (let offset = 0; offset < bytes.length;) {
        const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!bytesRead) return;
        offset += bytesRead;
      }
      const latest = await handle.stat();
      if (latest.size === info.size && latest.ctimeMs === info.ctimeMs && latest.mtimeMs === info.mtimeMs) return bytes;
    } finally {
      await handle.close();
    }
  } catch {
    return;
  }
}

async function portrait(file: string, location: Location) {
  const bytes = await portraitBytes(file);
  const image = bytes && await loadImage(bytes).catch(() => undefined);
  if (!bytes || !image) return;
  const original = { root: location.root, path: relative(location.base, file).split(sep), sha256: panelPhotoHash(bytes),
    ...(location.snapshot && { snapshot: location.snapshot }) };
  return { file, image, bytes, original: isStarRailLocalPanelPhoto(original) ? original : undefined };
}

export async function readStarRailLocalPanelPhoto(theme: string, photo: StarRailLocalPanelPhoto, installation?: string) {
  if (!isStarRailLocalPanelPhoto(photo)) return;
  let directory: string | undefined;
  switch (photo.root) {
    case "theme": directory = await realpath(theme).catch(() => undefined); break;
    case "gallery": {
      const gallery = await realpath(Bun.env.LOTUS_CHARACTER_GALLERY_DIR?.trim() || localPanelGalleryRoot(installation)).catch(() => undefined);
      if (gallery) directory = join(gallery, "sr-character");
      break;
    }
    case "retained": directory = await retainedPanelGalleryDirectory("sr", installation); break;
    case "synced": {
      const synced = await readSyncedPanelGalleryRoot(installation, photo.snapshot);
      if (synced) directory = join(synced, "sr-character");
      break;
    }
  }
  if (!directory) return;
  const data = await portraitBytes(join(directory, ...photo.path));
  if (data && panelPhotoHash(data) === photo.sha256) return data;
}

async function galleryFiles(base: string, name: string) {
  const folder = join(base, name);
  const nested = await realpath(folder).catch(() => undefined) === folder
    ? await readdir(folder, { withFileTypes: true }).catch(() => []) : [];
  return [
    ...extensions.map(extension => join(base, name + extension)),
    ...nested.filter(file => file.isFile() && extensions.some(extension => file.name.toLowerCase().endsWith(extension)))
      .map(file => join(folder, file.name)),
  ];
}

/** Uses the exact roster ID for gallery art and preserves the theme's original illustration. */
export async function readStarRailPanelPortrait(theme: string, id: string, themeName: string, special = false, installation?: string) {
  const root = await realpath(theme).catch(() => undefined);
  const configured = Bun.env.LOTUS_CHARACTER_GALLERY_DIR?.trim();
  const gallery = await realpath(configured || localPanelGalleryRoot(installation)).catch(() => undefined);
  const name = Object.hasOwn(names, id) ? names[id] : undefined;
  if (name) {
    const bases: { readonly path: string; readonly location: Location }[] = [];
    const add = (location: Location, child?: string) => bases.push({ path: child ? join(location.base, child) : location.base, location });
    if (gallery) {
      const location: Location = { root: "gallery", base: join(gallery, "sr-character") };
      if (special) add(location, "super-character");
      add(location);
    }
    if (!configured) {
      if (root && special) add({ root: "theme", base: root }, "profile/super-character");
      const [synced, retained] = await Promise.all([
        readSyncedPanelGalleryRoot(installation), retainedPanelGalleryDirectory("sr", installation),
      ]);
      if (synced) add({ root: "synced", base: join(synced, "sr-character"), snapshot: basename(synced) });
      if (retained) add({ root: "retained", base: retained });
      if (root) add({ root: "theme", base: root }, "profile/normal-character");
    }
    for (const { path, location } of bases) {
      const candidates = await galleryFiles(path, name);
      const legacy = legacyGalleryNames.get(id);
      if (legacy) candidates.push(...await galleryFiles(path, legacy));
      while (candidates.length) {
        const [file] = candidates.splice(randomInt(candidates.length), 1);
        const selected = await portrait(file!, location);
        if (selected) return selected;
      }
    }
  }
  const originalName = name ?? themeName;
  if (root && originalName && originalName !== "." && originalName !== ".." && !/[\/\\\p{Cc}]/u.test(originalName)) {
    const original = join(root, "meta-sr", "character", originalName, "imgs");
    const location: Location = { root: "theme", base: root };
    if (special) {
      const selected = await portrait(join(original, "splash0.webp"), location);
      if (selected) return selected;
    }
    return portrait(join(original, "splash.webp"), location);
  }
}
