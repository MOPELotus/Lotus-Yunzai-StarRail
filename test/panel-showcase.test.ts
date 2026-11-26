import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { normalizeGameCommand } from "../../../lib/command-prefix.ts";
import { CommandRegistry } from "../../../lib/commands.ts";
import { lockFile } from "../../../lib/file-lock.ts";
import type { MessageEvent } from "../../../lib/messages.ts";
import { createModule } from "../index.ts";
import { parsePanelCommand } from "../panel-model.ts";
import { createStarRailPanel } from "../panel.ts";
import { fetchStarRailShowcase, showcaseTarget } from "../panel-showcase.ts";

const cn = { uid: "500000123", region: "prod_qd_cn", gameBiz: "hkrpg_cn" };
const os = { uid: "800000123", region: "prod_official_asia", gameBiz: "hkrpg_global" };
const now = new Date("2026-01-01T00:00:00.000Z");
const signal = new AbortController().signal;
const character = {
  avatarId: 1001, level: 80, promotion: 6, rank: 2, equipment: { tid: 21001, level: 80, promotion: 6, rank: 2 },
  skillTreeList: [{ pointId: 1001001, level: 6 }, { pointId: 1001201, level: 1 }],
  relicList: [{ tid: 61011, type: 1, level: 15, mainAffixId: 1, subAffixList: [{ affixId: 2, cnt: 2, step: -1 }] }],
};

test("旧展板和备用入口选择原服务器位，拒绝错区服和私有 Token 服务", () => {
  expect(parsePanelCommand("*备用更新面板2")).toEqual({ type: "showcase", name: "", profileId: 2 });
  expect(parsePanelCommand("*更新希儿面板2")).toEqual({ type: "showcase", name: "希儿", profileId: 2 });
  expect(parsePanelCommand("#星铁更新希儿详情 档案2")).toEqual({ type: "showcase", name: "希儿", profileId: 2 });
  expect(parsePanelCommand("#星铁更新希儿详情档案")).toBeUndefined();
  expect(parsePanelCommand(`#星铁展板获取游戏角色详情${os.uid} 档案2`)).toEqual({ type: "showcase", name: "", uid: os.uid, profileId: 2 });
  expect(parsePanelCommand("#原神展板更新面板")).toBeUndefined();
  expect(showcaseTarget(cn, "0").provider).toBe("mihomo");
  expect(showcaseTarget(cn, "234").provider).toBe("avocado");
  expect(showcaseTarget(os, "234").provider).toBe("enka");
  expect(showcaseTarget({ ...os, region: "", gameBiz: "" }, "2").region).toBe("prod_official_asia");
  expect(() => showcaseTarget({ ...os, region: cn.region }, "0")).toThrow("区服不一致");
  expect(() => showcaseTarget({ ...os, gameBiz: "hkrpg_cn" }, "0")).toThrow("区服不一致");
  expect(() => showcaseTarget(cn, "1")).toThrow("旧私有 Token");
});

test("星铁欧服展板统一两种区服写法，并拒绝其他区服的回包", async () => {
  const uid = "700000123", canonical = "prod_official_eur", legacy = "prod_official_euro";
  for (const [saved, returned] of [[canonical, legacy], [legacy, canonical]] as const) {
    const target = showcaseTarget({ uid, region: saved, gameBiz: "hkrpg_global" }, "0");
    expect(target.region).toBe(canonical);
    const load = (region: string) => fetchStarRailShowcase(target, signal, async () =>
      Response.json({ region, detailInfo: { uid, avatarDetailList: [character] } }), now);
    await expect(load(returned)).resolves.toMatchObject({ uid, source: "mihomo" });
    await expect(load(os.region)).rejects.toThrow("区服不匹配");
  }
  expect(() => showcaseTarget({ uid, region: os.region, gameBiz: "hkrpg_global" }, "0")).toThrow("区服不一致");
});

