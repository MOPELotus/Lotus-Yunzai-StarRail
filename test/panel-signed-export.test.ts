import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatFile, ChatFileResult } from "../../../lib/chat-files.ts";
import { discardedStarRailPanel } from "../panel-discard.ts";
import { createStarRailSignedPanelExport } from "../panel-signed-export.ts";

const uid = "100000122";
const credential = "private-signature-fixture";
const oldPanel = {
  uid, name: credential, sign: credential, word: credential, cookie: credential,
  info: { stoken: credential, qq: "43" }, _profile: 1_700_000_000_000,
  avatars: { "1102": { id: "1102", level: 80, _source: "homo", secret: credential,
    talent: { a: 6, cookie: credential }, trees: ["101"],
    weapon: { id: "23001", level: 80, affix: 1, token: credential },
    artis: { "1": { id: "61011", level: 15, mainId: "1", attrIds: ["1,2,-1", credential] } },
  } },
};

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "lotus-starrail-signed-export-"));
  const legacyPanelDirectory = join(root, "PlayerData", "sr");
  const archiveDirectory = join(root, "panels");
  await Promise.all([mkdir(legacyPanelDirectory, { recursive: true }),
    ...["42", "43"].map(qq => mkdir(join(archiveDirectory, qq), { recursive: true }))]);
  const legacyFile = join(legacyPanelDirectory, `${uid}.json`);
  const ownFile = join(archiveDirectory, "42", `${uid}.json`);
  const otherFile = join(archiveDirectory, "43", `${uid}.json`);
  const bytes = JSON.stringify(oldPanel);
  await writeFile(legacyFile, bytes);
  const lifecycle = new AbortController();
  const request = new AbortController();
  const exports: ChatFile[] = [];
  const exportPanel = createStarRailSignedPanelExport(async () => { throw Error("签名导出不应写入档案"); },
    lifecycle.signal, { archiveDirectory, legacyPanelDirectory });
  const input = {
    qq: "42", uid, signal: request.signal, authorize: async (_uid: string) => true,
    uploadFile: async (file: ChatFile): Promise<ChatFileResult> => { exports.push(file); return "confirmed"; },
  };
  return { root, legacyFile, ownFile, otherFile, bytes, request, lifecycle, exports, exportPanel, input };
}

test("签名仅导出指定 UID 的旧星铁文件，不混入本人或其他 QQ 的档案、签名和登录信息", async () => {
  const t = await fixture();
  try {
    await writeFile(t.ownFile, JSON.stringify({ uid, avatars: [{ id: "1207", name: credential }], token: credential }));
    await writeFile(t.otherFile, JSON.stringify(discardedStarRailPanel(uid, 10)));
    const authorized: string[] = [];
    expect(await t.exportPanel({ ...t.input, authorize: async selected => { authorized.push(selected); return true; } }))
      .toContain("旧 PlayerData 格式");
    expect(authorized).toEqual([uid, uid, uid]);
    expect(t.exports).toHaveLength(1);
    const file = t.exports[0]!;
    expect(file.name).toBe(`${uid}.json`);
    const body = new TextDecoder().decode(file.bytes);
    expect(body).not.toContain(credential);
    expect(body).not.toContain("1207");
    expect(JSON.parse(body)).toEqual({ uid, _profile: oldPanel._profile, avatars: { "1102": {
      id: "1102", level: 80, _source: "homo", talent: { a: 6 }, trees: ["101"],
      weapon: { id: "23001", level: 80, affix: 1 }, artis: { "1": { id: "61011", level: 15, mainId: "1", attrIds: ["1,2,-1"] } },
    } } });
    expect(await readFile(t.legacyFile, "utf8")).toBe(t.bytes);
  } finally {
    await rm(t.root, { recursive: true, force: true });
  }
});

test("在途撤权、断线和历史删除都阻止签名文件发送", async () => {
  const t = await fixture();
  try {
    let checks = 0;
    expect(await t.exportPanel({ ...t.input, authorize: async () => ++checks < 3 })).toContain("已过期");
    checks = 0;
    expect(await t.exportPanel({ ...t.input, authorize: async () => {
      if (++checks === 2) await writeFile(t.ownFile, JSON.stringify(discardedStarRailPanel(uid, 20)));
      return true;
    } })).toContain("已删除");
    expect(await t.exportPanel(t.input)).toContain("已删除");
    await writeFile(t.ownFile, JSON.stringify({ uid }));
    checks = 0;
    expect(await t.exportPanel({ ...t.input, authorize: async () => {
      if (++checks === 3) t.request.abort();
      return true;
    } })).toBeUndefined();
    expect(t.exports).toBeEmpty();
  } finally {
    await rm(t.root, { recursive: true, force: true });
  }
});

test("签名要求明确 UID，拒绝错号、跨目录软链接和未授权读取", async () => {
  const t = await fixture();
  try {
    let calls = 0;
    const authorize = async () => { calls++; return true; };
    expect(await t.exportPanel({ ...t.input, uid: "../gs/1", authorize })).toContain("明确");
    expect(calls).toBe(0);
    await writeFile(t.legacyFile, JSON.stringify({ ...oldPanel, uid: "123456789" }));
    expect(await t.exportPanel(t.input)).toContain("导出失败");
    expect(await t.exportPanel({ ...t.input, authorize: async () => false })).toContain("未通过");
    await truncate(t.legacyFile, 8 * 1024 * 1024 + 1);
    expect(await t.exportPanel(t.input)).toContain("导出失败");
    const another = join(t.root, "another-role.json");
    await writeFile(another, t.bytes);
    await rm(t.legacyFile);
    await symlink(another, t.legacyFile);
    expect(await t.exportPanel(t.input)).toContain("导出失败");
    expect(t.exports).toBeEmpty();
  } finally {
    await rm(t.root, { recursive: true, force: true });
  }
});
