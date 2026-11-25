import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { parsePanelCommand } from "../panel-model.ts";
import { createStarRailPanel } from "../panel.ts";

test("星铁只读面板使用同一已绑定档案，更新仍需要登录", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-starrail-saved-role-"));
  try {
    for (const [file, slot, uid] of [["42.yaml", 1, "100000121"], ["42-2.yaml", 2, "100000122"]] as const) {
      await writeFile(join(directory, file), `version: 1
user: { qq: "42" }
profile: { id: ${slot} }
account:
  game_roles: { sr: [{ uid: "${uid}", region: prod_gf_cn, game_biz: hkrpg_cn }] }
  current_uid: { sr: "${uid}" }
`);
    }
    const profiles = createProfileStore(directory);
    let requests = 0, writes = 0;
    const client = createProfileHoyoClient(profiles, async () => {
      requests++;
      throw new Error("只读档案发起了远程请求");
    });
    const panel = createStarRailPanel(profiles, client, async () => {
      writes++;
      throw new Error("只读档案获取了写锁");
    }, new AbortController().signal);

    expect(await panel("42", parsePanelCommand("*100000122星神★阿哈面板")!)).toContain("与所选档案当前绑定的星铁角色不一致");
    expect(await panel("42", parsePanelCommand("*100000121星神★阿哈面板 2")!)).toContain("与所选档案当前绑定的星铁角色不一致");
    expect(await panel("42", parsePanelCommand("*更新面板2")!)).toContain("请先登录档案 2");
    expect(requests).toBe(0);
    expect(writes).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
