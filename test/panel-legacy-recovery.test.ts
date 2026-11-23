import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore, ProfileError } from "@lotus-yunzai/account";
import { createProfileHoyoClient, HoyoRequestError } from "@lotus-yunzai/hoyo-client";
import { lockFile } from "../../../lib/file-lock.ts";
import type { LegacyPanelRecoveryOffer } from "../../../lib/legacy-panel-recovery-flow.ts";
import { createStarRailPanelArchive, discardedStarRailPanel } from "../panel-discard.ts";
import { parsePanelCommand } from "../panel-model.ts";
import { createStarRailPanel, managedSnapshot } from "../panel.ts";

const uid = "123450001", qq = "42";
const panel = { uid, avatars: {
  1102: { id: 1102, level: 80, _source: "EnkaHSR", talent: { a: 6 }, trees: [1102101], artis: {} },
  1103: { id: 1103, level: 80, _source: "customize", artis: {} },
} };
const update = parsePanelCommand("*更新面板")!;
const delivery = { type: "delivery", message: "确认恢复", onDelivered() {} } as const;
type Candidate = Parameters<LegacyPanelRecoveryOffer>[0];

async function setup(run: (root: string, profiles: ReturnType<typeof createProfileStore>) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "lotus-star-rail-panel-recovery-"));
  const original = Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
  Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = join(root, "legacy");
  try {
    await run(root, createProfileStore(root));
  } finally {
    if (original === undefined) delete Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR;
    else Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR = original;
    await rm(root, { recursive: true, force: true });
  }
}

test("首次恢复只在官方查询失败、原档为空并且本人私聊时询问，恢复会保留历史及普通读取格式", () => setup(async (root, profiles) => {
  const role = { uid, region: "prod_gf_cn", gameBiz: "hkrpg_cn", nickname: "", chosen: true };
  const source = { qq, profileId: 1, game: "sr", role, account: { cookie: "" }, revision: "fixture" } as Awaited<ReturnType<typeof profiles.requestContext>>;
  const bound = { ...profiles, requestContext: async () => source, savedRole: async () => role };
  let state: "unavailable" | "empty" | "changed" = "unavailable";
  let queried = 0;
  const client = { ...createProfileHoyoClient(bound), async fetchStarRailPanel() {
    queried++;
    if (state === "changed") throw new HoyoRequestError("profile-changed", "档案变更");
    if (state === "unavailable") throw new HoyoRequestError("http", "暂时离线", 503);
    return { revision: "fixture", refreshedCookie: false, avatars: [] };
  } };
  const archive = createStarRailPanelArchive(lockFile, join(root, "managed"));
  const command = createStarRailPanel(bound, client, lockFile, new AbortController().signal, undefined, join(root, "managed"));
  const candidates: Candidate[] = [];
  const ctx = { message_type: "private", user_id: 42, async offerLegacyPanelRecovery(candidate: Candidate) {
    expect(queried).toBeGreaterThan(0);
    candidates.push(candidate);
    return delivery;
  } };
  expect(await command(qq, update, { ...ctx, message_type: "group" })).not.toEqual(delivery);
  expect(await command(qq, update, { ...ctx, isDelegated: true })).not.toEqual(delivery);
  expect(candidates).toHaveLength(0);
  state = "changed";
  expect(await command(qq, update, ctx)).toContain("档案已变更");
  expect(candidates).toHaveLength(0);
  state = "empty";
  expect(await command(qq, update, ctx)).toEqual(delivery);
  const candidate = candidates[0]!;
  expect(candidate).toMatchObject({ game: "sr", profileId: 1, uid });
  expect(await candidate.isEmpty()).toBe(true);
  expect(await archive.read(qq, uid)).toBeNull();
  expect(await candidate.save(panel, async () => {})).toBe(1);
  const saved = managedSnapshot(uid, await archive.read(qq, uid))!;
  expect(saved.source).toBe("legacy");
  expect(saved.avatars.map(avatar => avatar.id)).toEqual(["1102"]);
  expect(saved.updatedAt).toBe(new Date(0).toISOString());
  expect(await command(qq, update, ctx)).not.toEqual(delivery);
  expect(await candidate.save(panel, async () => {})).toBeUndefined();
}));