test("宿主将旧角色名刷新指令交给公开服务，普通和米游社刷新只调用官方角色接口", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-named-showcase-"));
  const env = {
    LOTUS_PROFILE_DIR: Bun.env.LOTUS_PROFILE_DIR,
    LOTUS_STAR_RAIL_SHOWCASE_SERVER: Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER,
  };
  const originalFetch = globalThis.fetch;
  try {
    Bun.env.LOTUS_PROFILE_DIR = root;
    Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER = "0";
    await writeFile(join(root, "42-2.yaml"), `version: 1
user: { qq: '42' }
profile: { id: 2 }
account:
  ltuid: '12'
  stuid: '12'
  stoken: synthetic-stoken
  stoken_cookie: 'stuid=12; stoken=synthetic-stoken'
  cookie: 'account_id=12; cookie_token=synthetic-cookie'
  game_roles: { sr: [{ uid: '${cn.uid}', region: ${cn.region}, game_biz: ${cn.gameBiz} }] }
  current_uid: { sr: '${cn.uid}' }
`);
    const requests: { url: URL; headers: Headers }[] = [];
    const fixtureFetch: typeof fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.hostname === "api.mihomo.me") return new Response(null, { status: 429 });
      return Response.json({ retcode: 0, data: { role: { role_id: cn.uid, region: cn.region }, avatar_list: [] } });
    }, { preconnect: originalFetch.preconnect });
    globalThis.fetch = fixtureFetch;
    const registry = new CommandRegistry();
    registry.registerModule({ name: "@lotus-yunzai/starrail", ...createModule({ signal, lockFile }) });
    const dispatch = (msg: string, context: Partial<MessageEvent> = {}) => {
      const event = normalizeGameCommand({ msg, message_type: "private", user_id: 42, isMaster: false, ...context } as MessageEvent);
      return registry.dispatchFallback(event, () => true, () => false);
    };
    for (const cmd of ["#星铁更新希儿面板2", "*更新希儿详情 档案2"]) {
      expect(await dispatch(cmd)).toContain("公开星铁展板请求过于频繁");
    }
    expect(await dispatch("*更新希儿面板2", { isDelegated: true })).toContain("本人");
    expect(await dispatch("*更新不存在的角色面板2")).toBeUndefined();
    expect(await dispatch("*更新面板2")).toContain("米游社未返回");
    expect(await dispatch("#星铁米游社更新面板2")).toContain("米游社未返回");
    expect(requests.map(({ url }) => [url.hostname, url.pathname])).toEqual([
      ["api.mihomo.me", `/sr_info/${cn.uid}`],
      ["api.mihomo.me", `/sr_info/${cn.uid}`],
      ["api-takumi-record.mihoyo.com", "/game_record/app/hkrpg/api/avatar/info"],
      ["api-takumi-record.mihoyo.com", "/game_record/app/hkrpg/api/avatar/info"],
    ]);
    expect(requests.slice(0, 2).map(({ headers }) => headers.get("cookie"))).toEqual([null, null]);
    expect(requests.slice(2).map(({ headers }) => headers.get("cookie"))).toEqual([
      "account_id=12; cookie_token=synthetic-cookie", "account_id=12; cookie_token=synthetic-cookie",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete Bun.env[key];
      else Bun.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("手动星铁展板更新跳过缓存并保留并发互斥、限流回执及普通重载", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-showcase-refresh-"));
  const showcases = join(root, "showcases");
  const archive = join(showcases, "42", `${cn.uid}.json`);
  const env = {
    LOTUS_STAR_RAIL_LEGACY_PANEL_DIR: Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR,
    LOTUS_STAR_RAIL_SHOWCASE_SERVER: Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER,
  };
  const originalFetch = globalThis.fetch;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let requests = 0;
  try {
    Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = root;
    Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER = "0";
    await writeFile(join(root, "42-2.yaml"), `version: 1
user: { qq: '42' }
profile: { id: 2 }
account:
  game_roles: { sr: [{ uid: '${cn.uid}', region: ${cn.region}, game_biz: ${cn.gameBiz} }] }
  current_uid: { sr: '${cn.uid}' }
`);
    globalThis.fetch = Object.assign(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.href).toBe(`https://api.mihomo.me/sr_info/${cn.uid}`);
      const request = ++requests;
      if (request === 2) {
        entered.resolve();
        await release.promise;
      }
      if (request >= 3) return new Response(null, { status: 429 });
      return Response.json({ ttl: 3600, detailInfo: { uid: cn.uid, avatarDetailList: [{ ...character, level: 60 + 10 * request }] } });
    }, { preconnect: originalFetch.preconnect });
    const profiles = createProfileStore(root);
    const client = createProfileHoyoClient(profiles, async () => { throw new Error("不应请求官方账号接口"); });
    const panel = createStarRailPanel(profiles, client, lockFile, signal, undefined, join(root, "managed"), undefined, showcases);
    const command = parsePanelCommand("*展板更新面板2")!;
    const chat = { message_type: "private", user_id: 42 };
    await panel("42", command, chat);
    expect(JSON.parse(await readFile(archive, "utf8"))).toMatchObject({ showcaseTtl: 3600, avatars: [{ level: 70 }] });

    const second = panel("42", command, chat);
    await Promise.race([entered.promise, second.then(() => { throw new Error("第二次手动更新应立即发起展板请求"); })]);
    expect(await panel("42", command, chat)).toContain("正在查询");
    expect(requests).toBe(2);
    release.resolve();
    await second;
    const current = await readFile(archive, "utf8");
    expect(JSON.parse(current)).toMatchObject({ showcaseTtl: 3600, avatars: [{ level: 80 }] });

    expect(await panel("42", command, chat)).toContain("公开星铁展板请求过于频繁");
    let notices = 0;
    await panel("42", parsePanelCommand("*重载面板2")!, { ...chat, reply: () => { notices++; return true; } });
    expect([requests, notices]).toEqual([3, 0]);
    expect(await readFile(archive, "utf8")).toBe(current);
  } finally {
    release.resolve();
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete Bun.env[key];
      else Bun.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
}, 15000);

