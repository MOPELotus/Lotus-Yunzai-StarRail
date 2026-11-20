import { randomInt } from "node:crypto";
import { constants } from "node:fs";
import { open, readdir, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadImage } from "skia-canvas";
import characterNames from "./challenge-character-names.json";

const names: Readonly<Record<string, string>> = characterNames;
// The original role alias table identifies the older gallery name for this role.
const legacyGalleryNames = new Map([["1511", "虚照"]]);
const extensions = [".webp", ".png", ".jpg", ".jpeg"];
const maxBytes = 8 * 1024 * 1024;

async function portrait(file: string) {
  try {
    if (await realpath(dirname(file)) !== dirname(file)) return;
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await handle.stat();
      if (!info.isFile() || !info.size || info.size > maxBytes) return;
      return { file, image: await loadImage(await handle.readFile()) };
    } finally {
      await handle.close();
    }
  } catch {
    return;
  }
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
export async function readStarRailPanelPortrait(theme: string, id: string, themeName: string) {
  const root = await realpath(theme).catch(() => undefined);
  const configured = Bun.env.LOTUS_CHARACTER_GALLERY_DIR?.trim();
  const gallery = configured ? await realpath(configured).catch(() => undefined) : root;
  const name = Object.hasOwn(names, id) ? names[id] : undefined;
  if (gallery && name) {
    const base = join(gallery, configured ? "sr-character" : "profile/normal-character");
    const candidates = await galleryFiles(base, name);
    const legacy = legacyGalleryNames.get(id);
    if (legacy) candidates.push(...await galleryFiles(base, legacy));
    while (candidates.length) {
      const [file] = candidates.splice(randomInt(candidates.length), 1);
      const selected = await portrait(file!);
      if (selected) return selected;
    }
  }
  const originalName = name ?? themeName;
  if (root && originalName && originalName !== "." && originalName !== ".." && !/[\/\\\p{Cc}]/u.test(originalName)) {
    return portrait(join(root, "meta-sr", "character", originalName, "imgs", "splash.webp"));
  }
}
