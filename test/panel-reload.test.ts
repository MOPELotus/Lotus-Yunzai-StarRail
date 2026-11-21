import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { parsePanelCommand } from "../panel-model.ts";
import { createStarRailPanel } from "../panel.ts";

const uid = "100000122";

test("星铁旧重读和米游社更新写法走不同入口，保留 UID 和档案", () => {
  for (const name of ["#星铁加载面板", "#星铁重新加载面板", "*重载面板"]) {
    expect(parsePanelCommand(name)).toEqual({ type: "reload", name: "", profileId: 1 });
  }
  for (const name of ["#米游社星铁更新面板", "#mys星铁更新面板", "米游社 星铁 面板更新", "*米游社更新全部面板", "#星铁MYS获取游戏角色详情"]) {
    expect(parsePanelCommand(name)).toEqual({ type: "update", name: "", profileId: 1 });
  }
  expect(parsePanelCommand(`#星铁重载面板${uid} 档案 2`)).toEqual({ type: "reload", name: "", uid, profileId: 2 });
  expect(parsePanelCommand(`#mys星铁更新面板${uid} 档案 2`)).toEqual({ type: "update", name: "", uid, profileId: 2 });
  expect(parsePanelCommand("#星铁米游社面板更新 255")).toEqual({ type: "update", name: "", profileId: 255 });
  for (const name of ["#米游社原神更新面板", "#米游社更新面板", "#星铁备用更新面板", "#星铁删除面板", "#星铁更新面板256"]) {
    expect(parsePanelCommand(name)).toBeUndefined();
  }
});

test("本地缺档只提示显式更新，重载拒代执行和跨 UID，旧档失败不发请求", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-starrail-panel-reload-"));
  const previous = Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
  Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = directory;
  try {
    await writeFile(join(directory, "42-2.yaml"), `version: 1
user: { qq: "42" }
profile: { id: 2 }
account:
  game_roles: { sr: [{ uid: "${uid}", region: prod_gf_cn, game_biz: hkrpg_cn }] }
  current_uid: { sr: "${uid}" }
`);
    const profiles = createProfileStore(directory);
    let requests = 0, writes = 0;
    const client = createProfileHoyoClient(profiles, async () => { requests++; throw new Error("不应发请求"); });
    const panel = createStarRailPanel(profiles, client, async () => { writes++; throw new Error("不应写面板"); }, new AbortController().signal);
    expect(await panel("42", parsePanelCommand("#星铁重载面板2")!)).toContain("请先使用 *更新面板2");
    expect(await panel("42", parsePanelCommand("#星铁重载面板256")!)).toContain("1–255");
    expect(await panel("42", parsePanelCommand("#星铁重载面板2")!, { isDelegated: true })).toContain("本人");
    expect(await panel("42", parsePanelCommand("#星铁重载面板100000121 档案2")!)).toContain("绑定的星铁角色不一致");
    expect(await panel("42", parsePanelCommand("#米游社星铁更新面板2")!)).toContain("请先登录 profile 2");
    await writeFile(join(directory, `${uid}.json`), "损坏的 JSON");
    expect(await panel("42", parsePanelCommand("#星铁重新加载面板2")!)).toContain("暂时无法重新加载");
    expect([requests, writes]).toEqual([0, 0]);
  } finally {
    if (previous === undefined) delete Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
    else Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