test("未登录需本地已有相同选档，旧本机档、删档及授权失效均阻止首拉写入", () => setup(async (root, profiles) => {
  const role = { uid, region: "prod_gf_cn", gameBiz: "hkrpg_cn", nickname: "", chosen: true };
  const bound = { ...profiles, requestContext: async () => { throw new ProfileError("login-required", "未登录"); },
    savedRole: async () => role };
  const client = { ...createProfileHoyoClient(bound), async fetchStarRailPanel() { throw new Error("不应调用官服"); } };
  const archive = createStarRailPanelArchive(lockFile, join(root, "managed"));
  const command = createStarRailPanel(bound, client, lockFile, new AbortController().signal, undefined, join(root, "managed"));
  const candidates: Candidate[] = [];
  const context = { message_type: "private", user_id: 42, async offerLegacyPanelRecovery(candidate: Candidate) {
    candidates.push(candidate);
    return delivery;
  } };
  expect(await command(qq, parsePanelCommand("*更新面板 123450002")!, context)).toContain("不一致");
  expect(await command(qq, update, context)).toEqual(delivery);
  const candidate = candidates[0]!;
  const verify = async () => { throw new ProfileError("changed", "本人确认已失效"); };
  await expect(candidate.save(panel, verify)).rejects.toThrow("本人确认已失效");
  expect(await archive.read(qq, uid)).toBeNull();
  const oldFolder = join(root, "legacy");
  await mkdir(oldFolder);
  await writeFile(join(oldFolder, uid + ".json"), JSON.stringify(panel));
  expect(await candidate.save(panel, async () => {})).toBeUndefined();
  expect(await command(qq, update, context)).not.toEqual(delivery);
  await rm(oldFolder, { recursive: true });
  let verifications = 0;
  expect(await candidate.save(panel, async () => {
    if (++verifications === 2) await archive.update({ qq, uid }, async () => {}, () => ({
      document: discardedStarRailPanel(uid, 1), result: undefined,
    }));
  })).toBeUndefined();
  expect(await command(qq, update, context)).not.toEqual(delivery);
  expect(managedSnapshot(uid, await archive.read(qq, uid))?.avatars).toEqual([]);
  expect(candidates).toHaveLength(1);
}));

test("官方成功写入优先于旧档确认，不触发补回提示", () => setup(async (root, profiles) => {
  const role = { uid, region: "prod_gf_cn", gameBiz: "hkrpg_cn", nickname: "", chosen: true };
  const source = { qq, profileId: 1, game: "sr", role, account: { cookie: "" }, revision: "fixture" } as Awaited<ReturnType<typeof profiles.requestContext>>;
  const bound = { ...profiles, requestContext: async () => source, savedRole: async () => role };
  const client = { ...createProfileHoyoClient(bound), async fetchStarRailPanel() {
    return { revision: "fixture", refreshedCookie: false, avatars: [{ id: 1102, level: 70, name: "合成角色" }] };
  } };
  const lifecycle = new AbortController();
  const archive = createStarRailPanelArchive(lockFile, join(root, "managed"));
  const command = createStarRailPanel(bound, client, async (file, subject) => {
    const lock = await lockFile(file, subject);
    return { close() {
      lock.close();
      // This regression covers archival writes without invoking image rendering.
      lifecycle.abort();
    } };
  }, lifecycle.signal, undefined, join(root, "managed"));
  let offers = 0;
  await command(qq, update, { message_type: "private", user_id: 42, async offerLegacyPanelRecovery() {
    offers++;
    return delivery;
  } });
  expect(offers).toBe(0);
  const saved = managedSnapshot(uid, await archive.read(qq, uid));
  expect(saved?.source).toBe("miyoushe");
  expect(saved?.avatars[0]).toMatchObject({ id: "1102", level: 70 });
}));
