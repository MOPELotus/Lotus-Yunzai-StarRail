import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ProfileRequestContext } from "@lotus-yunzai/account";
import { createStarRailGridFightQuery } from "../grid-fight-command.ts";
import { readGridFightRecentCount } from "../grid-fight-config.ts";
import { gridFightStats, gridFightText, makeGridFightCard, parseStarRailGridFight } from "../grid-fight-model.ts";

const brief = { season_level: "12", weekly_score_cur: 800, weekly_score_max: 1000, handbook_progress: "66.2",
  trait_progress: 52, quest_cur: 6, quest_max: 10, division: { level: 5, name_with_num: "部门主管" } };
const record = { archive_type: "ArchiveTypeHard", brief: { division: { level: 4, name: "见习职员" },
  archive_time_ts: "1795291200", archive_rank: "GridFightArchiveRankSS", remain_hp: 0, total_coin: 160, lineup_coin: 120 },
  lineup: {
    front_roles: [{ role_id: 1220, name: "飞霄", star: "2", is_trial: true, rarity: 5,
      icon: "https://fastcdn.mihoyo.com/static-role.webp?private=ignored",
      equip_list: [{ name: "光锥甲" }, { name: "光锥乙" }, { name: "光锥丙" }, { name: "第四件" }] }],
    back_roles: [{ role_id: 1303, name: "阮梅" }],
    trait_list: [{ trait_id: 1220, trait_name: "巡猎", quality: "2", trait_count: "4" }],
    portal_list: [{ id: 4, name: "信用市场" }],
    augment_list: [{ augment_id: 1220, name: "利滚利" }],
    damage_list: [
      { id: 1220, damage: "29000.2", damage_type: "DamageTypeTrait" },
      { id: 1220, damage: "100000", damage_type: "DamageTypeRole" },
      { id: 1220, damage: "659", damage_type: "DamageTypeAugment" },
      { id: 99, damage: "42", damage_type: "Unrecognized" },
      { id: 77, damage: -1, damage_type: "DamageTypeRole" },
    ],
  } };

const source: ProfileRequestContext = {
  qq: "42", profileId: 2, revision: "grid-fixture", game: "sr",
  role: { uid: "500000123", region: "prod_qd_cn", gameBiz: "hkrpg_cn", nickname: "合成开拓者", chosen: true },
  account: { cookie: "cookie_token=fixture-cookie", stoken: "", stuid: "", stokenCookie: "", ltuid: "", ltoken: "", mid: "" },
  device: { id: "device-2", fp: "fingerprint-2", name: "fixture", model: "Android", androidVersion: "13", raw: {} },
};

test("supports old grid-fight handles and keeps record ordinals separate from saved profiles", () => {
  for (const command of ["*货币战争", "#星铁货币战争", "星铁货币战争", "星轨货币", "＊币战"])
    expect(parseStarRailGridFight(command)).toEqual({ mode: "overview", profileId: 1 });
  for (const command of ["#货币战争", "货币战争", "##货币战争"])
    expect(parseStarRailGridFight(command)).toEqual({ mode: "recent", profileId: 1 });
  expect(parseStarRailGridFight("#货币战争 档案2")).toEqual({ mode: "recent", profileId: 2 });
  for (const title of ["战绩", "回顾", "战报", "记录"])
    expect(parseStarRailGridFight(`#星穹铁道币战${title}2 3`)).toEqual({ mode: "detail", index: 2, profileId: 3 });
  expect(parseStarRailGridFight("*币战记录 档案2")).toEqual({ mode: "detail", index: 1, profileId: 2 });
  expect(parseStarRailGridFight("*币战记录10档案2")).toEqual({ mode: "detail", index: 10, profileId: 2 });
  expect(parseStarRailGridFight("*货币战争2")).toEqual({ mode: "overview", profileId: 2 });
  for (const command of ["*币战记录500000123", "*币战记录201", "*抽卡记录", "*货币战争图鉴", "*货币战争 队伍"])
    expect(parseStarRailGridFight(command)).toBeUndefined();
});

