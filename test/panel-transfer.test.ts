import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { lockFile } from "../../../lib/file-lock.ts";
import { createPanelTransferReceiver, createPanelTransferSource } from "../../../lib/panel-transfer.ts";
import { matchPanelTransferCommand, type TransferContext } from "../../../lib/panel-transfer-command.ts";
import { createStarRailPanelArchive, discardedStarRailPanel } from "../panel-discard.ts";
import { readLegacyPanel } from "../panel-model.ts";
import { createStarRailPanelTransfer } from "../panel-transfer.ts";
import { createStarRailPersonalPanelReader } from "../panel.ts";

const uid = "123450001";
const oldTime = 1_888_888_000_000;
const past = { id: 1102, level: 80, _source: "EnkaHSR", _time: oldTime, talent: { a: 6, e: 10, q: 10, t: 10 },
  trees: [1102101, 1102201], weapon: { id: 23001, level: 80, affix: 1 }, artis: {
    1: { id: 61011, level: 15, star: 5, mainId: 1, attrIds: ["1,2,-1", "private-cookie-value"] },
  } };

test("星铁旧数据合并后可从正常角色面板读取，回执不覆盖现档及已删除数据", async () => {
  const folder = await mkdtemp(join(tmpdir(), "lotus-starrail-panel-transfer-"));
  const controller = new AbortController();
  const signal = controller.signal;
  try {
    await writeFile(join(folder, "42-2.yaml"), Bun.YAML.stringify({
      user: { qq: "42" }, profile: { id: 2 },
      account: { cookie: "account_id=900000002;cookie_token=fixture;ltuid=900000002;ltoken=fixture", stuid: "900000002",
        stoken: "fixture", current_uid: { sr: uid }, game_roles: { sr: [{ uid, region: "prod_gf_cn", game_biz: "hkrpg_cn" }] } },
    }));
    const profiles = createProfileStore(folder);
    const raw = { uid, _profile: oldTime, avatars: {
      1102: past, 1103: { ...past, id: 1103 }, 1104: { ...past, id: 1104, _source: "change" },
    } };
    const legacy = readLegacyPanel(uid, raw);
    const origin = "https://panel-transfer.example.invalid";
    const source = createPanelTransferSource({ publicOrigin: origin, signal });
    const receive = createPanelTransferReceiver({ peers: [origin], async transport(url, init) {
      return source.serve(new Request(url, init))!;
    } });
    const sourceRoom = join(folder, "from");
    const destinationRoom = join(folder, "to");
    const emptyRoom = join(folder, "another");
    const exportPanel = createStarRailPanelTransfer(profiles, lockFile, signal, { archiveDirectory: sourceRoom,
      legacy: async () => ({ data: raw, snapshot: legacy }) });
    const importPanel = createStarRailPanelTransfer(profiles, lockFile, signal, { archiveDirectory: destinationRoom, legacy: async () => undefined });
    const newArchive = createStarRailPanelArchive(lockFile, destinationRoom);
    await newArchive.update({ qq: "42", uid }, async () => {}, () => ({
      document: { ...legacy, source: "miyoushe", avatars: [{ ...legacy.avatars[0], level: 65 }] }, result: undefined,
    }));
    let code = "";
    const ctx = { message_type: "private", privateCredentialSignal: signal, self_id: 99, user_id: 42,
      panelTransfer: { exportLevel: 1, importLevel: 1, source, receive },
      reply(message) { code = message.split(" ").at(-1)!; return true; },
    } satisfies TransferContext;
    const offer = matchPanelTransferCommand("*导出面板数据2")!;
    const command = () => matchPanelTransferCommand(`#星铁导入面板数据 ${code} 档案2`)!;
    expect(await exportPanel(offer, ctx)).toEqual([]);
    const claimed = await receive(code, { game: "sr", qq: "42", uid }, signal);
    if (claimed.state !== "ready") throw new Error("没有可领取面板。");
    expect(new TextDecoder().decode(claimed.bytes)).not.toContain("private-cookie-value");
    expect(await importPanel(command(), { ...ctx, self_id: 101 })).toContain("已导入 1 名星铁");
    const saved = await createStarRailPersonalPanelReader(lockFile, destinationRoom)("42", uid);
    expect(saved?.source).toBe("miyoushe");
    expect(saved?.avatars.map(row => [row.id, row.level])).toEqual([["1102", 65], ["1103", 80]]);
    expect(saved?.avatars[1]?.relics[0]).toMatchObject({ legacyMainId: "1", legacySubIds: ["1,2,-1"] });
    expect(saved?.avatars[1]?.legacy?.source).toBe("EnkaHSR");
    expect(await exportPanel(offer, ctx)).toEqual([]);
    const emptyReader = createStarRailPanelTransfer(profiles, lockFile, signal, { archiveDirectory: emptyRoom, legacy: async () => undefined });
    expect(await emptyReader(command(), ctx)).toContain("已导入 2 名星铁");
    expect((await createStarRailPersonalPanelReader(lockFile, emptyRoom)("42", uid))?.source).toBe("legacy");
    await newArchive.update({ qq: "42", uid }, async () => {}, () => ({
      document: discardedStarRailPanel(uid, oldTime + 8_000), result: undefined,
    }));
    expect(await exportPanel(offer, ctx)).toEqual([]);
    expect(await importPanel(command(), ctx)).toContain("早于本档案");
    expect(await createStarRailPersonalPanelReader(lockFile, destinationRoom)("42", uid)).toBeUndefined();
  } finally {
    controller.abort();
    await rm(folder, { recursive: true, force: true });
  }
});
