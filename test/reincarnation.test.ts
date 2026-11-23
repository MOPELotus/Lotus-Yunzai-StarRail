import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockFile } from "../../../lib/file-lock.ts";
import type { renderWarpReincarnation } from "../simulation/card.ts";
import { createStarRailSimulation } from "../simulation/commands.ts";
import { readWarpAvatar, readWarpIdentityCatalog } from "../simulation/reincarnation.ts";

test("the two fixed identity groups keep their bios and stop delegated attempts before avatar or state access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-warp-identity-test-"));
  try {
    await mkdir(join(directory, "yaml"));
    await writeFile(join(directory, "yaml/identity.yaml"), "- name: 阮•梅\n  desc: 测试身份长句\n");
    await writeFile(join(directory, "yaml/other.yaml"), "- name: 阿基维利\n  allegiance: 星神\n  weapon: 开拓\n  desc: 测试星神小传\n");
    await writeFile(join(directory, "yaml/color.yaml"), '冰: "#48C0F8"\n');
    const catalog = await readWarpIdentityCatalog(directory);
    expect(catalog).toMatchObject({
      characters: [{ name: "阮•梅", description: "测试身份长句" }],
      others: [{ name: "阿基维利", description: "测试星神小传", path: "开拓", allegiance: "星神" }],
      colors: { 冰: "#48C0F8" },
    });
    let roll = 0;
    const avatars: string[] = [];
    const rendered: unknown[] = [];
    const run = createStarRailSimulation({ directory: join(directory, "state"), lockFile, signal: new AbortController().signal,
      random: () => roll, readIdentityCatalog: async () => catalog, loadAvatar: async qq => {
        avatars.push(qq);
        return new Uint8Array([1, 2, 3]);
      },
      renderReincarnation: async input => { rendered.push(input); throw new Error("fixture text fallback"); },
    });
    expect(await run("#星铁转生", { user_id: 52, isDelegated: true })).toContain("自己的会话");
    expect(avatars).toEqual([]);
    expect(await run("#星铁转生", { user_id: 52, sender: { user_id: 99, nickname: "开拓者甲" } }))
      .toContain("阿基维利 · 开拓。\n身份：测试星神小传");
    expect(await Bun.file(join(directory, "state/52/1.json")).exists()).toBeFalse();
    expect(await run("#星铁转生", { user_id: 52 })).toContain("测试星神小传");
    expect(avatars).toEqual(["52", "52"]);
    roll = 0.75;
    expect(await run("#星铁转生", { user_id: 53 })).toContain("阮•梅。\n身份：测试身份长句");
    expect(avatars).toEqual(["52", "52", "53"]);
    expect(rendered).toMatchObject([
      { name: "阿基维利", qq: "52", nickname: "开拓者甲", avatar: new Uint8Array([1, 2, 3]), allegiance: "星神" },
      { name: "阿基维利", qq: "52", nickname: "开拓者" },
      { name: "阮•梅", qq: "53", description: "测试身份长句" },
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the QQ avatar request is bounded and tied to the authenticated numeric ID", async () => {
  const signal = new AbortController().signal;
  const pngHeaders = { "Content-Type": "image/png" };
  expect(await readWarpAvatar("../wrong", signal, async () => { throw new Error("must not call fetch"); })).toBeUndefined();
  expect(await readWarpAvatar("52", signal, async (url, init) => {
    expect(url.href).toBe("https://q2.qlogo.cn/headimg_dl?dst_uin=52&spec=5");
    expect(init).toMatchObject({ redirect: "error", credentials: "omit" });
    return new Response(new Uint8Array([1, 2, 3]), { headers: pngHeaders });
  })).toEqual(Buffer.from([1, 2, 3]));
  expect(await readWarpAvatar("52", signal, async () => new Response(new Uint8Array(512 * 1024 + 1), { headers: pngHeaders })))
    .toBeUndefined();
  expect(await readWarpAvatar("52", signal, async () => new Response("not an image"))).toBeUndefined();
});

const replyImage = { png: Buffer.from("test-image") } as Awaited<ReturnType<typeof renderWarpReincarnation>>;

test("same QQ attempts serialize through rendering and only successful rendering persists cooldown", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-warp-relife-lock-"));
  try {
    let time = Date.parse("2026-11-24T10:00:00+08:00");
    let renderCalls = 0;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const make = () => createStarRailSimulation({ directory, lockFile, signal: new AbortController().signal,
      now: () => time, random: () => 0, loadAvatar: async () => undefined,
      renderReincarnation: async () => {
        if (++renderCalls === 1) {
          entered.resolve();
          await release.promise;
        }
        return replyImage;
      },
    });
    const user = { user_id: 52 };
    const first = make()("#星铁转生", user);
    await entered.promise;
    const second = make()("#星铁转生", user);
    try {
      // A wallet command for the same QQ can commit while the rendering is pending.
      expect(await make()("#星铁我的票", user)).toContain("100 张星轨专票");
      const interim = JSON.parse(await readFile(join(directory, "52/1.json"), "utf8"));
      expect(interim.reincarnatedUntil).toBeUndefined();
      expect(renderCalls).toBe(1);
      time += 75_000;
    } finally {
      release.resolve();
    }
    expect(await first).toMatchObject({ type: "image" });
    expect(await second).toContain("等待 120 分钟");
    const saved = JSON.parse(await readFile(join(directory, "52/1.json"), "utf8"));
    expect(saved.reincarnatedUntil).toBe(time + 120 * 60_000);
    expect(saved.balance).toMatchObject({ special: 100, regular: 10 });
    expect(await make()("#星铁转生", { ...user, isMaster: true, isBotMaster: () => false })).toContain("等待 120 分钟");
    expect(await make()("#星铁转生", { ...user, isMaster: true, isBotMaster: qq => qq === 52 })).toMatchObject({ type: "image" });
    expect(renderCalls).toBe(2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("aborting a render leaves the account unchanged and releases the lock for a new command instance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-warp-relife-abort-"));
  try {
    const interrupted = new AbortController();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const base = { directory, lockFile, random: () => 0, loadAvatar: async () => undefined };
    const run = createStarRailSimulation({ ...base, signal: interrupted.signal, renderReincarnation: async () => {
      entered.resolve();
      await release.promise;
      return replyImage;
    } });
    const user = { user_id: 52 };
    const pending = run("#星铁转生", user);
    await entered.promise;
    interrupted.abort();
    release.resolve();
    expect(await pending).toBeUndefined();
    expect(await Bun.file(join(directory, "52/1.json")).exists()).toBeFalse();
    const replacement = createStarRailSimulation({ ...base, signal: new AbortController().signal, renderReincarnation: async () => replyImage });
    expect(await replacement("#星铁转生", user)).toMatchObject({ type: "image" });
    expect(await replacement("#星铁转生", user)).toContain("等待 120 分钟");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
