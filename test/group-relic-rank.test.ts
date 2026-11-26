import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { lockFile } from "../../../lib/file-lock.ts";
import { createStarRailGroupRelicRank, matchStarRailRelicRank, parseStarRailRelicRank, resolveStarRailRelicRank, type StarRailGroupRankContext } from "../group-relic-rank.ts";
import { readPanelRankAvatar, readTheme } from "../panel-card.ts";
import { createStarRailPanelArchive, discardedStarRailPanel } from "../panel-discard.ts";
import { normalizePanel, parsePanelCommand } from "../panel-model.ts";
import { createStarRailPanel } from "../panel.ts";
import { fetchStarRailShowcase, showcaseTarget } from "../panel-showcase.ts";

const command = "#星铁银枝遗器评分排行";
const uid42 = "100000042", uid43 = "100000043", uid44 = "100000044", uid45 = "100000045", uid42alt = "100000242";
const group77 = { message_type: "group", adapter: "onebot", self_id: 99, group_id: 77, user_id: 42,
  listCurrentGroupMembers: async () => [42, 43, 44, 45, 99].map(id => ({ id })) } satisfies StarRailGroupRankContext;
const role = (uid: string) => ({ uid, region: "prod_gf_cn", gameBiz: "hkrpg_cn" });
const verified = async () => {};
const shown = (characterId: string, score = 399.9, observedAt = 111) => ({ characterId, score, grade: "D", observedAt });

test("matches ordinary group ranks, explicit relic metrics and strongest without taking public ranking commands", () => {
  expect(matchStarRailRelicRank(command)?.id).toBe(1302);
  expect(matchStarRailRelicRank("#星铁群内三月七评分排名榜")?.id).toBe(1001);
  expect(parseStarRailRelicRank("#星铁三月七双暴排行")).toMatchObject({ character: { id: 1001 }, metric: "crit" });
  expect(parseStarRailRelicRank("*三月七加权有效词条排行")).toMatchObject({ character: { id: 1001 }, metric: "valid" });
  expect(parseStarRailRelicRank("*群内遗器双爆副词条三月七排行榜")).toMatchObject({ character: { id: 1001 }, metric: "crit" });
  expect(parseStarRailRelicRank("*希儿排名")).toMatchObject({ character: { id: 1102 }, metric: "damage", strongest: false });
  expect(parseStarRailRelicRank("#星铁群内希儿排行")).toMatchObject({ character: { id: 1102 }, metric: "damage", strongest: false });
  expect(parseStarRailRelicRank("*最强银枝面板")).toMatchObject({ character: { id: 1302 }, metric: "damage", strongest: true });
  expect(parseStarRailRelicRank("#星铁群内最高分银枝详情")).toMatchObject({ character: { id: 1302 }, metric: "mark", strongest: true });
  expect(parseStarRailRelicRank("*最强银枝双暴副词条")).toMatchObject({ character: { id: 1302 }, metric: "crit", strongest: true });
  expect(parseStarRailRelicRank("*极限银枝")).toBeUndefined();
  for (const unrelated of ["#星铁三月七列表", "#星铁三月七遗器", "#星铁三月七排名统计", "#三月七遗器排名", "#原神三月七遗器排名"]) {
    expect(matchStarRailRelicRank(unrelated)).toBeUndefined();
  }
});

test("旧复合群榜指令仍分发为列表并优先显式指标", () => {
  for (const command of ["#星铁群内最强希儿排行", "*群内最强希儿排行", "#星铁群内排行最强希儿", "*群内最强希儿面版排行榜", "*群内排行最强希儿2"]) {
    expect(parseStarRailRelicRank(command)).toMatchObject({ character: { id: 1102 }, metric: "damage", strongest: false });
  }
  expect(parseStarRailRelicRank("*群内最高分希儿排行")).toMatchObject({ metric: "mark", strongest: false });
  expect(parseStarRailRelicRank("#星铁群内排行最高分希儿双暴")).toMatchObject({ metric: "crit", strongest: false });
  expect(parseStarRailRelicRank("#原神群内最强胡桃排行")).toBeUndefined();
  expect(parseStarRailRelicRank("*最强银枝面板 255")).toMatchObject({ character: { id: 1302 }, metric: "damage", strongest: true });
  for (const command of ["*银枝排名0", "*银枝排名256", "*银枝排名100000001", "*银枝排名统计2"]) {
    expect(parseStarRailRelicRank(command)).toBeUndefined();
  }
});

