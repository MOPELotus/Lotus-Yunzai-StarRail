import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { lockFile } from "../../../lib/file-lock.ts";
import { normalizePanel, parsePanelCommand } from "../panel-model.ts";
import { createStarRailPanel, createStarRailPersonalPanelReader } from "../panel.ts";

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
  for (const name of ["#米游社原神更新面板", "#米游社更新面板", "#星铁更新面板256"]) {
    expect(parsePanelCommand(name)).toBeUndefined();
  }
});

test("本人确认后删除星铁面板，禁止越权、旧档回填和在途刷新回填", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-panel-discard-"));
  const managed = join(root, "managed");
  const previous = Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
  Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = root;
  const legacy = JSON.stringify({ uid, avatars: { "1001": { id: 1001, level: 80, cons: 4, _source: "homo", talent: { a: 4 } } } });
  const oldFile = join(root, `${uid}.json`);
  const official = [{ id: 1001, name: "三月七", level: 80 }];
  const archive = join(managed, "42", `${uid}.json`);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    await mkdir(join(managed, "42"), { recursive: true });
    await writeFile(archive, JSON.stringify(normalizePanel(uid, official, new Date(1700000000000))));
    await writeFile(oldFile, legacy);
    await writeFile(join(root, "42-2.yaml"), `version: 1
user: { qq: '42' }
profile: { id: 2 }
account:
  ltuid: '12'
  stuid: '12'
  stoken: synthetic-stoken
  stoken_cookie: 'stuid=12; stoken=synthetic-stoken'
  cookie: 'account_id=12; cookie_token=synthetic-cookie'
  game_roles: { sr: [{ uid: '${uid}', region: prod_gf_cn, game_biz: hkrpg_cn }] }
  current_uid: { sr: '${uid}' }
`);
    const profiles = createProfileStore(root);
    let requests = 0;
    const client: ReturnType<typeof createProfileHoyoClient> = {
      ...createProfileHoyoClient(profiles, async () => { throw new Error("不应直接请求网络"); }),
      async fetchStarRailPanel(source) {
        requests++;
        entered.resolve();
        await release.promise;
        return { revision: source.revision, avatars: official, refreshedCookie: false };
      },
    };
    const panel = createStarRailPanel(profiles, client, lockFile, new AbortController().signal, undefined, managed);
    const personalPanel = createStarRailPersonalPanelReader(lockFile, managed);
    const chat = { message_type: "private", user_id: 42 };
    const erase = parsePanelCommand(`#星铁删除面板数据${uid} 档案2`)!;
    expect(erase).toEqual({ type: "discard", name: "", uid, profileId: 2 });
    expect(await panel("42", erase, { ...chat, isDelegated: true })).toContain("本人");
    expect(await panel("42", parsePanelCommand("*删除面板100000123 档案2")!, chat)).toContain("已同步的星铁 UID");
    expect(await panel("42", parsePanelCommand("*删除全部面板2")!, chat)).toContain(`*删除面板${uid} 档案2`);
    expect((await personalPanel("42", uid))?.source).toBe("miyoushe");
    const pending = panel("42", parsePanelCommand("*更新面板2")!, chat);
    await entered.promise;
    expect(await panel("42", erase, chat)).toContain("已删除");
    release.resolve();
    expect(await pending).toContain("已变更");
    expect(requests).toBe(1);
    expect(await personalPanel("42", uid)).toBeUndefined();
    expect((await personalPanel("43", uid))?.source).toBe("legacy");
    const erased = JSON.parse(await readFile(archive, "utf8"));
    expect(erased).toMatchObject({ uid, avatars: [], panelDiscardedAt: expect.any(Number) });
    let publicNotices = 0;
    expect(await panel("42", parsePanelCommand("*重载面板2")!, { ...chat, reply: () => { publicNotices++; } })).toContain("请先使用 *更新面板2");
    expect(publicNotices).toBe(0);
    expect(await panel.rebuild("42", 2, uid, new AbortController().signal, () => {})).toBe(true);
    expect(requests).toBe(2);
    expect((await personalPanel("42", uid))?.avatars).toHaveLength(1);
    expect(JSON.parse(await readFile(archive, "utf8"))).toMatchObject({ panelDiscardedAt: erased.panelDiscardedAt });
    expect(await readFile(oldFile, "utf8")).toBe(legacy);
  } finally {
    release.resolve();
    if (previous === undefined) delete Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
    else Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = previous;
    await rm(root, { recursive: true, force: true });
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
    expect(await panel("42", parsePanelCommand("#米游社星铁更新面板2")!)).toContain("请先登录档案 2");
    await writeFile(join(directory, `${uid}.json`), "损坏的 JSON");
    expect(await panel("42", parsePanelCommand("#星铁重新加载面板2")!)).toContain("暂时无法重新加载");
    expect([requests, writes]).toEqual([0, 0]);
  } finally {
    if (previous === undefined) delete Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
    else Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
