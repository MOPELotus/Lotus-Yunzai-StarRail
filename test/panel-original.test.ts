import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createProfileStore } from "@lotus-yunzai/account";
import { createStarRailPanelOriginals, starRailOriginalCommand } from "../panel-original.ts";
import { starRailTraceOwner } from "../panel-trace-refresh.ts";

test("星铁引用原图按已确认消息、会话和本人档案验证，并保留旧配置与一小时有效期", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-sr-panel-receipt-"));
  const root = pathToFileURL(directory + "/");
  const lifecycle = new AbortController(), session = new AbortController();
  const photo = { root: "gallery", path: ["希儿", "原图.png"], sha256: "a".repeat(64) } as const;
  const contents = new Uint8Array([1, 2, 3]);
  const uid = "100000122";
  const profiles = createProfileStore(directory);
  const config = join(directory, "backup", "plugins", "StarRail-plugin", "config", "PanelSetting.yaml");
  const profile = (id: string) => `version: 1
user: { qq: '42' }
profile: { id: 2 }
account:
  ltuid: '${id}'
  stuid: '${id}'
  stoken: fixture-token
  stoken_cookie: 'stuid=${id}; stoken=fixture-token'
  cookie: 'account_id=${id}; cookie_token=fixture-cookie'
  game_roles: { sr: [{ uid: '${uid}', region: prod_gf_cn, game_biz: hkrpg_cn }] }
  current_uid: { sr: '${uid}' }
`;
  const records = new Map<string, string>();
  let now = 20_000, reads = 0;
  const options = { root, now: () => now, async readPicture() { reads++; return contents; }, storage: {
    async get(key: string) { return records.get(key); },
    async set(key: string, raw: string, seconds: number) { expect(seconds).toBe(3600); records.set(key, raw); },
  } };
  const message = [{ type: "reply", id: "16" }] as const;
  const context = { adapter: "onebot", self_id: 99, user_id: 42, group_id: 77, message_type: "group", message,
    groupOriginalSignal: session.signal, reply_id: "16", async lookupReply() {
      return { user_id: 99, message: [{ type: "image", url: "https://example.invalid/receipt" }] } as const;
    } } as const;
  try {
    expect(starRailOriginalCommand("#原图")).toBe("shared");
    expect(starRailOriginalCommand("*原图")).toBe("explicit");
    expect(starRailOriginalCommand("#星铁原图")).toBe("explicit");
    expect(starRailOriginalCommand("#原神原图")).toBeUndefined();
    const profileFile = join(directory, "42-2.yaml");
    await writeFile(profileFile, profile("12"));
    const receipt = () => createStarRailPanelOriginals(profiles, lifecycle.signal, options);
    const panel = receipt();
    const account = await profiles.requestContext("42", 2, "sr");
    const owner = starRailTraceOwner(account, account.role)!;
    expect(await panel.reply(context)).toBeUndefined();
    await panel.delivered(context, 16, { ...owner, profileId: 2 }, photo);
    expect(await panel.reply({ ...context, user_id: 43 })).toBeUndefined();
    expect(await panel.reply({ ...context, group_id: 78 })).toBeUndefined();
    expect(await panel.reply({ ...context, self_id: 98 })).toBeUndefined();
    expect(await panel.reply({ ...context, adapter: "milky" })).toBeUndefined();
    expect(await panel.reply({ ...context, lookupReply: async () => ({ ...await context.lookupReply(), user_id: 42 }) })).toBeUndefined();
    expect(reads).toBe(0);
    const freshProcess = receipt();
    expect(await freshProcess.reply(context)).toEqual({ type: "recallable", seconds: 30, message: { type: "image", file: contents } });
    await mkdir(dirname(config), { recursive: true });
    await writeFile(config, "originalPic: false\nbackCalloriginalPic: false\n");
    expect(await panel.reply(context)).toContain("功能已关闭");
    const master = { ...context, isBotMaster: (user: number) => user === 42 };
    expect(await panel.reply(master)).toEqual({ type: "image", file: contents });
    expect(await panel.reply({ ...master, inlineImageByteLimit: 1 })).toContain("超过");
    const modern = join(directory, "config/global.yaml");
    await mkdir(dirname(modern));
    await writeFile(modern, "starrail: { original_pic: true, back_call_original_pic: true, back_call_original_pic_time: 0 }\n");
    expect(await panel.reply(context)).toEqual({ type: "image", file: contents });
    await writeFile(modern, "starrail: { original_pic: true, back_call_original_pic: true, back_call_original_pic_time: 15 }\n");
    expect(await panel.reply(context)).toEqual({ type: "recallable", seconds: 15, message: { type: "image", file: contents } });
    await writeFile(modern, "starrail: { original_pic: true, back_call_original_pic: false, back_call_original_pic_time: 15 }\n");
    expect(await panel.reply(context)).toEqual({ type: "image", file: contents });
    await writeFile(modern, "starrail: { original_pic: false }\n");
    expect(await panel.reply(context)).toContain("功能已关闭");
    expect(await panel.reply(master)).toEqual({ type: "image", file: contents });
    await writeFile(profileFile, profile("13"));
    expect(await panel.reply(master)).toBeUndefined();
    await writeFile(profileFile, profile("12"));
    now += 3_600_001;
    expect(await panel.reply(master)).toBeUndefined();
    session.abort();
    expect(await panel.reply(master)).toBeUndefined();
  } finally {
    lifecycle.abort();
    await rm(directory, { force: true, recursive: true });
  }
});
