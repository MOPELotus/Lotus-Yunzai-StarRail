import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import type { ChatFile, ChatFileResult } from "../../../lib/chat-files.ts";
import { normalizePanel, parsePanelCommand, readLegacyPanel, starRailLegacySkillLevel } from "../panel-model.ts";
import { panelExportFile } from "../panel-file.ts";
import { applyStarRailTraces } from "../panel-trace-refresh.ts";
import { createStarRailPanel } from "../panel.ts";

const uid = "100000122";
const role = `{ uid: "${uid}", region: prod_gf_cn, game_biz: hkrpg_cn }`;
const credential = "private-fixture-value";
const saved = `version: 1
user: { qq: "42" }
profile: { id: 2 }
account:
  cookie: fixture-cookie
  stoken: fixture-stoken
  game_roles: { sr: [${role}] }
  current_uid: { sr: "${uid}" }
`;
const legacy = {
  uid, _ck: credential, info: { cookie: credential, nickname: "private" },
  avatars: { "1102": { id: "1102", level: 80, _source: "homo", cookie: credential,
    talent: { a: 6, token: credential }, trees: ["101"],
    weapon: { id: "23001", level: 80, affix: 1, cookie: credential },
    artis: { "1": { id: "61011", level: 15, mainId: "1", attrIds: ["1,2,-1", credential] } },
  } },
};

test("导出面板读取所选本人档案，保留旧角色文件结构、跳过凭据并要求显式群分享", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-starrail-panel-file-"));
  const prior = Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
  Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = directory;
  try {
    const path = join(directory, `${uid}.json`);
    const oldBytes = JSON.stringify(legacy);
    await writeFile(path, oldBytes);
    await writeFile(join(directory, "42-2.yaml"), saved);
    await writeFile(join(directory, "42.yaml"), saved.replace("id: 2", "id: 1").replace("  stoken: fixture-stoken\n", ""));
    const profiles = createProfileStore(directory);
    const client = createProfileHoyoClient(profiles, async () => { throw new Error("此导出不应发出外部请求"); });
    const panel = createStarRailPanel(profiles, client, async () => { throw new Error("此导出不应请求写锁"); }, new AbortController().signal);
    const files: ChatFile[] = [];
    const uploadFile = async (file: ChatFile): Promise<ChatFileResult> => { files.push(file); return "confirmed"; };
    const privateContext = { message_type: "private", uploadFile };
    const group = { message_type: "group", adapter: "onebot", self_id: 99, group_id: 77, uploadFile };
    const normal = parsePanelCommand("#星铁导出面板 档案2")!;
    expect(normal).toEqual({ type: "export", name: "", profileId: 2, share: false });
    expect(await panel("42", normal, group)).toContain("请私聊");
    expect(await panel("42", parsePanelCommand("*导出面板")!, privateContext)).toContain("请先登录 profile 1");
    expect(await panel("43", normal, privateContext)).toContain("请先登录 profile 2");
    expect(await panel("42", normal, { ...privateContext, isDelegated: true })).toContain("私聊");
    expect(await panel("42", { ...normal, profileId: 256 }, privateContext)).toContain("1–255");
    expect(files).toBeEmpty();

    const result = await panel("42", normal, privateContext);
    expect(result).toContain("旧 PlayerData 格式");
    expect(files[0]?.name).toBe(`${uid}.json`);
    const fileText = new TextDecoder().decode(files[0]?.bytes);
    expect(fileText).not.toContain(credential);
    expect(JSON.parse(fileText)).toMatchObject({ uid, avatars: { "1102": {
      weapon: { id: "23001", level: 80, affix: 1 }, talent: { a: 6 }, artis: { "1": { attrIds: ["1,2,-1"] } },
    } } });
    expect(await panel("42", parsePanelCommand("*强制导出面板2")!, group)).toContain("已导出");
    expect(await panel("42", normal, { message_type: "private", uploadFile: async () => "unknown" })).toContain("未确认");
    expect(await panel("42", normal, { message_type: "private", uploadFile: async () => "rejected" })).toContain("发送失败");
    expect(await panel("42", normal, { message_type: "private" })).toContain("不支持发送");
    let checks = 0;
    const changingProfile = {
      ...profiles,
      async requestContext(...args: Parameters<typeof profiles.requestContext>) {
        const current = await profiles.requestContext(...args);
        return ++checks === 1 ? current : { ...current, revision: `${current.revision}-changed` };
      },
    };
    const changed = createStarRailPanel(changingProfile, client, async () => { throw new Error("仍应只读"); }, new AbortController().signal);
    expect(await changed("42", normal, privateContext)).toContain("档案已变更");
    expect(files).toHaveLength(2);
    expect(await readFile(path, "utf8")).toBe(oldBytes);
  } finally {
    if (prior === undefined) delete Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
    else Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = prior;
    await rm(directory, { recursive: true, force: true });
  }
});


