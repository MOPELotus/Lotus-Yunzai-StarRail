import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStarRailGachaLinkCommand } from "../gacha-link-command.ts";
import { checkedStarRailLinkRole, readStarRailGachaLink } from "../gacha-link-source.ts";
import { createStarRailGachaRecordArchive } from "../gacha-record-archive.ts";

const role = { uid: "100123456", region: "prod_gf_cn", gameBiz: "hkrpg_cn", chosen: true, nickname: "夹具开拓者" };
const path = "/common/gacha_record/api/";
const origin = "https://public-operation-hkrpg.mihoyo.com";
const key = "sr-fixture:+/=";
const url = origin + path + "getGachaLog?game_biz=hkrpg_cn&region=prod_gf_cn&authkey=" + encodeURIComponent(key);
const row = (id: string, pool: string, uid = role.uid) => ({
  uid, id, gacha_id: "20011", gacha_type: pool, item_id: "1003", rank_type: "5", count: "1",
  time: "2026-11-22 17:00:00", name: "夹具物品", item_type: "角色",
});
const page = (list: unknown[]) => Response.json({ retcode: 0, data: { region: role.region, region_time_zone: 8, list } });
const verify = async () => {};

test("six pools use only the official endpoints and preserve high precision cursor, timezone and actual rows", async () => {
  const found: string[] = [];
  const archive = await readStarRailGachaLink(url + "&end_id=999&size=1", checkedStarRailLinkRole(role), new AbortController().signal, verify, {
    intervalMs: 0,
    async transport(endpoint, init) {
      const pool = endpoint.searchParams.get("gacha_type")!;
      const cursor = endpoint.searchParams.get("end_id");
      const first = endpoint.searchParams.get("page") === "1";
      expect(endpoint.origin).toBe(origin);
      expect(endpoint.pathname).toBe(path + (pool === "21" || pool === "22" ? "getLdGachaLog" : "getGachaLog"));
      expect(endpoint.searchParams.get("authkey")).toBe(key);
      expect(endpoint.searchParams.get("size")).toBe("20");
      expect(init).toMatchObject({ redirect: "error", credentials: "omit", referrerPolicy: "no-referrer" });
      expect(new Headers(init.headers).has("cookie")).toBe(false);
      expect(cursor).toBe(first ? "0" : "18000000000000000" + pool.padStart(2, "0"));
      found.push(pool);
      return page(first ? [row("18000000000000000" + pool.padStart(2, "0"), pool)] : []);
    },
  });
  expect(found).toEqual(["1", "1", "2", "2", "11", "11", "12", "12", "21", "21", "22", "22"]);
  expect(archive.timezone).toBe(8);
  expect(archive.records.length).toBe(6);
  expect(archive.records.every(record => record.uid === role.uid && record.time === "2026-11-22 17:00:00")).toBe(true);
  expect(JSON.stringify(archive)).not.toContain(key);
});

test("fixed issuer, rejects mismatched roles, no partial archive on repeated pages, cap, expired or empty link", async () => {
  const signal = new AbortController().signal, expected = checkedStarRailLinkRole(role);
  const rejectSend = async () => { throw Error("unexpected transport"); };
  for (const invalid of [url.replace(origin, "https://wrong.invalid"), url + "&authkey=duplicate", url + "&uid=200123456",
    url.replace("prod_gf_cn", "prod_qd_cn"), url + "#fragment", url.replace("https:", "http:")]) {
    await expect(readStarRailGachaLink(invalid, expected, signal, verify, { transport: rejectSend })).rejects.toThrow("完整星铁官方");
  }
  await expect(readStarRailGachaLink(url, expected, signal, verify, {
    transport: async () => page([row("1800000000000000001", "1", "200123456")]),
  })).rejects.toThrow("不一致");
  await expect(readStarRailGachaLink(url, expected, signal, verify, {
    intervalMs: 0, transport: async () => page([row("1800000000000000001", "1")]),
  })).rejects.toThrow("不完整");
  await expect(readStarRailGachaLink(url, expected, signal, verify, {
    intervalMs: 0, maxPages: 2, transport: async () => page([]),
  })).rejects.toThrow("分页上限");
  await expect(readStarRailGachaLink(url, expected, signal, verify, {
    transport: async () => Response.json({ retcode: -100, message: key }),
  })).rejects.toThrow("已失效");
  await expect(readStarRailGachaLink(url, expected, signal, verify, {
    intervalMs: 0, transport: async () => page([]),
  })).rejects.toThrow("暂无可核验");
});

