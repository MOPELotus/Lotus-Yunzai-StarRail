import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readShowcaseServer } from "../panel-showcase-config.ts";
import { showcaseTarget } from "../panel-showcase.ts";

test("环境变量优先于宿主 YAML，之后仅只读旧配置的已知常量", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-starrail-showcase-config-"));
  const root = pathToFileURL(directory + "/");
  const legacy = join(directory, "plugins/miao-plugin/config/cfg.js");
  const config = join(directory, "config/global.yaml");
  try {
    expect(await readShowcaseServer(root, "")).toBe("0");
    await mkdir(join(directory, "plugins/miao-plugin/config"), { recursive: true });
    await writeFile(legacy, "/*\nexport const srProfileServer = '2'\n*/\nthrow new Error('必须只按文本读取')\nexport const srProfileServer = '444'\n");
    const inherited = await readShowcaseServer(root, "");
    expect(inherited).toBe("444");
    expect(showcaseTarget({ uid: "500000123", region: "prod_qd_cn", gameBiz: "hkrpg_cn" }, inherited).provider).toBe("enka");
    await mkdir(join(directory, "config"));
    await writeFile(config, "starrail: {showcase_server: 234}\n");
    expect(await readShowcaseServer(root, "")).toBe("234");
    expect(await readShowcaseServer(root, " 2 ")).toBe("2");
    await writeFile(config, "starrail: {showcase_server: '024'}\n");
    expect(await readShowcaseServer(root, "")).toBe("024");
    await writeFile(config, "starrail: {showcase_server: false}\n");
    await expect(readShowcaseServer(root, "")).rejects.toThrow("配置无效");
    expect(await readShowcaseServer(root, "3")).toBe("3");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("动态、重复或经软链接的旧设置不触发隐式公开网络回退", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-starrail-showcase-legacy-"));
  const root = pathToFileURL(directory + "/");
  const parent = join(directory, "plugins/miao-plugin/config");
  const legacy = join(parent, "cfg.js");
  try {
    await mkdir(parent, { recursive: true });
    await writeFile(legacy, "export const srProfileServer = compute()\n");
    await expect(readShowcaseServer(root, "")).rejects.toThrow("配置无效");
    await writeFile(legacy, "export const srProfileServer = '4'\nexport const srProfileServer = '2'\n");
    await expect(readShowcaseServer(root, "")).rejects.toThrow("配置无效");
    await rm(legacy);
    const alternate = join(directory, "other.js");
    await writeFile(alternate, "export const srProfileServer = '4'\n");
    await symlink(alternate, legacy);
    await expect(readShowcaseServer(root, "")).rejects.toThrow("配置无效");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
