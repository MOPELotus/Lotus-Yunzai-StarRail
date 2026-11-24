import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { builtinResourceDirectory } from "../../../lib/builtin-resources.ts";
import { prepareStarRailChallengeTheme } from "../challenge-theme.ts";
import { prepareStarRailReincarnationTheme } from "../simulation/reincarnation-theme.ts";
import { reincarnationOriginals } from "../simulation/reincarnation-assets.ts";

async function coldRoot() {
  const directory = await mkdtemp(join(tmpdir(), "lotus-starrail-builtin-prepare-"));
  return { directory, root: pathToFileURL(directory + sep) };
}

test("冷安装只有内置资源时，4个挑战模板及Miao公共头像完全离线准备", async () => {
  const { directory, root } = await coldRoot();
  try {
    const themes = builtinResourceDirectory("templates/starrail-challenge", root);
    await cp(builtinResourceDirectory("templates/starrail-challenge"), themes, { recursive: true });
    const miao = builtinResourceDirectory("games/miao/meta-sr/character");
    const index = JSON.parse(await readFile(join(miao, "data.json"), "utf8"));
    const [id, row] = Object.entries(index).find(([id, row]) => String((row as { id: number }).id) === id) as [string, { id: number; name: string }];
    const portraits = builtinResourceDirectory("games/miao/meta-sr/character", root);
    await mkdir(join(portraits, row.name, "imgs"), { recursive: true });
    await writeFile(join(portraits, "data.json"), JSON.stringify({ [id]: row }));
    await cp(join(miao, row.name, "imgs/face.webp"), join(portraits, row.name, "imgs/face.webp"));
    expect(await Bun.file(join(directory, "data/starrail/challenge-theme/floor12.png")).exists()).toBe(false);
    let downloads = 0;
    const download = async (): Promise<Response> => { downloads++; throw Error("冷安装内置模板不得联网"); };
    expect(await prepareStarRailChallengeTheme(root, { download })).toEqual({ templates: 4, portraits: 1, missing: [] });
    expect(downloads).toBe(0);
    for (const asset of ["floor12.png", "star.png", "fonts/HYWenHei-55W.ttf", "fonts/tttgbnumber.ttf"])
      expect(await readFile(join(directory, "data/starrail/challenge-theme", asset))).toEqual(await readFile(join(themes, asset)));
    expect(await readFile(join(directory, "data/starrail/challenge-theme/portraits", id + ".webp"))).toEqual(await readFile(join(miao, row.name, "imgs/face.webp")));
    expect(await prepareStarRailChallengeTheme(root, { download })).toEqual({ templates: 0, portraits: 0, missing: [] });
    expect(downloads).toBe(0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("冷安装只有33个内置转生文件时全部本地校验准备，不调用下载入口", async () => {
  const { directory, root } = await coldRoot();
  try {
    await cp(builtinResourceDirectory("games/starrail-reincarnation"), builtinResourceDirectory("games/starrail-reincarnation", root), { recursive: true });
    let downloads = 0;
    const download = async (): Promise<Response> => { downloads++; throw Error("冷安装内置转生模板不得联网"); };
    expect(await prepareStarRailReincarnationTheme(root, { download })).toEqual({ installed: 33, missing: [] });
    expect(downloads).toBe(0);
    for (const [path, size, sha256] of reincarnationOriginals) {
      const bytes = await readFile(join(directory, "data/starrail/reincarnation-theme", path));
      expect(bytes.length).toBe(size);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
    }
    expect(await prepareStarRailReincarnationTheme(root, { download })).toEqual({ installed: 0, missing: [] });
    expect(downloads).toBe(0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
