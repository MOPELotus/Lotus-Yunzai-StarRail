import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { loadStarRailChallengePortraits } from "../challenge-portraits.ts";
import { prepareStarRailChallengeTheme } from "../challenge-theme.ts";

const webp = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");

async function put(path: string, value: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}

test("挑战资源从固定旧目录导入现行默认路径，画像按同角色 ID 离线展示", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-star-rail-challenge-theme-"));
  try {
    const old = join(directory, "old");
    const newRoot = join(directory, "new");
    await mkdir(newRoot);
    const original = join(old, "plugins/miao-plugin/resources/meta-sr/character");
    const theme = join(newRoot, "data/starrail/challenge-theme");
    await put(join(original, "data.json"), JSON.stringify({
      1224: { id: 1224, name: "三月七·巡猎" },
      1001: { id: 1001, name: "三月七" },
      1234: { id: 1235, name: "三月七·巡猎" },
      1235: { id: 1235, name: "../../../../outside" },
    }));
    await put(join(original, "三月七·巡猎/imgs/face-q.webp"), webp);
    const outside = join(directory, "outside.webp");
    await put(outside, webp);
    const invalid = join(original, "三月七/imgs/face.webp");
    await mkdir(dirname(invalid), { recursive: true });
    await symlink(outside, invalid);
    await put(join(old, "plugins/Lotus-Plugin/resources/starrail-abyss/floor12.png"), webp);
    await put(join(theme, "star.png"), "existing operator theme");
    const source = pathToFileURL(old + sep);
    const target = pathToFileURL(newRoot + sep);
    const result = await prepareStarRailChallengeTheme(target, { source });
    expect(result.templates).toBe(0);
    expect(result.missing).toContain("floor12.png");
    expect(result.portraits).toBe(1);
    expect(await readFile(join(theme, "star.png"), "utf8")).toBe("existing operator theme");
    expect(await readFile(join(theme, "portraits/1224.webp"))).toEqual(webp);
    expect(await Bun.file(join(theme, "portraits/1001.webp")).exists()).toBe(false);
    expect((await prepareStarRailChallengeTheme(target, { source })).portraits).toBe(0);

    const hunt = { id: 1224, icon: "" };
    const preservation = { id: 1001, icon: "" };
    const offline = await loadStarRailChallengePortraits([hunt, preservation], new AbortController().signal, {
      challengeThemeDirectory: theme,
      transport: async () => { throw new Error("离线画像不应发出请求"); },
    });
    expect(offline.get(hunt)).toMatchObject({ width: 1, height: 1 });
    expect(offline.has(preservation)).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("显式选择的挑战主题保留运营者路径", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-star-rail-custom-challenge-theme-"));
  try {
    const result = await prepareStarRailChallengeTheme(pathToFileURL(directory + sep), { override: "/offline/custom" });
    expect(result).toEqual({ templates: 0, portraits: 0, missing: [] });
    expect(await Bun.file(join(directory, "data/starrail/challenge-theme/floor12.png")).exists()).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("首装只取固定原源，拒绝重定向、过大、短读和摘要不符的资源", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-star-rail-download-challenge-theme-"));
  const assets = ["floor12.png", "star.png", "fonts/HYWenHei-55W.ttf", "fonts/tttgbnumber.ttf"];
  const expected = "https://raw.githubusercontent.com/MOPELotus/Lotus-ReFactor/eaf7675324dae64e51652bf9669ef93247d02b42/resources/starrail-abyss/";
  const requested: string[] = [];
  let interrupted = false;
  const target = pathToFileURL(directory + sep);
  const theme = join(directory, "data/starrail/challenge-theme");
  try {
    expect((await prepareStarRailChallengeTheme(target)).missing).toEqual(assets);
    const result = await prepareStarRailChallengeTheme(target, { download: async (url, init) => {
      requested.push(url);
      expect(init).toMatchObject({ redirect: "error", credentials: "omit" });
      expect(init.signal).toBeInstanceOf(AbortSignal);
      if (url.endsWith("fonts/tttgbnumber.ttf") && !interrupted) {
        interrupted = true;
        throw Object.assign(new Error("connection reset"), { code: "ECONNRESET" });
      }
      if (url.endsWith("floor12.png")) return Response.redirect("https://invalid.example/alternate");
      if (url.endsWith("star.png")) return new Response(new Uint8Array(2587));
      if (url.endsWith("HYWenHei-55W.ttf")) return new Response(new Uint8Array(1));
      return new Response(new Uint8Array(20056));
    } });
    expect(requested).toEqual([...assets, "fonts/tttgbnumber.ttf"].map(asset => expected + asset));
    expect(result).toEqual({ templates: 0, portraits: 0, missing: assets });
    for (const asset of assets) expect(await Bun.file(join(theme, asset)).exists()).toBe(false);
    for (const asset of assets) await put(join(theme, asset), "local operator asset");
    requested.length = 0;
    expect(await prepareStarRailChallengeTheme(target, { download: async (url) => {
      requested.push(url);
      return new Response();
    } })).toEqual({ templates: 0, portraits: 0, missing: [] });
    expect(requested).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
