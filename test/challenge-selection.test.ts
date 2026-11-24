import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProfileStore } from "@lotus-yunzai/account";
import { parseChallengeQuery } from "../challenge-model.ts";
import { queryStarRailChallenge } from "../challenge.ts";

test("星铁战绩拒绝当前角色失配，读取途中修改选角也不投递", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-sr-challenge-selection-"));
  try {
    const profiles = createProfileStore(directory);
    const path = join(directory, "42-2.yaml");
    const write = (selected?: string) => writeFile(path, Bun.YAML.stringify({
      user: { qq: "42" }, profile: { id: 2 },
      account: { cookie: "fixture-cookie", stoken: "fixture-stoken", stuid: "42",
        current_uid: selected ? { sr: selected } : {},
        game_roles: { sr: [{ uid: "100000088", region: "prod_gf_cn" }, { uid: "100000099", region: "prod_gf_cn", is_chosen: true }] },
      },
    }));
    const query = parseChallengeQuery("*混沌2")!;
    const calls: string[] = [];
    const signal = new AbortController().signal;
    const client: Parameters<typeof queryStarRailChallenge>[3] = {
      async fetchStarRailChallenge(source) {
        calls.push(source.role.uid);
        await write("100000088");
        return { records: [], revision: source.revision, refreshedCookie: false };
      },
    };

    await write("100000077");
    expect(await queryStarRailChallenge("42", query, profiles, client, signal)).toContain("没有同步星铁 UID");
    expect(calls).toEqual([]);

    await write();
    expect(await queryStarRailChallenge("42", query, profiles, client, signal)).toBe("星铁档案已变更，请重新查询。");
    expect(calls).toEqual(["100000099"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("补齐同 UID 缺省国服标记后保留完整往期，无法合并转发时展示文字", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lotus-sr-challenge-region-"));
  try {
    const profiles = createProfileStore(directory);
    const uid = "100000099";
    const write = (region: string) => writeFile(join(directory, "42.yaml"), Bun.YAML.stringify({
      user: { qq: "42" }, profile: { id: 1 },
      account: { cookie: "fixture-cookie", stoken: "fixture-stoken", stuid: "42",
        current_uid: { sr: uid }, game_roles: { sr: [{ uid, region }] } },
    }));
    await write("");
    const periods = ["本期", "上期", "第三期", "第四期"];
    const reply = await queryStarRailChallenge("42", parseChallengeQuery("*往期仲裁")!, profiles, {
      async fetchStarRailChallenge() {
        await write("prod_gf_cn");
        const { revision } = await profiles.requestSelectedContext("42", 1, "sr");
        return { revision, refreshedCookie: true, records: [{ kind: "peak", schedule: "3", simple: true, data: {
          challenge_peak_records: periods.map(name => ({ group: { name_mi18n: name } })),
        } }] };
      },
    }, new AbortController().signal, undefined, undefined, false);
    expect(typeof reply).toBe("string");
    for (const period of periods) expect(reply).toContain(period);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
