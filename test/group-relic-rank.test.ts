import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { lockFile } from "../../../lib/file-lock.ts";
import { createStarRailGroupRelicRank, matchStarRailRelicRank, type StarRailGroupRankContext } from "../group-relic-rank.ts";
import { readTheme } from "../panel-card.ts";
import { fetchStarRailShowcase } from "../panel-showcase.ts";

const command = "#星铁银枝遗器评分排行";
const uid42 = "100000042", uid43 = "100000043", uid44 = "100000044", uid45 = "100000045", uid42alt = "100000242";
const group77 = { message_type: "group", adapter: "onebot", self_id: 99, group_id: 77, user_id: 42,
  listCurrentGroupMembers: async () => [42, 43, 44, 45, 99].map(id => ({ id })) } satisfies StarRailGroupRankContext;
const role = (uid: string) => ({ uid, region: "prod_gf_cn", gameBiz: "hkrpg_cn" });
const verified = async () => {};
const shown = (characterId: string, score = 399.9, observedAt = 111) => ({ characterId, score, grade: "D", observedAt });

test("matches relic-score ranking aliases separately from damage and public ranking commands", () => {
  expect(matchStarRailRelicRank(command)?.id).toBe(1302);
  expect(matchStarRailRelicRank("#星铁群内三月七评分排名榜")?.id).toBe(1001);
  for (const unrelated of ["#星铁三月七排行", "#星铁三月七遗器", "#星铁三月七排名统计", "#星铁三月七双暴排行", "#三月七遗器排名", "#原神三月七遗器排名"]) {
    expect(matchStarRailRelicRank(unrelated)).toBeUndefined();
  }
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
  const asked: string[] = [];
  let response = (uid: string, _signal: AbortSignal): Response | Promise<Response> => visible(uid, avatar(2));
  const use = (next: typeof response) => { response = next; };
  let selector = "0";
  const setProvider = (value: string) => { selector = value; };
  type Options = NonNullable<Parameters<typeof createStarRailGroupRelicRank>[3]>;
  const rank = (render: Options["render"] = async () => undefined) =>
    createStarRailGroupRelicRank(createProfileStore(accounts), lockFile, new AbortController().signal, {
      directory, groups: "77, 78", render, readServer: async () => selector, readRankTheme: () => readTheme(join(root, "theme")),
      fetchShowcase: (target, signal) => fetchStarRailShowcase(target, signal, async (url, init) => {
        const uid = url.pathname.split("/").at(-1)!;
        expect(url.origin).toBe("https://api.mihomo.me");
        expect(init).toMatchObject({ credentials: "omit", method: "GET", redirect: "error" });
        expect(new Headers(init.headers).get("Authorization")).toBeNull();
        expect(new Headers(init.headers).get("Cookie")).toBeNull();
        asked.push(uid);
        return response(uid, init.signal as AbortSignal);
      }),
    });
  return { root, directory, account, rank, asked, use, setProvider };
}

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
    expect(board.allows(group77)).toBe(true);
    for (const context of [disabled, delegated, privateChat, missingRoster]) {
      expect(board.allows(context)).toBe(false);
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
    expect(mixed).toContain("未展示或词条不全 1");
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

test("refreshes the whole registration list before applying the 15-row display limit", async () => {
  const { root, rank, account, asked } = await fixture();
  const users = Array.from({ length: 17 }, (_, index) => 50 + index);
  const uidOf = (qq: number) => "1000000" + qq;
  const context = { ...group77, listCurrentGroupMembers: async () => [42, 99, ...users].map(id => ({ id })) };
  try {
    await Promise.all(users.map(qq => account(qq, uidOf(qq))));
    const board = rank(async (_character, rows, _mode, _byteLimit, coverage) => {
      expect(rows).toHaveLength(15);
      expect(coverage).toEqual({ registered: 17, scored: 17, notListed: 0, failed: 0 });
      return;
    });
    for (const qq of users) await board.observe({ ...context, user_id: qq }, 1, role(uidOf(qq)), shown("1001"), verified);
    expect(await board.query(command, context)).toContain("17/17 已计分");
    expect(asked.sort()).toEqual(users.map(uidOf));
  } finally { await rm(root, { recursive: true, force: true }); }
});
