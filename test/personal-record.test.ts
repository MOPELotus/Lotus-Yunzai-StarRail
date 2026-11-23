import { expect, test } from "bun:test";
import type { ProfileRequestContext } from "@lotus-yunzai/account";
import { HoyoRequestError, createHoyoClient } from "@lotus-yunzai/hoyo-client";
import { createStarRailPersonalRecordQuery, makeStarRailPersonalRecord, matchStarRailPersonalRecord } from "../personal-record.ts";
import { parseStarRailPersonalRoster } from "../personal-roster-model.ts";

const source: ProfileRequestContext = {
  qq: "42", profileId: 2, revision: "fixture", game: "sr",
  account: { cookie: "cookie_token=old", stoken: "fixture", stokenCookie: "", stuid: "42", ltuid: "", mid: "", ltoken: "" },
  device: { id: "device-two", fp: "fp-two", name: "", model: "", androidVersion: "", raw: {} },
  role: { uid: "500000123", region: "prod_qd_cn", regionName: "无名客", gameBiz: "hkrpg_cn", nickname: "本人档案", level: 70, chosen: true },
};
const data = {
  role: { uid: "500000123", server: "prod_qd_cn", nickname: "指数昵称", level: 69 },
  phone_background_image_url: "https://act-webstatic.mihoyo.com/game_record/hkrpg/.png",
  cur_head_icon_url: "https://act-webstatic.mihoyo.com/head.png?signature=omit",
  stats: { active_days: 730, avatar_num: 32, achievement_count: 800, chest_num: 1000, abyss_process: "12-3" },
  avatar_list: [
    { id: 1220, icon: "https://act-webstatic.mihoyo.com/feixiao.png", name: "飞霄", element: "wind", level: 80, rarity: 5, rank: 2 },
    { id: 1002, icon: "http://localhost/private.png", name: "丹恒", element: "wind", level: 70, rarity: 4, rank: 0 },
  ],
};
const signal = new AbortController().signal;

test("原卡片和探索同入口，保留当前角色名单和行迹，不把 UID 当档案", () => {
  for (const message of ["*卡片2", "*探索 档案 2", "#星铁探索2", "＊卡片2", "星穹铁道卡片2", "*sr卡片2"])
    expect(matchStarRailPersonalRecord(message)).toEqual({ profileId: 2 });
  for (const message of ["*角色", "#星铁角色2", "*行迹统计2"]) {
    expect(matchStarRailPersonalRecord(message)).toBeUndefined();
    expect(parseStarRailPersonalRoster(message)).toBeDefined();
  }
  expect(matchStarRailPersonalRecord("*探索500000123")).toBeUndefined();
  expect(matchStarRailPersonalRecord("#探索")).toBeUndefined();
  const model = makeStarRailPersonalRecord(data, source.role);
  expect(model).toMatchObject({
    nickname: "本人档案", region: "无名客", level: 70,
    avatar: "https://act-webstatic.mihoyo.com/head.png", background: undefined,
    stats: [["活跃天数", 730], ["已解锁角色", 32], ["达成成就数", 800], ["战利品开启", 1000], ["忘却之庭", "12-3"]],
  });
  expect(model.avatars.map(item => [item.name, item.icon])).toEqual([
    ["飞霄", "https://act-webstatic.mihoyo.com/feixiao.png"], ["丹恒", ""],
  ]);
});

test("旧 index 只用当前档案签发，过期换票并重试一次，跨区响应拒绝", async () => {
  let active = source, exchanges = 0;
  const reads: string[] = [];
  const client = createHoyoClient(async (url, init) => {
    expect(url.href).toBe("https://api-takumi-record.mihoyo.com/game_record/app/hkrpg/api/index?role_id=500000123&server=prod_qd_cn");
    const headers = new Headers(init.headers);
    expect(headers.get("x-rpc-device_id")).toBe("device-two");
    const cookie = headers.get("Cookie")!;
    reads.push(cookie);
    return Response.json(cookie === "cookie_token=old" ? { retcode: -100 } : { retcode: 0, data });
  }, {
    profiles: {
      async accountContext(qq, id) {
        expect([qq, id]).toEqual(["42", 2]);
        return active;
      },
      async saveRefreshedCredentials(qq, id, revision, credentials) {
        expect([qq, id, revision]).toEqual(["42", 2, "fixture"]);
        active = { ...source, revision: "next", account: { ...source.account, cookie: credentials.cookie } };
        return active;
      },
      async saveRoles() { throw new Error("名片只能读取角色"); },
    },
    async exchange(profile, options) {
      expect(profile.profileId).toBe(2);
      await options?.verifyProfile?.();
      exchanges++;
      return { cookie: "cookie_token=new", ltoken: "" };
    },
  });
  expect(await client.fetchStarRailPersonalRecord(source)).toMatchObject({ data, revision: "next", refreshedCookie: true });
  expect(reads).toEqual(["cookie_token=old", "cookie_token=new"]);
  expect(exchanges).toBe(1);
  const mismatch = createHoyoClient(async () => Response.json({ retcode: 0, data: { role: { server: "prod_gf_cn" } } }));
  await expect(mismatch.fetchStarRailPersonalRecord(source)).rejects.toThrow("角色或区服不一致");
});

test("会话只查本人选档，按协议限额回退文字，转档和私密状态不回图", async () => {
  let active = source, calls = 0, checks = 0, drawn = 0;
  const profiles = { async requestSelectedContext(qq: string, slot: number, game: string) {
    expect([qq, slot, game]).toEqual(["42", 2, "sr"]);
    checks++;
    return active;
  } };
  const client = { async fetchStarRailPersonalRecord(_: ProfileRequestContext) {
    calls++;
    return { data, revision: source.revision, refreshedCookie: false };
  } };
  const query = createStarRailPersonalRecordQuery(profiles, client, signal, async (_, __, options) => {
    expect(options?.inlineImageByteLimit).toBe(2);
    drawn++;
    return { png: new Uint8Array([1, 2, 3]) };
  });
  const group = { user_id: 42, self_id: 1300, message_type: "group", inlineImageByteLimit: 2 };
  expect(await query({ ...group, at: 9 }, { profileId: 2 })).toContain("本人 QQ");
  expect(await query({ ...group, isDelegated: true }, { profileId: 2 })).toContain("本人 QQ");
  expect(await query(group, { profileId: 256 })).toContain("1–255");
  expect(calls).toBe(0);
  const reply = await query(group, { profileId: 2 });
  expect(reply).toContain("UID 500000123");
  expect(reply).toContain("战利品开启 1000");
  expect(reply).toContain("忘却之庭 12-3");
  expect(reply).toContain("飞霄 Lv.80 · 2魂");
  expect(checks).toBe(3);
  expect(drawn).toBe(1);
  const racing = createStarRailPersonalRecordQuery(profiles, client, signal, async () => {
    active = { ...source, revision: "changed during render" };
    return { png: new Uint8Array([1]) };
  });
  expect(await racing(group, { profileId: 2 })).toBe("星铁档案已变更，请重新查询战绩名片。");
  const hidden = createStarRailPersonalRecordQuery(profiles, {
    async fetchStarRailPersonalRecord() { throw new HoyoRequestError("api", "private", 200, 10102); },
  }, signal, async () => { throw new Error("私密响应不能出图"); });
  expect(await hidden(group, { profileId: 2 })).toContain("未公开");
});