test("Mihomo 原始接口仅发绑定 UID，展板覆盖同名助战，角色和词条迁入同一面板模型", async () => {
  const result = await fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async (url, init) => {
    expect(url.href).toBe(`https://api.mihomo.me/sr_info/${cn.uid}`);
    expect(init).toMatchObject({ method: "GET", credentials: "omit", redirect: "error" });
    expect(init.body).toBeUndefined();
    expect([...new Headers(init.headers)]).toEqual([["accept", "application/json"], ["user-agent", "Lotus-Yunzai"]]);
    return Response.json({ ttl: 120, detailInfo: { uid: Number(cn.uid), nickname: "未使用个人签名", region: cn.region,
      assistAvatarList: [{ ...character, level: 50 }], avatarDetailList: [character] } });
  }, now);
  expect(result).toMatchObject({ uid: cn.uid, source: "mihomo", updatedAt: now.toISOString(), showcaseTtl: 120, avatars: [{
    id: "1001", name: "三月七", level: 80, rank: 2, legacy: { source: "homo", promote: 6, dataComplete: true },
    skills: [{ key: "a", level: 6 }], traces: [{ id: "1001201", active: true }],
    cone: { id: "21001", rank: 2 }, relics: [{ id: "61011", rarity: 5, legacyMainId: "1", legacySubIds: ["2,2,-1"] }],
  }] });
  expect(JSON.stringify(result)).not.toContain("未使用个人签名");
});

test("显式备用源使用自己的固定域和字段，失败不改换其他来源", async () => {
  let requests = 0;
  const alt = async (url: URL) => {
    requests++;
    switch (url.hostname) {
      case "avocado.wiki":
        expect(url.pathname).toBe(`/v1/raw/info/${cn.uid}`);
        return Response.json({ playerDetailInfo: { uid: cn.uid, displayAvatars: [{ avatarId: 1001, level: 70,
          equipment: { id: 21001, level: 75 }, behaviorList: [{ id: 1001001, level: 5 }],
          relics: [{ id: 61011, type: 1, level: 12, main_affix_id: 1, sub_affix_id: [{ id: 2, cnt: 1 }] }] }] } });
      case "enka.network":
        expect(url.pathname).toBe(`/api/hsr/uid/${os.uid}`);
        return Response.json({ uid: os.uid, detailInfo: { assistAvatarDetail: { AvatarID: 1001, Level: 70 } } });
      default:
        throw new Error("未授权的测试来源");
    }
  };
  expect(await fetchStarRailShowcase(showcaseTarget(cn, "3"), signal, alt)).toMatchObject({ source: "avocado", avatars: [{
    cone: { id: "21001" }, skills: [{ key: "a", level: 5 }], relics: [{ legacySubIds: ["2,1,0"] }],
  }] });
  expect(await fetchStarRailShowcase(showcaseTarget(os, "4"), signal, alt)).toMatchObject({ source: "enka", avatars: [{ id: "1001" }] });
  for (const response of [
    { detailInfo: { uid: os.uid, avatarDetailList: [character] } },
    { detailInfo: { uid: cn.uid, region: os.region, avatarDetailList: [character] } },
    { detailInfo: { avatarDetailList: [character] } },
  ]) {
    await expect(fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async () => { requests++; return Response.json(response); }))
      .rejects.toThrow("UID 或区服不匹配");
  }
  await expect(fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async () => { requests++; return Response.json({
    detailInfo: { uid: cn.uid, isDisplayAvatar: false, avatarDetailList: [character] },
  }); })).rejects.toThrow("没有展示角色");
  await expect(fetchStarRailShowcase(showcaseTarget(cn, "0"), signal, async () => { requests++; return new Response(null, { status: 429 }); }))
    .rejects.toThrow("过于频繁");
  expect(requests).toBe(7);
});


test("星铁欧服展板统一两种区服写法，并拒绝其他区服的回包", async () => {
  for (const [role, region] of [[cn, "CN"], [os, "ASIA"], [{ uid: "700000123", region: "prod_official_eur", gameBiz: "hkrpg_global" }, "EU"]] as const) {
    const target = showcaseTarget(role, "4");
    const reply = { uid: role.uid, region, detailInfo: { uid: role.uid, avatarDetailList: [character] } };
    expect(await fetchStarRailShowcase(target, signal, async () => Response.json(reply))).toMatchObject({ uid: role.uid, source: "enka" });
    await expect(fetchStarRailShowcase(target, signal, async () => Response.json({ ...reply, region: region === "CN" ? "ASIA" : "CN" })))
      .rejects.toThrow("UID 或区服不匹配");
    await expect(fetchStarRailShowcase(target, signal, async () => Response.json({ ...reply, uid: "100000999" })))
      .rejects.toThrow("UID 或区服不匹配");
  }
});
