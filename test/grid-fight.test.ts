import { expect, test } from "bun:test";
import type { ProfileRequestContext } from "@lotus-yunzai/account";
import { createStarRailGridFightQuery } from "../grid-fight-command.ts";
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

test("supports old grid-fight handles and keeps record ordinals separate from saved profiles", () => {
  for (const command of ["*货币战争", "#星铁货币战争", "#货币战争", "货币战争", "星轨货币", "＊币战"])
    expect(parseStarRailGridFight(command)).toEqual({ mode: "overview", profileId: 1 });
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

test("does not query delegated or mentioned users and refuses to deliver after changing the selected role", async () => {
  const actor = { user_id: 42, self_id: 99, message_type: "group" };
  const query = parseStarRailGridFight("*币战战报1 档案2")!;
  const source: ProfileRequestContext = {
    qq: "42", profileId: 2, revision: "grid-fixture", game: "sr",
    role: { uid: "500000123", region: "prod_qd_cn", gameBiz: "hkrpg_cn", nickname: "合成开拓者", chosen: true },
    account: { cookie: "cookie_token=fixture-cookie", stoken: "", stuid: "", stokenCookie: "", ltuid: "", ltoken: "", mid: "" },
    device: { id: "device-2", fp: "fingerprint-2", name: "fixture", model: "Android", androidVersion: "13", raw: {} },
  };
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