test("自定义别名用于星铁普通群榜、遗器及榜首，保留独立排名统计", async () => {
  let reads = 0;
  const aliases = async () => {
    reads++;
    return new Map([["花骑士", "银枝"], ["银枝", "三月七"]]);
  };
  expect(await resolveStarRailRelicRank("*最强银枝面板", aliases)).toMatchObject({ character: { id: 1302 }, strongest: true });
  expect(await resolveStarRailRelicRank("*花骑士排名统计", aliases)).toBeUndefined();
  expect(await resolveStarRailRelicRank("#原神花骑士遗器排行", aliases)).toBeUndefined();
  expect(reads).toBe(0);
  expect(await resolveStarRailRelicRank("*花骑士排行", aliases)).toMatchObject({
    character: { id: 1302 }, metric: "damage", strongest: false,
  });
  expect(await resolveStarRailRelicRank("*群内最高分花・骑士详情", aliases)).toMatchObject({
    character: { id: 1302 }, metric: "mark", strongest: true,
  });
  expect(await resolveStarRailRelicRank("*花骑士加权有效词条排行", aliases)).toMatchObject({
    character: { id: 1302 }, metric: "valid", strongest: false,
  });
  expect(await resolveStarRailRelicRank("*最强花骑士面板", aliases)).toMatchObject({
    character: { id: 1302 }, metric: "damage", strongest: true,
  });
  expect(await resolveStarRailRelicRank("*双暴花骑士加权有效词条排行", aliases)).toBeUndefined();
  expect(reads).toBe(4);
});

test("星铁群榜优先匹配完整别名，再兼容只表示旧档号的尾随数字", async () => {
  const aliases = async () => new Map([["花骑士", "银枝"], ["银枝2", "希儿"]]);
  expect(await resolveStarRailRelicRank("*最强银枝2", aliases)).toMatchObject({ character: { id: 1102 }, strongest: true });
  expect(await resolveStarRailRelicRank("*最强银枝3", aliases)).toMatchObject({ character: { id: 1302 }, strongest: true });
  expect(await resolveStarRailRelicRank("*花骑士排行2", aliases)).toMatchObject({ character: { id: 1302 } });
});

test("无角色名的星铁群榜单独解析，保留旧指标与档号写法", async () => {
  for (const [command, metric] of [
    ["*最强排行", "damage"], ["#星铁群内排行最强", "damage"], ["*最高分排行", "mark"],
    ["#星铁遗器排名 2", "mark"], ["*双暴排行", "crit"], ["*词条排行", "valid"],
  ]) {
    const aliases = async () => { throw new Error("聚合榜无需查询角色别名"); };
    expect(await resolveStarRailRelicRank(command!, aliases)).toMatchObject({ character: undefined, metric });
  }
  expect(parseStarRailRelicRank("#原神最高分排行")).toBeUndefined();
  expect(parseStarRailRelicRank("*重置群排行")).toBeUndefined();
});

const relicList = [
  { tid: 61021, type: 1, level: 15, mainAffixId: 1, subAffixList: [{ affixId: 7, cnt: 2, step: 1 }] },
  { tid: 61023, type: 3, level: 15, mainAffixId: 4, subAffixList: [{ affixId: 8, cnt: 3, step: 3 }, { affixId: 9, cnt: 1, step: 0 }] },
  { tid: 63015, type: 5, level: 15, mainAffixId: 5, subAffixList: [{ affixId: 8, cnt: 2, step: 2 }, { affixId: 9, cnt: 2, step: 2 }] },
];
const avatar = (count: number, id = 1302) => ({ avatarId: id, level: 80, promotion: 6, rank: 2, relicList: relicList.slice(0, count) });
const visible = (uid: string, ...avatars: ReturnType<typeof avatar>[]) =>
  Response.json({ detailInfo: { uid, avatarDetailList: avatars } });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-group-relic-test-"));
  const accounts = join(root, "profiles");
  await mkdir(accounts);
  async function account(qq: number, uid: string, profileId = 1) {
    await writeFile(join(accounts, `${qq}${profileId === 1 ? "" : `-${profileId}`}.yaml`),
      ["version: 1", `user: { qq: '${qq}' }`, `profile: { id: ${profileId} }`, "account:",
        "  ltuid: '12'", "  stuid: '12'", "  stoken: synthetic-private-token", "  cookie: 'ltuid=12; ltoken=synthetic-private-cookie'",
        `  game_roles: { sr: [{ uid: '${uid}', region: prod_gf_cn, game_biz: hkrpg_cn }] }`,
        `  current_uid: { sr: '${uid}' }`, ""].join("\n"));
  }
  await Promise.all([account(42, uid42), account(42, uid42alt, 2), account(43, uid43), account(44, uid44), account(45, uid45)]);
  const directory = join(root, "rank");
  const panelDirectory = join(root, "panels");
  const asked: string[] = [];
  let response = (uid: string, _signal: AbortSignal): Response | Promise<Response> => visible(uid, avatar(2));
  const use = (next: typeof response) => { response = next; };
  let selector = "0";
  const setProvider = (value: string) => { selector = value; };
  type Options = NonNullable<Parameters<typeof createStarRailGroupRelicRank>[3]>;
  const rank = (render: Options["render"] = async () => undefined, extra: Pick<Options, "renderStrongest" | "scoreDamage" | "readEnabled" | "readLimit" | "official"> = {}) =>
    createStarRailGroupRelicRank(createProfileStore(accounts), lockFile, new AbortController().signal, {
      directory, panelDirectory, groups: "77, 78, 80", render, readServer: async () => selector, readRankTheme: () => readTheme(join(root, "theme")),
      readEnabled: async (_game, _group, defaultEnabled) => defaultEnabled,
      fetchShowcase: (target, signal) => fetchStarRailShowcase(target, signal, async (url, init) => {
        const uid = url.pathname.split("/").at(-1)!;
        expect(url.origin).toBe("https://api.mihomo.me");
        expect(init).toMatchObject({ credentials: "omit", method: "GET", redirect: "error" });
        expect(new Headers(init.headers).get("Authorization")).toBeNull();
        expect(new Headers(init.headers).get("Cookie")).toBeNull();
        asked.push(uid);
        return response(uid, init.signal as AbortSignal);
      }),
      ...extra,
    });
  return { root, directory, account, rank, asked, use, setProvider, panelStore: createStarRailPanelArchive(lockFile, panelDirectory) };
}