test("uses original battle counts and matches role, trait and strategy damage by both kind and ID", () => {
  const model = makeGridFightCard("500000123", brief, [{}, record], 2);
  expect([model.index, model.historyCount, model.season, model.division.level]).toEqual([2, 2, 12, 4]);
  expect(gridFightStats(model).progress.map(row => row[1])).toEqual(["66.2%", "52%", "6/10"]);
  expect(model.battle).toMatchObject({ mode: "超频博弈", rank: "SS", health: 0, coin: 160, value: 120 });
  expect(model.battle?.front[0]).toMatchObject({ icon: "https://fastcdn.mihoyo.com/static-role.webp", stars: 2, trial: true });
  expect(model.battle?.front[0]?.equipment.map(item => item.name)).toEqual(["光锥甲", "光锥乙", "光锥丙"]);
  expect(model.battle?.damage.map(hit => [hit.entity.name, hit.label, hit.ratio])).toEqual([
    ["飞霄", "10.0万", 1], ["巡猎", "2.9万", 0.290002], ["利滚利", "659", 0.00659], ["未知伤害来源", "42", 0.00042],
  ]);
  expect(gridFightText(model)).toContain("小队生命值 0");
  expect(gridFightText(model)).toContain("羁绊 巡猎");
  expect(gridFightText(makeGridFightCard("500000123", { season_level: 0 }, []))).toContain("晋升等级 0");
});

test("preserves the two unprefixed overview entries in official order with complete battle information", () => {
  const second = { ...record, archive_type: "ArchiveTypePromotion", brief: { ...record.brief, archive_time: "2026-11-22 08:00", remain_hp: 27 } };
  const third = { ...record, brief: { ...record.brief, remain_hp: 30 } };
  const model = makeGridFightCard("500000123", brief, [record, second, third], undefined, 2);
  expect(model.recent?.map(({ ordinal, battle }) => [ordinal, battle.health, battle.mode])).toEqual([
    [1, 0, "超频博弈"], [2, 27, "标准博弈"],
  ]);
  expect(model.recent?.[0]?.battle.front[0]?.equipment.map(item => item.name)).toEqual(["光锥甲", "光锥乙", "光锥丙", "第四件"]);
  expect(model.recent?.[0]?.battle.damage.slice(0, 2).map(hit => [hit.entity.name, hit.label])).toEqual([
    ["巡猎", "2.90万"], ["飞霄", "10.00万"],
  ]);
  expect(gridFightStats(model).header).toEqual([["晋升等级", "12级"], ["货币积分", "800/1000"]]);
  expect(gridFightText(model)).toContain("战绩 1");
  expect(gridFightText(model)).toContain("战绩 2");
  expect(gridFightText(model)).not.toContain("小队生命值 30");
  expect(makeGridFightCard("500000123", brief, [{}, record, third], undefined, 2).recent?.map(row => row.ordinal)).toEqual([2]);
});

test("does not query delegated or mentioned users and refuses to deliver after changing the selected role", async () => {
  const actor = { user_id: 42, self_id: 99, message_type: "group" };
  const query = parseStarRailGridFight("*币战战报1 档案2")!;
  let active = source, requests = 0, changeWhenDrawing = false;
  const get = createStarRailGridFightQuery({ requestSelectedContext: async (qq, id, game) => {
    expect([qq, id, game]).toEqual(["42", 2, "sr"]);
    return active;
  } }, { fetchStarRailGridFight: async current => {
    expect(current).toBe(source);
    requests++;
    return { brief, records: [record], revision: source.revision, refreshedCookie: false };
  } }, new AbortController().signal, { draw: async () => {
    if (changeWhenDrawing) active = { ...source, role: { ...source.role, uid: "500000124" } };
    throw new Error("image unavailable in unit test");
  } });
  expect(await get({ ...actor, at: 77 }, query)).toContain("本人");
  expect(await get({ ...actor, isDelegated: true }, query)).toContain("本人");
  expect(await get({ ...actor, privateCredentialSignal: AbortSignal.abort() }, query)).toEqual([]);
  expect(requests).toBe(0);
  expect(await get({ ...actor, at: 99 }, query)).toContain("伤害");
  changeWhenDrawing = true;
  expect(await get(actor, query)).toContain("档案已变更");
  expect(requests).toBe(2);
});

