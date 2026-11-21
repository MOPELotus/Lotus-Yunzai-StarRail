import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import type { ChatFile, ChatFileResult } from "../../../lib/chat-files.ts";
import { normalizePanel, parsePanelCommand } from "../panel-model.ts";
import { panelExportFile } from "../panel-file.ts";
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
