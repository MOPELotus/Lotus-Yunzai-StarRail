import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { lockFile } from "../../../lib/file-lock.ts";
import { createStarRailGroupRelicRank, matchStarRailRelicRank, type StarRailGroupRankContext } from "../group-relic-rank.ts";

const command = "#星铁三月遗器评分排行";
const group77 = { message_type: "group", adapter: "onebot", self_id: 99, group_id: 77, user_id: 42,
  listCurrentGroupMembers: async () => [42, 43, 99].map((id) => ({ id })) } satisfies StarRailGroupRankContext;
const role = (uid: string) => ({ uid, region: "prod_gf_cn", gameBiz: "hkrpg_cn" });
const verified = async () => {};

test("matches relic-score ranking aliases separately from damage and public ranking commands", () => {
  expect(matchStarRailRelicRank(command)?.id).toBe(1001);
  expect(matchStarRailRelicRank("#星铁群内三月七评分排名榜")?.id).toBe(1001);
  for (const unrelated of ["#星铁三月七排行", "#星铁三月七遗器", "#星铁三月七排名统计", "#星铁三月七双暴排行", "#三月七遗器排名", "#原神三月七遗器排名"]) {
    expect(matchStarRailRelicRank(unrelated)).toBeUndefined();
  }
});

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
  await Promise.all([account(42, "100000042"), account(42, "100000242", 2), account(43, "100000043")]);
  const directory = join(root, "rank");
  const make = (render: NonNullable<Parameters<typeof createStarRailGroupRelicRank>[3]>["render"] = async () => undefined) =>
    createStarRailGroupRelicRank(createProfileStore(accounts), lockFile, new AbortController().signal, { directory, groups: "77, 78", render });
  return { root, directory, account, make };
}

const shown = (characterId: string, score: number, observedAt: number) => ({ characterId, score, grade: "D", observedAt });

test("publishes only active own group-role summaries, keeps bot and group boundaries, and filters stale roster or selected accounts", async () => {
  const { root, directory, account, make } = await fixture();
  try {
    const rank = make();
    const otherGroup = { ...group77, group_id: 78 };
    const disabled = { ...group77, group_id: 79 };
    const delegated = { ...group77, isDelegated: true };
    const privateChat = { ...group77, message_type: "private" };
    const missingRoster = { ...group77, listCurrentGroupMembers: undefined };
    expect(rank.allows(group77)).toBe(true);
    for (const context of [disabled, delegated, privateChat, missingRoster]) {
      expect(rank.allows(context)).toBe(false);
      await rank.observe(context, 1, role("100000042"), shown("1001", 300, 100), verified);
    }
    expect(await rank.query(command, privateChat)).toContain("只能在群聊");
    expect(await rank.query(command, missingRoster)).toContain("无法核对");
    expect(await rank.query(command, disabled)).toContain("未启用");
    expect(await rank.query(command, group77)).toContain("暂无");
    await rank.observe(group77, 1, role("100000043"), shown("1001", 300, 100), verified);
    expect(await rank.query(command, group77)).toContain("暂无");
    await rank.observe(group77, 1, role("100000042"), shown("1001", 34.8, 120), verified);
    await rank.observe({ ...group77, user_id: 43 }, 1, role("100000043"), shown("1001", 89.3, 125), verified);
    await rank.observe(group77, 2, role("100000242"), shown("1001", 47, 133), verified);
    const reply = await make().query(command, group77);
    expect(reply).toContain("1. UID 100000043 · 89.3");
    expect(reply).toContain("2. UID 100000242 · 47.0");
    expect(reply).toContain("3. UID 100000042 · 34.8");
    const only42AndBot = await make().query(command, { ...group77, listCurrentGroupMembers: async () => [42, 99].map((id) => ({ id })) });
    expect(only42AndBot).not.toContain("100000043");
    expect(await make().query(command, otherGroup)).toContain("暂无");
    expect(await make().query(command, { ...group77, adapter: "milky" })).toContain("暂无");
    const archive = await readFile(join(directory, "onebot", "99", "77", "42.json"), "utf8");
    expect(archive).not.toMatch(/synthetic-private|talent|relics|ltoken|cookie/);
    await account(42, "100000142");
    const stale = await make().query(command, group77);
    expect(stale).not.toContain("100000042");
    expect(stale).toContain("100000242");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("keeps the latest display, folds both Trailblazer identities, and rechecks membership after rendering", async () => {
  const { root, make } = await fixture();
  try {
    const rank = make();
    const bound = role("100000042");
    await Promise.all([
      rank.observe(group77, 1, bound, shown("8005", 140.8, 200), verified),
      rank.observe(group77, 1, bound, shown("8005", 25, 170), verified),
      rank.observe(group77, 1, bound, shown("8006", 54.1, 130), verified),
    ]);
    expect(await make().query("#星铁星·同谐遗器排行", group77)).toContain("140.8");
    await rank.observe(group77, 1, bound, shown("8006", 0, 201), verified);
    expect(await make().query("#星铁穹·同谐遗器排行", group77)).toContain("暂无");
    await rank.observe({ ...group77, user_id: 43 }, 1, role("100000043"), shown("1001", 56, 205), verified);
    let departed = false;
    const context = { ...group77, listCurrentGroupMembers: async () => (departed ? [42, 99] : [42, 43, 99]).map((id) => ({ id })) };
    expect(await make(async () => { departed = true; return { png: new Uint8Array([1]) }; }).query(command, context)).toContain("群成员或档案已变化");
  } finally { await rm(root, { recursive: true, force: true }); }
});
