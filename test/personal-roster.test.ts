import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProfileError, type ProfileRequestContext } from "@lotus-yunzai/account";
import { readTheme } from "../panel-card.ts";
import { createStarRailRosterQuery } from "../personal-roster-command.ts";
import { buildStarRailPersonalRoster, parseStarRailPersonalRoster, starRailRosterWeek } from "../personal-roster-model.ts";

const role = { uid: "500000123", region: "prod_qd_cn", gameBiz: "hkrpg_cn", nickname: "合成开拓者", chosen: true };
const source: ProfileRequestContext = {
  qq: "42", profileId: 2, revision: "fixture-v1", game: "sr",
  device: { id: "", fp: "", name: "", model: "", androidVersion: "", raw: {} },
  account: { cookie: "cookie_token=fixture", stoken: "fixture", stokenCookie: "", stuid: "42", ltuid: "", mid: "", ltoken: "" },
  role,
};
const roster = [{ id: 1220, level: 80, rarity: 5, actived_constellation_num: 3 }, { id: 1002, level: 70, rarity: 4, rank: 2 }];
const response = { roster, summary: { nickname: "渠道档案", level: 70, avatarId: 1220, avatarCount: 2, activeDays: 731, achievement: 877 },
  talents: [{
    id: 1220, name: "飞霄", level: 80, rarity: 5, rank: 3,
    skills: [{ remake: "普攻", level: 7 }, { remake: "战技", level: 10 }, { remake: "终结技", level: 12 }, { remake: "天赋", level: 10 }],
  }] };
const sunday = new Date("2026-11-22T06:00:00Z");