test("星铁全群榜按角色选冠军，同 UID 只拉一次且渲染一张聚合图", async () => {
  const { root, rank, asked, use } = await fixture();
  const captured: unknown[] = [];
  const png = new Uint8Array([1]);
  let enabled = true;
  let departingMember = false;
  let departDuringRender = false;
  try {
    const board = rank(async (character, rows, _mode, _budget, _coverage, metric, aggregate) => {
      captured.push([character, metric, aggregate?.title, rows.map(row => [row.characterId, row.uid, row.metric])]);
      if (departDuringRender) departingMember = true;
      return { png };
    }, {
      scoreDamage: async avatar => avatar.relics.length * 100,
      renderStrongest: async () => { throw new Error("聚合榜不逐个发角色详情"); },
      readEnabled: async (_game, group, fallback) => group === 77 && enabled && fallback,
    });
    await board.register(group77, 1, role(uid42), 111, verified);
    await board.register({ ...group77, user_id: 43 }, 1, role(uid43), 111, verified);
    await board.register({ ...group77, user_id: 45 }, 1, role(uid45), 111, verified);
    use(uid => uid === uid42 ? visible(uid, avatar(3), avatar(2, 1102)) : visible(uid, avatar(2), avatar(3, 1102)));
    const context = { ...group77, listCurrentGroupMembers: async () => [42, ...(departingMember ? [] : [43]), 99].map(id => ({ id })) };
    expect(await board.query("*最强排行", context)).toEqual({ type: "image", file: png });
    expect(await board.query("#星铁最高分排行", context)).toEqual({ type: "image", file: png });
    expect(asked.slice(0, 2).sort()).toEqual([uid42, uid43]);
    expect(asked.slice(2).sort()).toEqual([uid42, uid43]);
    expect(captured).toEqual([
      [undefined, "damage", "*最强排行", [["1302", uid42, "damage"], ["1102", uid43, "damage"]]],
      [undefined, "mark", "*最高分排行", [["1302", uid42, "mark"], ["1102", uid43, "mark"]]],
    ]);
    departDuringRender = true;
    expect(await board.query("*最强排行", context)).toContain("群成员或档案已变化");
    expect(asked.slice(4).sort()).toEqual([uid42, uid43]);
    enabled = false;
    expect(await board.query("*最强排行", context)).toContain("未启用");
    expect(asked).toHaveLength(6);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("群内查看本人星铁角色面板会登记当场刷新所需的 UID", async () => {
  const { root, rank, panelStore, asked } = await fixture();
  const previousTheme = Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR;
  const signal = new AbortController().signal;
  try {
    Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR = join(root, "theme");
    const profiles = createProfileStore(join(root, "profiles"));
    const board = rank();
    const panel = createStarRailPanel(profiles, createProfileHoyoClient(profiles), lockFile, signal, board, join(root, "panels"));
    const snapshot = await fetchStarRailShowcase(showcaseTarget(role(uid42), "0"), signal,
      async () => visible(uid42, avatar(3)));
    await panelStore.update({ qq: "42", uid: uid42 }, verified,
      () => ({ document: { ...snapshot, source: "miyoushe" }, result: undefined }));
    expect(await board.query(command, group77)).toContain("暂无已绑定");
    const detail = parsePanelCommand("*银枝面板")!;
    expect(await panel("42", detail, { ...group77, isDelegated: true })).toMatchObject({ type: "image" });
    expect(await board.query(command, group77)).toContain("暂无已绑定");
    expect(asked).toEqual([]);
    expect(await panel("42", detail, group77)).toMatchObject({ type: "image" });
    expect(await board.query(command, group77)).toContain("本轮完整面板 1/1 已计分");
    expect(asked).toEqual([uid42]);
  } finally {
    if (previousTheme === undefined) delete Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR;
    else Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR = previousTheme;
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);

test("星铁本人面板列表和两路全量更新登记各自群，手工 UID 与代查不入榜", async () => {
  const { root, rank, asked } = await fixture();
  const env = {
    LOTUS_STAR_RAIL_PANEL_THEME_DIR: Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR,
    LOTUS_STAR_RAIL_SHOWCASE_SERVER: Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER,
    LOTUS_STAR_RAIL_LEGACY_PANEL_DIR: Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR,
  };
  const originalFetch = globalThis.fetch;
  const signal = new AbortController().signal;
  const requests: { path: string; cookie: string | null }[] = [];
  try {
    Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR = join(root, "theme");
    Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER = "0";
    Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = join(root, "legacy");
    globalThis.fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const cookie = new Headers(init?.headers).get("cookie");
      requests.push({ path: url.pathname, cookie });
      if (url.hostname === "api.mihomo.me") return visible(uid42, avatar(3));
      if (url.pathname.endsWith("/avatar/info")) return Response.json({ retcode: 0, data: {
        role: { role_id: uid42, region: "prod_gf_cn" }, avatar_list: [{ id: 1302, name: "银枝", level: 80, rarity: 5 }],
      } });
      return new Response(null, { status: 404 });
    }, { preconnect: originalFetch.preconnect });
    const profiles = createProfileStore(join(root, "profiles"));
    const board = rank();
    const panel = createStarRailPanel(profiles, createProfileHoyoClient(profiles), lockFile, signal,
      board, join(root, "panels"), undefined, join(root, "showcases"));
    const run = (msg: string, context = group77) => panel("42", parsePanelCommand(msg)!, context);
    expect(await board.query(command, group77)).toContain("暂无已绑定");
    expect(await run(`*展板更新面板${uid42}`)).toMatchObject({ type: "image" });
    expect(await board.query(command, group77)).toContain("暂无已绑定");
    expect(await panel("42", parsePanelCommand("*展板更新面板")!, { ...group77, isDelegated: true })).toContain("本人");
    expect(await run("*更新面板")).toMatchObject({ type: "image" });
    expect(await board.query(command, group77)).toContain("本轮完整面板 1/1 已计分");
    expect(asked).toEqual([uid42]);
    const group78 = { ...group77, group_id: 78 };
    expect(await board.query(command, group78)).toContain("暂无已绑定");
    expect(await run("*展板更新面板", group78)).toMatchObject({ type: "image" });
    expect(await board.query(command, group78)).toContain("本轮完整面板 1/1 已计分");
    const group80 = { ...group77, group_id: 80 };
    expect(await board.query(command, group80)).toContain("暂无已绑定");
    expect(await run("*面板", group80)).toMatchObject({ type: "image" });
    expect(await board.query(command, group80)).toContain("本轮完整面板 1/1 已计分");
    expect(asked).toEqual([uid42, uid42, uid42]);
    expect(requests).toEqual([
      { path: `/sr_info/${uid42}`, cookie: null },
      { path: "/game_record/app/hkrpg/api/avatar/info", cookie: "ltuid=12; ltoken=synthetic-private-cookie" },
      { path: `/sr_info/${uid42}`, cookie: null },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete Bun.env[key];
      else Bun.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
}, 35_000);

test("星铁最强实时重刷所有登记，且只用当轮公开展板渲染榜首一个面板", async () => {
  const { root, directory, rank, panelStore, asked, use } = await fixture();
  const draw: string[] = [];
  const png = new Uint8Array([1]);
  try {
    let discardLeader = false;
    const board = rank(async () => { throw new Error("榜首查询不应渲染排行列表"); }, {
      scoreDamage: async avatar => avatar.relics.length * 100,
      renderStrongest: async (snapshot, selected) => {
        expect(snapshot.source).toBe("mihomo");
        expect(snapshot.avatars).toContain(selected);
        expect(selected.id).toBe("1302");
        draw.push(snapshot.uid);
        if (discardLeader) {
          await panelStore.update({ qq: "42", uid: uid42 }, verified, () => ({ document: discardedStarRailPanel(uid42, 200), result: undefined }));
        }
        return { png };
      },
    });
    await board.observe(group77, 1, role(uid42), shown("1001"), verified);
    await board.observe({ ...group77, user_id: 43 }, 1, role(uid43), shown("1001"), verified);
    const oldRegistrationFile = join(directory, "onebot", "99", "77", "42.json");
    const oldRegistration = JSON.parse(await readFile(oldRegistrationFile, "utf8"));
    delete oldRegistration.profiles["1"].observedAt;
    await writeFile(oldRegistrationFile, JSON.stringify(oldRegistration));
    for (const context of [{ ...group77, message_type: "private" }, { ...group77, isDelegated: true }, { ...group77, group_id: 79 }]) {
      expect(await board.query("*最强银枝", context)).toMatch(/只能在群聊|未启用/u);
    }
    expect(asked).toEqual([]);
    use(uid => visible(uid, avatar(uid === uid43 ? 3 : 2)));
    expect(await board.query("*最强银枝面板255", group77)).toEqual([
      expect.stringContaining(`本轮伤害榜首 · UID ${uid43}`), { type: "image", file: png },
    ]);
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);
    use(uid => visible(uid, avatar(uid === uid42 ? 3 : 2)));
    expect(await board.query("#星铁群内第一银枝详情", group77)).toEqual([
      expect.stringContaining(`本轮伤害榜首 · UID ${uid42}`), { type: "image", file: png },
    ]);
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);
    expect(draw).toEqual([uid43, uid42]);
    discardLeader = true;
    expect(await board.query("#星铁最高分银枝", group77)).toContain("群成员或档案已变化");
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);
    expect(draw).toEqual([uid43, uid42, uid42]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("普通星铁角色排行对本轮全名单一致使用伤害，无规则时整榜改用遗器评分", async () => {
  const { root, rank, asked, use } = await fixture();
  try {
    const lists: { metric: string | undefined; scores: [string, number][] }[] = [];
    const strongest: string[] = [];
    let damageCalls = 0;
    const board = rank(async (_character, rows, _mode, _limit, _coverage, metric) => {
      lists.push({ metric, scores: rows.map(({ uid, score }) => [uid, score]) });
      return;
    }, {
      scoreDamage: async avatar => {
        damageCalls++;
        return avatar.relics.length === 2 ? 500 : 200;
      },
      renderStrongest: async snapshot => { strongest.push(snapshot.uid); return { png: new Uint8Array([1]) }; },
    });
    await board.observe(group77, 1, role(uid42), shown("1001"), verified);
    await board.observe({ ...group77, user_id: 43 }, 1, role(uid43), shown("1001"), verified);

    use(uid => visible(uid, avatar(uid === uid42 ? 2 : 3, 1102)));
    expect(await board.query("*希儿排名", group77)).toContain(`希儿 · 本群伤害排行\n本轮完整面板 2/2 已计分\n1. UID ${uid42} · 500.0`);
    expect(lists[0]).toEqual({ metric: "damage", scores: [[uid42, 500], [uid43, 200]] });
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);

    use(uid => visible(uid, avatar(uid === uid42 ? 3 : 2, 1102)));
    expect(await board.query("#星铁群内希儿排行", group77)).toContain(`1. UID ${uid43} · 500.0`);
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);

    use(uid => visible(uid, avatar(uid === uid42 ? 2 : 3, 1317)));
    expect(await board.query("*乱破排名", group77)).toContain(`乱破 · 本群遗器评分排行\n本轮完整面板 2/2 已计分\n1. UID ${uid43}`);
    expect(lists[2]?.metric).toBe("mark");
    expect(lists[2]?.scores.every(([, score]) => score > 0 && score <= 420)).toBe(true);
    expect(strongest).toEqual([]);
    expect(damageCalls).toBe(4);
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);
    expect(await board.query("*最强乱破", group77)).toEqual([
      expect.stringContaining(`本轮遗器评分榜首 · UID ${uid43}`), { type: "image", file: new Uint8Array([1]) },
    ]);
    expect(strongest).toEqual([uid43]);
    expect(lists).toHaveLength(3);
    expect(damageCalls).toBe(4);
    expect(asked.sort()).toEqual([uid42, uid43]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("面板范围实时优先，关闭后停止登记并丢弃在途排行榜", async () => {
  const { root, rank, asked } = await fixture();
  const target = { ...group77, group_id: 79 };
  let enabled = false;
  try {
    const board = rank(async () => {
      enabled = false;
      return { png: new Uint8Array([1]) };
    }, {
      readEnabled: async (game, group, fallback) => {
        expect(game).toBe("sr");
        expect(fallback).toBe(group === 77);
        return enabled && group === 79;
      },
    });
    expect(await board.allows(group77)).toBe(false);
    expect(await board.allows(target)).toBe(false);
    await board.observe(target, 1, role(uid42), shown("1302"), verified);
    expect(await board.query(command, target)).toContain("未启用");
    expect(asked).toEqual([]);
    enabled = true;
    expect(await board.allows(target)).toBe(true);
    expect(await board.query(command, target)).toContain("暂无已绑定");
    await board.observe(target, 1, role(uid42), shown("1302"), verified);
    expect(await board.query(command, target)).toContain("未启用");
    expect(asked).toEqual([uid42]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("双暴与有效词条现刷并独立计分，删除边界只注销此前登记", async () => {
  const { root, rank, panelStore, asked, use } = await fixture();
  try {
    const scores: Record<string, number> = {};
    const board = rank(async (_character, rows, _mode, _limit, _coverage, metric) => {
      expect(rows).toHaveLength(1);
      expect(metric).toBeDefined();
      scores[metric!] = rows[0]!.score;
      return undefined;
    });
    const crit = "*银枝双爆副词条排行";
    const valid = "#星铁银枝有效词条排行";
    await board.observe(group77, 1, role(uid42), shown("1001", 399.9, 111), verified);
    use(uid => visible(uid, avatar(3)));
    expect(await board.query(crit, group77)).toContain(uid42);
    expect(await board.query(valid, group77)).toContain(uid42);
    expect(asked.splice(0)).toEqual([uid42, uid42]);
    expect(scores.crit).toBeGreaterThan(50);
    expect(scores.valid).toBeGreaterThan(0);
    expect(scores.valid).toBeLessThan(scores.crit!);

    await panelStore.update({ qq: "42", uid: uid42 }, verified, () => ({ document: discardedStarRailPanel(uid42, 200), result: undefined }));
    await board.observe(group77, 1, role(uid42), shown("1302", 399.9, 199), verified);
    expect(await board.query(crit, group77)).toContain("暂无已绑定");
    expect(asked).toEqual([]);
    await board.observe(group77, 1, role(uid42), shown("1302", 399.9, 201), verified);
    expect(await board.query(crit, group77)).toContain(uid42);
    expect(asked).toEqual([uid42]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("refreshes every eligible registered UID once, including a different old character, and orders only new public scores", async () => {
  const { root, directory, account, rank, asked, use } = await fixture();
  try {
    await account(42, uid42, 2); // Same public UID in a second active profile.
    const board = rank();
    const otherGroup = { ...group77, group_id: 78 };
    const disabled = { ...group77, group_id: 79 };
    const delegated = { ...group77, isDelegated: true };
    const privateChat = { ...group77, message_type: "private" };
    const missingRoster = { ...group77, listCurrentGroupMembers: undefined };
    expect(await board.allows(group77)).toBe(true);
    for (const context of [disabled, delegated, privateChat, missingRoster]) {
      expect(await board.allows(context)).toBe(false);
      await board.observe(context, 1, role(uid42), shown("1302"), verified);
    }
    expect(await board.query(command, privateChat)).toContain("只能在群聊");
    expect(await board.query(command, missingRoster)).toContain("无法核对");
    expect(await board.query(command, disabled)).toContain("未启用");
    expect(await board.query(command, group77)).toContain("暂无");
    await board.observe(group77, 1, role(uid43), shown("1302"), verified);
    expect(await board.query(command, group77)).toContain("暂无");
    await board.observe(group77, 1, role(uid42), shown("1001"), verified);
    await board.observe(group77, 2, role(uid42), shown("1001"), verified);
    await board.observe({ ...group77, user_id: 43 }, 1, role(uid43), shown("1302"), verified);
    await board.observe({ ...otherGroup, user_id: 44 }, 1, role(uid44), shown("1302"), verified);
    const path = join(directory, "onebot", "99", "77", "42.json");
    const before = await readFile(path, "utf8");
    use(uid => visible(uid, avatar(uid === uid43 ? 3 : 2)));
    const reply = await board.query(command, group77);
    expect(reply).toContain(`1. UID ${uid43}`);
    expect(reply).toContain(`2. UID ${uid42}`);
    expect(reply).toContain("2/2 已计分");
    expect(reply).not.toContain("399.9");
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);
    expect(before).not.toMatch(/synthetic-private|talent|relics|ltoken|cookie/);
    expect(await readFile(path, "utf8")).toBe(before);

    use(uid => visible(uid, avatar(uid === uid42 ? 3 : 2)));
    const current = await board.query(command, group77);
    expect(current).toContain(`1. UID ${uid42}`);
    expect(current).toContain(`2. UID ${uid43}`);
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);

    expect(await board.query(command, { ...group77, adapter: "milky" })).toContain("暂无");
    await account(42, uid42alt);
    await account(42, uid42alt, 2);
    use(uid => visible(uid, avatar(2)));
    const stale = await board.query(command, group77);
    expect(stale).not.toContain(uid42);
    expect(asked).toEqual([uid43]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("separates missing characters, mismatched responses and transport failure from valid live rows", async () => {
  const { root, rank, asked, use, setProvider } = await fixture();
  try {
    const board = rank();
    for (const [qq, uid] of [[42, uid42], [43, uid43], [44, uid44], [45, uid45]] as const) {
      await board.observe({ ...group77, user_id: qq }, 1, role(uid), shown("1302"), verified);
    }
    use(uid => {
      if (uid === uid42) return visible(uid, avatar(2));
      if (uid === uid43) return visible(uid, avatar(2, 1001));
      if (uid === uid44) return new Response(null, { status: 429 });
      return visible(uid44, avatar(3));
    });
    const mixed = await board.query(command, group77);
    expect(mixed).toContain(`1. UID ${uid42}`);
    for (const uid of [uid43, uid44, uid45]) expect(mixed).not.toContain(uid);
    expect(mixed).toContain("1/4 已计分");
    expect(mixed).toContain("未获取到或词条不全 1");
    expect(mixed).toContain("读取失败 2");
    expect(asked.splice(0).sort()).toEqual([uid42, uid43, uid44, uid45]);
    setProvider("1");
    const blocked = await board.query(command, group77);
    expect(blocked).toContain("0/4 已计分");
    expect(blocked).toContain("读取失败 4");
    expect(blocked).not.toContain(uid42);
    expect(asked).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("folds both Trailblazer forms, excludes departing and rebound members, and cancels on disconnect", async () => {
  const { root, rank, account, asked, use } = await fixture();
  let departed = false;
  const context = { ...group77, listCurrentGroupMembers: async () => (departed ? [42, 99] : [42, 43, 99]).map(id => ({ id })) };
  const controller = new AbortController();
  try {
    const board = rank();
    await board.observe(context, 1, role(uid42), shown("1302"), verified);
    await board.observe({ ...context, user_id: 43 }, 1, role(uid43), shown("1302"), verified);
    use(uid => visible(uid, avatar(2, 8006)));
    expect(await board.query("#星铁穹·同谐遗器排行", context)).toContain(uid42);
    asked.length = 0;

    use(async uid => {
      if (uid === uid43) await account(43, uid44);
      return visible(uid, avatar(2));
    });
    expect(await board.query(command, context)).not.toContain(uid43);
    expect(asked.splice(0).sort()).toEqual([uid42, uid43]);
    await account(43, uid43);
    use(uid => visible(uid, avatar(2)));
    const redraw = rank(async () => { departed = true; return { png: new Uint8Array([1]) }; });
    expect(await redraw.query(command, context)).toContain("群成员或档案已变化");

    const received = Promise.withResolvers<void>();
    use((_uid, active) => {
      received.resolve();
      return new Promise((_, reject) => active.addEventListener("abort", () => reject(active.reason), { once: true }));
    });
    const run = board.query(command, { ...context, groupActivitySignal: controller.signal });
    await received.promise;
    expect(await board.query(command, context)).toContain("正在刷新");
    controller.abort();
    expect(await run).toBeUndefined();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("refreshes the whole registration list before applying the current display limit", async () => {
  const { root, rank, account, asked } = await fixture();
  const users = Array.from({ length: 17 }, (_, index) => 50 + index);
  const uidOf = (qq: number) => "1000000" + qq;
  const context = { ...group77, listCurrentGroupMembers: async () => [42, 99, ...users].map(id => ({ id })) };
  try {
    await Promise.all(users.map(qq => account(qq, uidOf(qq))));
    let configured: number | undefined;
    const board = rank(async (_character, rows, _mode, _byteLimit, coverage) => {
      expect(rows).toHaveLength(Math.min(users.length, configured ?? 15));
      expect(coverage).toEqual({ registered: 17, scored: 17, notListed: 0, failed: 0 });
      return;
    }, {
      async readLimit(game, fallback) {
        expect(game).toBe("sr");
        return configured ?? fallback;
      },
    });
    for (const qq of users) await board.observe({ ...context, user_id: qq }, 1, role(uidOf(qq)), shown("1001"), verified);
    for (const value of [undefined, 5, 30]) {
      configured = value;
      asked.length = 0;
      expect(await board.query(command, context)).toContain("17/17 已计分");
      expect(asked.sort()).toEqual(users.map(uidOf));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("projects public gear, original talent levels, and absent damage into the old rank columns", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-rank-model-"));
  try {
    for (const key of ["character/希儿", "weapon", "artifact"]) await mkdir(join(root, "meta-sr", key), { recursive: true });
    const catalog = { name: "希儿", weapon: "巡猎", elem: "量子", star: 5,
      talentCons: { a: 5, e: 3, q: 5, t: 3 } };
    await writeFile(join(root, "meta-sr/character/data.json"), JSON.stringify({ 1102: catalog }));
    await writeFile(join(root, "meta-sr/character/希儿/data.json"), JSON.stringify({ id: 1102, ...catalog }));
    await writeFile(join(root, "meta-sr/weapon/data.json"), JSON.stringify({ 23001: { name: "于夜色中", type: "巡猎", star: 5 } }));
    await writeFile(join(root, "meta-sr/artifact/data.json"), JSON.stringify({
      102: { name: "野穗伴行的快枪手", idxs: {
        1: { name: "快枪手的毡帽", ids: { 61021: 5 } }, 3: { name: "快枪手的披肩", ids: { 61023: 5 } },
      } },
    }));
    const signal = new AbortController().signal;
    const data = { ...avatar(2, 1102), rank: 5, equipment: { tid: 23001, promotion: 6, level: 80, rank: 2 },
      skillTreeList: [{ pointId: 1102001, level: 6 }, { pointId: 1102002, level: 10 },
        { pointId: 1102003, level: 10 }] };
    const snapshot = await fetchStarRailShowcase(showcaseTarget(role(uid42)), signal, async () => visible(uid42, data));
    const projection = await readPanelRankAvatar(snapshot.avatars[0]!, await readTheme(root));
    expect(projection).toMatchObject({ name: "希儿", element: "量子", path: "巡猎", rarity: 5, rank: 5,
      talents: [{ level: 7, original: 6 }, { level: 12, original: 10 }, { level: undefined }, { level: 12, original: 10 }],
      lightCone: { name: "于夜色中", level: 80, affix: 2, rarity: 5 },
      sets: [{ name: "快枪手2" }], damage: undefined,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("奇缘星魂随群榜投影保留，普通星魂数字不叠加", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-rank-extra-eidolon-"));
  try {
    const characters = { 1204: { name: "景元", weapon: "智识" },
      1213: { name: "丹恒·饮月", weapon: "毁灭" }, 1308: { name: "黄泉", weapon: "虚无" } };
    await mkdir(join(root, "meta-sr/character"), { recursive: true });
    await writeFile(join(root, "meta-sr/character/data.json"), JSON.stringify(characters));
    const theme = await readTheme(root);
    for (const exCons of [undefined, 0, 1]) {
      const snapshot = normalizePanel(uid42, Object.entries(characters).map(([id, character]) => ({
        id, name: character.name, level: 80, rank: 2, rarity: 5, exCons, skills: [], relics: [],
      })));
      for (const avatar of snapshot.avatars) {
        const row = await readPanelRankAvatar(avatar, theme);
        expect(row.rank).toBe(2);
        expect(row.exCons).toBe(exCons ?? 0);
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("验证群成员通过米游社刷新面板排行及单人有效角色正常出图", async () => {
  const { root, rank, asked } = await fixture();
  const calls: number[] = [], counts: number[] = [];
  const board = rank(async (_name, rows) => { counts.push(rows.length); return { png: new Uint8Array([1]) }; }, {
    scoreDamage: async () => 1234,
    official: {
      async list(members) { expect(members).toEqual(new Set([42, 43, 44, 45])); return [42, 43, 44].map(qq => ({ qq, profileId: 1, role: role(String(100000000 + qq)), observedAt: Date.now() })); },
      async read(entry, _signal, verify) {
        await verify(); calls.push(entry.qq);
        if (entry.qq === 44) throw Error("fixture refresh failed");
        return normalizePanel(entry.role.uid, entry.qq === 42 ? [{ id: "1302", name: "银枝", level: 80 }] : []);
      },
    },
  });
  try {
    expect(await board.query(parseStarRailRelicRank("*银枝排行")!, group77)).toMatchObject({ type: "image" });
    expect(calls.sort()).toEqual([42, 43, 44]);
    expect(counts).toEqual([1]);
    expect(asked).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