test("rereads the legacy count without restart and gives the modern count precedence", async () => {
  const folder = await mkdtemp(join(tmpdir(), "lotus-grid-config-"));
  const root = pathToFileURL(folder + "/");
  const old = join(folder, "plugins/xhh/config");
  const modern = join(folder, "config");
  try {
    await mkdir(old, { recursive: true });
    await mkdir(modern, { recursive: true });
    expect(await readGridFightRecentCount(root)).toBe(2);
    for (const [value, expected] of [["1", 1], ["3", 3], ['"3"', 3], ["0", 2], ["4", 2], ["2.5", 2], ["true", 2], ["[3]", 2]] as const) {
      await writeFile(join(old, "config.yaml"), `huobi_num: ${value}\nunrelated: undisplayed\n`);
      expect(await readGridFightRecentCount(root)).toBe(expected);
    }
    await writeFile(join(old, "config.yaml"), "huobi_num: 3\n");
    await writeFile(join(modern, "global.yaml"), "starrail:\n  grid_fight_recent_count: 1\n");
    expect(await readGridFightRecentCount(root)).toBe(1);
    await writeFile(join(modern, "global.yaml"), "starrail:\n  showcase_server: 1\n");
    expect(await readGridFightRecentCount(root)).toBe(3);
    await writeFile(join(modern, "global.yaml"), "starrail:\n  grid_fight_recent_count: broken\n");
    expect(await readGridFightRecentCount(root)).toBe(2);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("only the unprefixed overview consults settings and every oversized record survives in original order", async () => {
  const actor = { user_id: 42, self_id: 99, message_type: "private", inlineImageByteLimit: 10 };
  let configReads = 0, requests = 0;
  const rendered: number[][] = [];
  const get = createStarRailGridFightQuery({ requestSelectedContext: async () => source },
    { fetchStarRailGridFight: async () => {
      requests++;
      return { brief, records: [record, record, record], revision: source.revision, refreshedCookie: false };
    } }, new AbortController().signal, { recentCount: async () => { configReads++; return 3; },
      draw: async (card, _theme, _signal, options) => {
        expect(options?.inlineImageByteLimit).toBe(10);
        const ordinals = card.recent?.map(entry => entry.ordinal) ?? [card.index ?? 0];
        rendered.push(ordinals);
        return { png: Buffer.alloc(ordinals.length > 1 || ordinals[0] === 2 ? 11 : 6, ordinals[0]) };
      },
    });
  expect(await get(actor, parseStarRailGridFight("*货币战争2")!)).toEqual({ type: "image", file: Buffer.alloc(6) });
  expect(configReads).toBe(0);
  const grouped = await get(actor, parseStarRailGridFight("#货币战争2")!);
  expect(grouped).toMatchObject({ type: "forward", batchSize: 1, nodes: [
    { type: "image", file: Buffer.alloc(6, 1) }, expect.stringContaining("战绩 2"),
    { type: "image", file: Buffer.alloc(6, 3) },
  ] });
  expect(rendered).toEqual([[0], [1, 2, 3], [1], [2], [3]]);
  expect(configReads).toBe(1);
  expect(requests).toBe(2);
});


test("upstream archive damage resolves avatar aliases and portal IDs without crossing entity types", () => {
  const fixture = { ...record, lineup: {
    front_roles: [{ role_id: "140802", avatar_id: "1408", name: "角色甲", icon: "https://fastcdn.mihoyo.com/role-a.png" }],
    back_roles: [{ role_id: "1408", avatar_id: "1303", name: "角色乙" }],
    trait_list: [{ trait_id: "2207", trait_name: "羁绊甲" }],
    augment_list: [{ augment_id: "2207", name: "策略甲" }],
    portal_list: [{ portal_id: "2207", name: "持续伤害概念股", icon: "https://fastcdn.mihoyo.com/portal.png" }],
    damage_list: [
      { id: "140802", damage: "13599683647.8", damage_type: "DamageTypeRole" },
      { id: "1303", damage: "186368000.0", damage_type: "DamageTypeRole" },
      { id: "2207", damage: "100000000.0", damage_type: "DamageTypePortal" },
      { id: "2207", damage: "69888000.0", damage_type: "DamageTypeTrait" },
      { id: "2207", damage: "10000.0", damage_type: "DamageTypeAugment" },
    ],
  } };
  const model = makeGridFightCard(source.role.uid, brief, [fixture], 1);
  expect(model.battle?.damage.map(hit => [hit.entity.name, hit.kind, hit.label])).toEqual([
    ["角色甲", "role", "136.0亿"], ["角色乙", "role", "1.9亿"],
    ["持续伤害概念股", "environment", "1.0亿"], ["羁绊甲", "trait", "6988.8万"], ["策略甲", "strategy", "1.0万"],
  ]);
  expect(model.battle?.damage[2]?.entity.icon).toBe("https://fastcdn.mihoyo.com/portal.png");
  expect(gridFightText(model)).toContain("持续伤害概念股 1.0亿");
  // A canonical role ID wins over another role's avatar alias.
  const collision = makeGridFightCard(source.role.uid, brief, [{ ...fixture, lineup: { ...fixture.lineup,
    damage_list: [{ id: "1408", damage: "1", damage_type: "DamageTypeRole" }],
  } }], 1);
  expect(collision.battle?.damage[0]?.entity.name).toBe("角色乙");
  const alias = makeGridFightCard(source.role.uid, brief, [{ ...fixture, lineup: { ...fixture.lineup,
    back_roles: [], damage_list: [{ id: "1408", damage: "1", damage_type: "DamageTypeRole" }],
  } }], 1);
  expect(alias.battle?.damage[0]?.entity.name).toBe("角色甲");
});


test("spotlight damage uses its own IDs and preserves safe associated role art", () => {
  const fixture = { ...record, lineup: { ...record.lineup,
    spot_light_list: [null, { spot_light_id: "1220", name: "渐冻寒潮", icon: "https://fastcdn.mihoyo.com/aura.png?private=ignored", role_icon: "https://fastcdn.mihoyo.com/role.png" },
      { spot_light_id: "99", name: "另一个光环", role_icon: "http://127.0.0.1/private" }],
    damage_list: [
      { id: "1220", damage: "100", damage_type: "DamageTypeSpotLight" },
      { id: "1220", damage: "90", damage_type: "DamageTypeTrait" },
      { id: "1220", damage: "80", damage_type: "DamageTypeRole" },
      { id: "400", damage: "70", damage_type: "DamageTypeSpotLight" },
    ],
  } };
  const model = makeGridFightCard(source.role.uid, brief, [fixture], 1);
  expect(model.battle?.spotlights).toMatchObject([
    { id: "1220", name: "渐冻寒潮", icon: "https://fastcdn.mihoyo.com/aura.png", roleIcon: "https://fastcdn.mihoyo.com/role.png" },
    { id: "99", name: "另一个光环", roleIcon: undefined },
  ]);
  expect(model.battle?.damage.map(hit => [hit.entity.name, hit.kind])).toEqual([
    ["渐冻寒潮", "spotlight"], ["巡猎", "trait"], ["飞霄", "role"], ["未知伤害来源", "spotlight"],
  ]);
  expect(gridFightText(model)).toContain("主角光环：渐冻寒潮、另一个光环");
  const recent = makeGridFightCard(source.role.uid, brief, [fixture], undefined, 2);
  expect(recent.recent?.[0]?.battle.spotlights).toEqual(model.battle?.spotlights);
  expect(gridFightText(recent)).toContain("主角光环：渐冻寒潮、另一个光环");
  const legacy = makeGridFightCard(source.role.uid, brief, [record], 1);
  expect(legacy.battle?.spotlights).toEqual([]);
  expect(gridFightText(legacy)).not.toContain("主角光环");
});