async function withTheme(run: (theme: Awaited<ReturnType<typeof readTheme>>) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-roster-"));
  try {
    const chars = join(root, "meta-sr", "character");
    await mkdir(join(chars, "飞霄"), { recursive: true });
    await writeFile(join(chars, "data.json"), JSON.stringify({ 1220: { name: "飞霄", star: 5 }, 1002: { name: "丹恒", star: 4 } }));
    await writeFile(join(chars, "飞霄", "data.json"), JSON.stringify({ id: 1220, talentCons: { a: 3, e: 5, q: 3, t: 5 } }));
    await run(await readTheme(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("recognizes the old roster, skills and trace command families without consuming panels or named public skills", () => {
  for (const title of ["角色", "查询", "查询角色", "角色查询", "人物"])
    expect(parseStarRailPersonalRoster(`* ${title}2`)).toEqual({ mode: "roster", profileId: 2 });
  expect(parseStarRailPersonalRoster("#星铁我的明日四星行迹列表 档案 2")).toEqual({ mode: "talent", profileId: 2, day: "明日", rarity: 4 });
  for (const title of ["技能", "天赋", "行迹", "技能汇总", "天赋统计", "行迹列表"])
    expect(parseStarRailPersonalRoster("#星铁" + title)?.mode).toEqual("talent");
  for (const title of ["*飞霄行迹", "*刷新行迹", "*更新面板", "*角色汇总", "*角色面板", "#角色查询", "*角色查询500000123"])
    expect(parseStarRailPersonalRoster(title)).toBeUndefined();
});

test("Miao uses 04:00 China time and leaves Sunday materials unfiltered", async () => {
  expect(starRailRosterWeek("今日", new Date("2026-11-21T19:59:00Z"))).toBe(6);
  expect(starRailRosterWeek("今天", new Date("2026-11-21T20:00:00Z"))).toBe(7);
  expect(starRailRosterWeek("明日", new Date("2026-11-22T20:00:00Z"))).toBe(2);
  expect(starRailRosterWeek("周六", sunday)).toBe(6);
  await withTheme(async theme => {
    const { rows, time, materialWeek } = await buildStarRailPersonalRoster(response, role, parseStarRailPersonalRoster("*今日行迹统计")!, theme, new AbortController().signal, sunday);
    expect(rows.map(row => row.id)).toEqual(["1220", "1002"]);
    expect(rows[0]!.skills).toEqual([{ level: 7, original: 6 }, { level: 10, original: 10 }, { level: 12, original: 10 }, { level: 10, original: 10 }]);
    expect(rows[1]!.skills).toEqual([{}, {}, {}, {}]);
    expect(materialWeek).toBe(7);
    expect(time).toBe("11-22 14:00");
    expect((await buildStarRailPersonalRoster(response, role, parseStarRailPersonalRoster("*今日行迹统计")!,
      theme, new AbortController().signal, new Date("2026-11-21T19:59:00Z"))).rows).toEqual([]);
    expect((await buildStarRailPersonalRoster(response, role, parseStarRailPersonalRoster("*四星行迹统计")!,
      theme, new AbortController().signal, sunday)).rows.map(row => row.id)).toEqual(["1002"]);
  });
});

test("星铁名册表头优先读取原 Q 版文件名，也兼容现有旧别名", async () => {
  await withTheme(async theme => {
    const path = join(theme.root, "meta-sr", "character", "飞霄", "imgs");
    await mkdir(path, { recursive: true });
    const selected = parseStarRailPersonalRoster("*角色2")!;
    const signal = new AbortController().signal;
    const draw = async () => buildStarRailPersonalRoster(response, role, selected, theme, signal, sunday);
    for (const name of ["face.webp", "qface.webp", "face-q.webp"]) {
      await writeFile(join(path, name), "本地路径夹具");
      const model = await draw();
      expect(model.face.endsWith("/" + name)).toBe(true);
      expect(model.rows[0]?.face.endsWith("/face.webp")).toBe(true);
    }
  });
});

test("reads the selected profile and refuses delegation, invalid profiles and changed accounts before delivering", async () => {
  await withTheme(async theme => {
    let reads = 0, checks = 0;
    const profiles = { requestSelectedContext: async (qq: string, slot: number, game: string) => {
      checks++;
      expect([qq, slot, game]).toEqual(["42", 2, "sr"]);
      return source;
    } };
    const fetchStarRailPersonalRoster = async (context: ProfileRequestContext, options: { includeTalents: boolean; signal?: AbortSignal }) => {
      reads++;
      expect(context).toBe(source);
      expect(options.includeTalents).toBe(true);
      return { ...response, revision: source.revision, refreshedCookie: false };
    };
    const query = createStarRailRosterQuery(profiles, { fetchStarRailPersonalRoster }, new AbortController().signal,
      { theme: async () => theme, now: () => sunday, draw: async () => [] });
    const guest = { user_id: 42, message_type: "group" };
    const spec = parseStarRailPersonalRoster("*行迹统计2")!;
    expect(await query({ ...guest, isDelegated: true }, spec)).toContain("本人 QQ");
    expect(await query(guest, { ...spec, profileId: 256 })).toContain("1–255");
    expect(reads).toBe(0);
    const result = await query(guest, spec);
    expect(result).toContain("UID 500000123");
    expect(result).toContain("飞霄 · Lv.80 · 3魂 · A/E/Q/T 7/10/12/10");
    expect(checks).toBe(4);
    const moved = createStarRailRosterQuery({ requestSelectedContext: async () => checks++ === 4 ? source : { ...source, revision: "new" } },
      { fetchStarRailPersonalRoster }, new AbortController().signal);
    expect(await moved(guest, spec)).toContain("已变更");
    const loggedOut = createStarRailRosterQuery({ requestSelectedContext: async () => { throw new ProfileError("login-required", "档案尚未登录。"); } },
      { fetchStarRailPersonalRoster }, new AbortController().signal);
    expect(await loggedOut(guest, spec)).toBe("请先登录档案 2。");
    const cancelled = createStarRailRosterQuery(profiles, { fetchStarRailPersonalRoster }, new AbortController().signal);
    expect(await cancelled({ ...guest, privateCredentialSignal: AbortSignal.abort() }, spec)).toEqual([]);
    expect(reads).toBe(2);
  });
});
