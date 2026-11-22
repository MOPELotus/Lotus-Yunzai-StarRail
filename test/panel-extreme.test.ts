import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { createModule } from "../index.ts";
import { parsePanelCommand } from "../panel-model.ts";
import { createStarRailPanel } from "../panel.ts";

test("匹配星铁极限面板的普通入口和角色名", async () => {
  expect(parsePanelCommand("#原神极限希儿")).toBeUndefined();
  expect(parsePanelCommand("*极限")).toBeUndefined();
  const { fallbackFeatures } = createModule({
    signal: AbortSignal.timeout(1000),
    lockFile: async () => { throw new Error("功能匹配不得写入"); },
  });
  for (const command of ["*极限希儿", "#星铁极限 希儿面板", "#星铁群内排行极限希儿", "#星铁极限希儿详情", "*极限希儿详情"]) {
    expect(parsePanelCommand(command)).toMatchObject({ type: "extreme", name: "希儿" });
    expect(await fallbackFeatures({ normalizedMessage: command, reply: async () => {} })).toEqual(["[starrail] 角色面板"]);
  }
});

test("星铁极限面板从本地固定样例读取并沿用角色别名", async () => {
  const temp = await mkdtemp(join(tmpdir(), "lotus-starrail-extreme-"));
  const previous = Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
  Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = temp;
  try {
    const profiles = createProfileStore(temp);
    let requests = 0;
    const client = createProfileHoyoClient(profiles, async () => {
      requests++;
      throw new Error("示例查看不得访问面板服务");
    });
    const bundled = join(temp, "bundled.json");
    const panel = createStarRailPanel(profiles, client, async () => {
      throw new Error("示例查看不得写入");
    }, new AbortController().signal, undefined, undefined, bundled);
    const command = parsePanelCommand("*极限希儿")!;
    expect(await panel("42", command)).toBe("当前没有安装星铁极限面板样例档。");
    const archive = join(temp, "100000000.json");
    const bytes = JSON.stringify({ uid: "100000000", avatars: {
      "1102": { id: 1102, level: 80, cons: 6, _source: "homo", talent: { a: 6 }, artis: {}, trees: [] },
    } });
    await writeFile(archive, bytes);
    expect(await panel("42", parsePanelCommand("*极限银枝")!)).toBe("星铁极限面板样例档没有这个角色。");
    expect(await panel("42", parsePanelCommand("#星铁极限蝴蝶详情")!, { message_type: "group", inlineImageByteLimit: 1 }))
      .toContain("星铁极限面板 · 希儿");
    const bundledBytes = JSON.stringify({ uid: 100000000, avatars: {
      "1302": { id: 1302, level: 80, cons: 6, _source: "homo", talent: { a: 6 }, artis: {}, trees: [] },
    } });
    await writeFile(bundled, bundledBytes);
    expect(await panel("42", parsePanelCommand("*极限纯美骑士")!, { message_type: "group", inlineImageByteLimit: 1 }))
      .toContain("星铁极限面板 · 银枝");
    expect(await panel("42", command, { message_type: "private" })).toMatchObject({ type: "image" });
    expect(requests).toBe(0);
    expect((await readdir(temp)).sort()).toEqual(["100000000.json", "bundled.json"]);
    expect(await readFile(archive, "utf8")).toBe(bytes);
    expect(await readFile(bundled, "utf8")).toBe(bundledBytes);
  } finally {
    if (previous === undefined) delete Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
    else Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = previous;
    await rm(temp, { recursive: true, force: true });
  }
}, 20_000);