test("international links preserve the returned local time and never use the national host", async () => {
  const overseas = "https://public-operation-hkrpg-sg.hoyoverse.com";
  const selected = checkedStarRailLinkRole({ ...role, uid: "600123456", region: "prod_official_usa", gameBiz: "hkrpg_global" });
  const signal = new AbortController().signal;
  const archive = await readStarRailGachaLink(overseas + path + "getGachaLog?authkey=fixture-overseas", selected, signal, verify, {
    intervalMs: 0,
    async transport(endpoint) {
      expect(endpoint.origin).toBe(overseas);
      expect(endpoint.searchParams.get("game_biz")).toBe("hkrpg_global");
      const list = endpoint.searchParams.get("gacha_type") === "21" && endpoint.searchParams.get("end_id") === "0"
        ? [row("1800000000000000021", "21", selected.uid)] : [];
      return Response.json({ retcode: 0, data: { list, region: selected.region, region_time_zone: -5 } });
    },
  });
  expect(archive).toMatchObject({ timezone: -5, records: [{ uid: selected.uid, gacha_type: "21", time: "2026-11-22 17:00:00" }] });
  await expect(readStarRailGachaLink(url, selected, signal, verify)).rejects.toThrow("完整星铁官方");
});

test("星铁欧服逐抽链接兼容新旧区服字段，错区链接和回包不会导入", async () => {
  const uid = "700000123", canonical = "prod_official_eur", legacy = "prod_official_euro";
  const origin = "https://public-operation-hkrpg-sg.hoyoverse.com";
  const signal = new AbortController().signal;
  const link = (region: string) => origin + path + "getGachaLog?authkey=fixture-eur&region=" + region;
  for (const [saved, returned] of [[canonical, legacy], [legacy, canonical]] as const) {
    const selected = checkedStarRailLinkRole({ ...role, uid, region: saved, gameBiz: "hkrpg_global" });
    expect(selected.region).toBe(canonical);
    const load = (region: string) => readStarRailGachaLink(link(returned), selected, signal, verify, {
      intervalMs: 0,
      async transport(endpoint) {
        expect(endpoint.origin).toBe(origin);
        const hasRow = endpoint.searchParams.get("gacha_type") === "11" && endpoint.searchParams.get("page") === "1";
        return Response.json({ retcode: 0, data: { region, region_time_zone: 1,
          list: hasRow ? [row("1800000000000000011", "11", uid)] : [] } });
      },
    });
    await expect(load(returned)).resolves.toMatchObject({ uid, timezone: 1, records: [{ uid, gacha_type: "11" }] });
    await expect(load("prod_official_asia")).rejects.toThrow("不一致");
    await expect(readStarRailGachaLink(link("prod_official_asia"), selected, signal, verify, {
      transport: async () => { throw new Error("错区链接不应出站"); },
    })).rejects.toThrow("完整星铁官方");
  }
});

test("session is bound to bot, QQ, verified login and profile and merges atomically without storing the link", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-sr-gacha-link-"));
  try {
    const archive = createStarRailGachaRecordArchive({ directory: join(root, "new"), legacyDirectory: join(root, "old") },
      async () => ({ close() {} }));
    let login = "original", calls = 0, revoke = false;
    const controller = new AbortController();
    const handle = createStarRailGachaLinkCommand({
      async savedRole(qq, profileId, game) {
        expect([qq, profileId, game]).toEqual(["42", 2, "sr"]);
        return role;
      },
      async loginIdentity() { return login; },
    }, archive, controller.signal, (input, selected, signal, verifyProfile) => readStarRailGachaLink(input, selected, signal, verifyProfile, {
      intervalMs: 0,
      async transport(target) {
        calls++;
        if (revoke) login = "changed again";
        return page(target.searchParams.get("gacha_type") === "11" && target.searchParams.get("page") === "1" ?
          [row("1800000000000000001", "11")] : []);
      },
    }));
    const connection = new AbortController();
    const context = { adapter: "onebot", self_id: 99, user_id: 42, message_type: "private",
      privateCredentialSignal: connection.signal, reply: (text: string) => { expect(text).not.toContain(key); return true; } };
    const send = (normalizedMessage: string, changes = {}) => handle({ ...context, normalizedMessage, ...changes });
    expect(await send("*抽卡链接2", { message_type: "group" })).toContain("好友私聊");
    expect(await send("*抽卡链接2", { isDelegated: true })).toBeUndefined();
    expect(await send(url)).toContain("先私聊");
    expect(await send("*抽卡链接绑定2")).toContain("两分钟");
    expect(await send(url, { self_id: 100 })).toContain("先私聊");
    expect(await send(url, { user_id: 43 })).toContain("先私聊");
    login = "changed";
    expect(await send(url)).toContain("已变化");
    expect(calls).toBe(0);
    expect(await send("#星铁抽卡链接2")).toContain("两分钟");
    expect(await send(url)).toContain("新增 1");
    const stored = await archive.read({ qq: "42", uid: role.uid }, { legacyTimezone: 8 });
    expect(stored).toMatchObject({ status: "available", archive: { uid: role.uid, timezone: 8 } });
    expect(JSON.stringify(stored)).not.toContain(key);
    expect(await send("#星铁抽卡链接2")).toContain("两分钟");
    revoke = true;
    expect(await send(url)).toContain("已变化");
    expect(await archive.read({ qq: "42", uid: role.uid }, { legacyTimezone: 8 })).toEqual(stored);
  } finally { await rm(root, { recursive: true, force: true }); }
});