test("新版面板导出标明版本，只交付面板字段和公开图链接", () => {
  const snapshot = normalizePanel(uid, [{ id: 1102, level: 80, icon: "https://act-webstatic.mihoyo.com/a.png?token=private-value",
    image: "https://act-webstatic.mihoyo.com/b.png", properties: [{ property_type: 1, final: "1000" }] }]);
  const file = panelExportFile({ ...snapshot, account: credential, avatars: snapshot.avatars.map(avatar => ({
    ...avatar, cookie: credential,
  })) } as typeof snapshot);
  const body = new TextDecoder().decode(file.bytes);
  expect(body).not.toContain(credential);
  expect(body).not.toContain("private-value");
  expect(file.format).toBe("Lotus-Yunzai 面板格式");
  expect(JSON.parse(body)).toMatchObject({ version: 1, uid, avatars: [{ id: "1102", face: "", stats: [{ key: "hp", value: "1000" }] }] });
});


test("旧面板只导出可唯一还原的刷新等级，沿用歧义等级和缺档位资料的原值", () => {
  const old = { ...legacy, _profile: 1_700_000_000_000, avatars: { "1102": { ...legacy.avatars["1102"],
    cons: 4, talent: { a: 3, e: 7, q: 8, t: 9, me: 3 }, _talent: 1_699_000_000_000,
  } } };
  const stored = JSON.stringify(old);
  const traces = { "1102": { rank: 4, at: 1_800_000_000_000, levels: { a: 6, e: 12, q: 15, t: 11 } } };
  const unlocks = { a: [3], e: 3, q: 3 };
  const view = applyStarRailTraces(readLegacyPanel(uid, old), traces);
  const file = panelExportFile(view, old, new Map([["1102", unlocks]]));
  expect(file.name).toBe(`${uid}.json`);
  expect(file.unresolved).toBe(2);
  const body = file.bytes.toString();
  expect(body).not.toContain(credential);
  expect(body).not.toContain(String(traces["1102"].at));
  const exported = JSON.parse(body);
  expect(exported).toMatchObject({ uid, _profile: old._profile, avatars: { "1102": {
    _talent: 1_699_000_000_000, talent: { a: 5, e: 10, q: 8, t: 9, me: 3 },
    weapon: { id: "23001", level: 80, affix: 1 },
  } } });
  const avatar = readLegacyPanel(uid, exported).avatars[0]!;
  expect(avatar.skills.slice(0, 2).map(skill => starRailLegacySkillLevel(skill.key, skill.level, avatar.rank!, unlocks[skill.key as "a" | "e"])))
    .toEqual([6, 12]);
  expect(JSON.stringify(old)).toBe(stored);

  const rankZero = { uid, avatars: { "1102": { ...old.avatars["1102"], cons: 0 } } };
  const rankZeroView = applyStarRailTraces(readLegacyPanel(uid, rankZero), { "1102": { ...traces["1102"], rank: 0 } });
  const rankZeroFile = panelExportFile(rankZeroView, rankZero);
  expect(JSON.parse(rankZeroFile.bytes.toString()).avatars["1102"].talent).toEqual({ a: 6, e: 12, q: 15, t: 11, me: 3 });
  expect(rankZeroFile.unresolved).toBe(0);
});

test("新版 v1 使用四项明确有效等级并保持原有面板字段、日期与文件名", () => {
  const snapshot = normalizePanel(uid, [{ id: 1102, level: 80, rank: 4,
    skills: [{ remake: "战技", level: 7 }, { remake: "忆灵技", level: 3 }],
  }], new Date("2025-01-01"));
  const at = 1_800_000_000_000;
  const view = applyStarRailTraces(snapshot, { "1102": { rank: 4, at, levels: { a: 6, e: 12, q: 15, t: 11 } } });
  const file = panelExportFile(view);
  expect(file.name).toBe(`${uid}.json`);
  const body = file.bytes.toString();
  const document = JSON.parse(body);
  expect(document.updatedAt).toBe(snapshot.updatedAt);
  expect(document.avatars[0].skills).toEqual([
    { key: "e", level: 12, icon: "" }, { key: "me", level: 3, icon: "" }, { key: "a", level: 6, icon: "" },
    { key: "q", level: 15, icon: "" }, { key: "t", level: 11, icon: "" },
  ]);
  expect(body).not.toMatch(/(?:accountId|owner|records|effective)/u);
  expect(body).not.toContain(String(at));
  expect(snapshot.avatars[0]?.skills[0]?.level).toBe(7);
});
