import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { lockFile } from "../../../lib/file-lock.ts";
import { panelGameSettings } from "../../../lib/panel-game-settings.ts";
import { createModule } from "../index.ts";
import { matchStarRailShowcaseSettings, runStarRailShowcaseSettings } from "../panel-showcase-command.ts";

const active = new AbortController().signal;
const privateOwner = { canManagePackages: true, self_id: 10001, user_id: 10002, message_type: "private", privateCredentialSignal: active } as const;
const command = (input: string) => matchStarRailShowcaseSettings(input)!;

async function fixture(run: (root: URL, path: URL) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "lotus-sr-showcase-command-"));
  const root = pathToFileURL(`${directory}/`);
  const config = new URL("config/global.yaml", root);
  const previous = Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER;
  delete Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER;
  try {
    await mkdir(new URL("config/", root));
    await writeFile(config, "shared: &shared\n  grid_fight_recent_count: 2\nstarrail: *shared\nother: preserve # retained\n");
    await run(root, config);
  } finally {
    if (previous === undefined) delete Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER;
    else Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

test("restores the legacy names through the StarRail module fallback", async () => {
  const module = createModule({ signal: active, lockFile });
  const reply = async () => {};
  for (const normalizedMessage of ["*API列表", "#星铁api列表", "#星铁切换面板API3", "#星铁切换面板3", "#星铁设置面板API EnkaHSR", "#星铁切换面板来源 034"]) {
    expect(await module.fallbackFeatures({ normalizedMessage, reply })).toEqual(["[starrail] 角色面板"]);
    expect(await module.fallback(normalizedMessage, { normalizedMessage, reply })).toContain("仅限机器人主人");
  }
  expect(matchStarRailShowcaseSettings("#切换面板API EnkaHSR")).toBeUndefined();
  expect(matchStarRailShowcaseSettings("#星铁更新面板")).toBeUndefined();
});

test("chat changes use the same public source settings and preserve other YAML", async () => fixture(async (root, path) => {
  const groupOwner = { ...privateOwner, message_type: "group", group_id: 10003, groupActivitySignal: active } as const;
  expect(await runStarRailShowcaseSettings(command("*切换面板API Avocado"), groupOwner, active, root)).toContain("国际服：Avocado");
  expect(await runStarRailShowcaseSettings(command("#星铁切换面板来源 034"), privateOwner, active, root)).toContain("国际服：EnkaHSR");
  const status = await runStarRailShowcaseSettings(command("*API列表"), privateOwner, active, root);
  expect(status).toContain("官服：Mihomo\n渠道服：Avocado\n国际服：EnkaHSR");
  const stored = await readFile(path, "utf8");
  expect(stored).toContain("other: preserve # retained");
  expect(Bun.YAML.parse(stored)).toMatchObject({ shared: { grid_fight_recent_count: 2 },
    starrail: { grid_fight_recent_count: 2, showcase_server: "034" } });
  const web = panelGameSettings(root, "showcase");
  const request = (body?: unknown) => new Request("http://localhost/api/settings/showcase", body ? {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  const read = await web(request(), () => true);
  expect(read.status).toBe(200);
  const { values } = await read.json();
  expect(values.starrailSource).toBe("034");
  const changed = await web(request({ previous: values, values: { ...values, starrailSource: "42" } }), () => true);
  expect(changed.status).toBe(200);
  expect(await runStarRailShowcaseSettings(command("*API列表"), privateOwner, active, root)).toContain("官服：EnkaHSR\n渠道服：Mihomo\n国际服：EnkaHSR");
}));

test("rejects stale transport, delegated actors, old indexes, custom endpoints and deployment overrides", async () => fixture(async (root, path) => {
  const before = await readFile(path, "utf8");
  const valid = command("*切换面板API EnkaHSR");
  for (const context of [
    { ...privateOwner, canManagePackages: undefined }, { ...privateOwner, isDelegated: true },
    { ...privateOwner, privateCredentialSignal: AbortSignal.abort() }, { ...privateOwner, user_id: undefined },
    { ...privateOwner, message_type: "group" as const, group_id: 10003 },
  ]) {
    expect(await runStarRailShowcaseSettings(valid, context, active, root)).toContain("仅限机器人主人");
  }
  for (const input of ["*切换面板API 1", "*切换面板API 2", "*切换面板API 3"]) {
    expect(await runStarRailShowcaseSettings(command(input), privateOwner, active, root)).toContain("旧 API 编号");
  }
  for (const input of ["*切换面板API https://lulu.roki.best/v1/info/", "*切换面板来源 131"]) {
    expect(await runStarRailShowcaseSettings(command(input), privateOwner, active, root)).toContain("可发送");
  }
  Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER = "4";
  expect(await runStarRailShowcaseSettings(command("*API列表"), privateOwner, active, root)).toContain("来源由部署环境变量指定");
  expect(await runStarRailShowcaseSettings(valid, privateOwner, active, root)).toContain("由部署环境变量指定");
  expect(await readFile(path, "utf8")).toBe(before);
}));
