import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readStarRailLocalPanelPhoto, readStarRailPanelPortrait } from "../panel-portrait.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

test("star rail uses decodable same-form gallery art before the matching original portrait", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-panel-portrait-"));
  const previous = Bun.env.LOTUS_CHARACTER_GALLERY_DIR;
  const write = async (path: string, bytes = png) => {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
    return file;
  };
  try {
    const original = await write("meta-sr/character/希儿/imgs/splash.webp");
    const upgraded = await write("meta-sr/character/希儿Pro/imgs/splash.webp");
    const trailblazer = await write("meta-sr/character/星·记忆/imgs/splash.webp");
    await write("profile/normal-character/星.png");
    await write("profile/normal-character/穹·记忆.png");
    const filtered = await write("profile/normal-character/希儿/gallery.png");
    await write("profile/normal-character/希儿/broken.webp", Buffer.from("invalid"));
    const specialGallery = await write("profile/super-character/希儿/special.png");
    const specialFallback = await write("meta-sr/character/希儿Pro/imgs/splash0.webp");
    delete Bun.env.LOTUS_CHARACTER_GALLERY_DIR;
    expect((await readStarRailPanelPortrait(root, "1102", "希儿"))?.file).toBe(filtered);
    expect((await readStarRailPanelPortrait(root, "1102", "希儿", true))?.file).toBe(specialGallery);
    expect((await readStarRailPanelPortrait(root, "2102", "希儿", true))?.file).toBe(specialFallback);
    expect((await readStarRailPanelPortrait(root, "2102", "希儿"))?.file).toBe(upgraded);
    expect((await readStarRailPanelPortrait(root, "8008", "穹·记忆"))?.file).toBe(trailblazer);
    const retained = await write("backup/plugins/miao-plugin/resources/profile/normal-character/希儿/filter.png");
    expect((await readStarRailPanelPortrait(root, "1102", "希儿", false, root))?.file).toBe(retained);
    const base = "data/character-gallery-synced";
    const generation = "gallery-00000000-0000-4000-8000-000000000001";
    const synced = await write(`${base}/snapshots/${generation}/sr-character/希儿/gallery.png`);
    await write(`${base}/snapshots/${generation}/gs-character/希儿Pro.png`);
    await symlink(`snapshots/${generation}`, join(root, base, "current"));
    const selectedSnapshot = await readStarRailPanelPortrait(root, "1102", "希儿", false, root);
    expect(selectedSnapshot?.file).toBe(synced);
    expect(selectedSnapshot?.original).toMatchObject({ root: "synced", snapshot: generation, path: ["希儿", "gallery.png"] });
    const next = "gallery-00000000-0000-4000-8000-000000000002";
    await write(`${base}/snapshots/${next}/sr-character/希儿/gallery.png`, Buffer.concat([png, Buffer.from([0])]));
    await symlink(`snapshots/${next}`, join(root, base, "next"));
    await rename(join(root, base, "next"), join(root, base, "current"));
    expect(await readStarRailLocalPanelPhoto(root, selectedSnapshot!.original!, root)).toEqual(png);
    await rm(synced);
    expect(await readStarRailLocalPanelPhoto(root, selectedSnapshot!.original!, root)).toBeUndefined();
    const selected = await write("data/character-gallery/sr-character/希儿/local.png");
    expect((await readStarRailPanelPortrait(root, "1102", "希儿", false, root))?.file).toBe(selected);
    expect((await readStarRailPanelPortrait(root, "2102", "希儿", false, root))?.file).toBe(upgraded);

    Bun.env.LOTUS_CHARACTER_GALLERY_DIR = join(root, "configured");
    const configured = await write("configured/sr-character/希儿.png");
    const renamed = await write("configured/sr-character/虚照/gallery.png");
    await write("configured/gs-character/希儿.png");
    await write("configured/sr-character/希儿/broken.webp", Buffer.from("invalid"));
    await symlink(filtered, join(root, "configured/sr-character/希儿/escape.png"));
    expect((await readStarRailPanelPortrait(root, "1102", "希儿"))?.file).toBe(configured);
    expect((await readStarRailPanelPortrait(root, "1511", "星神★阿哈"))?.file).toBe(renamed);
    await rm(configured);
    expect((await readStarRailPanelPortrait(root, "1102", "希儿", false, root))?.file).toBe(original);
  } finally {
    if (previous === undefined) delete Bun.env.LOTUS_CHARACTER_GALLERY_DIR;
    else Bun.env.LOTUS_CHARACTER_GALLERY_DIR = previous;
    await rm(root, { recursive: true, force: true });
  }
});
