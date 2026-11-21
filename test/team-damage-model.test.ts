import { expect, test } from "bun:test";
import { parsePanelCommand, type PanelAvatar } from "../panel-model.ts";
import { projectTeamOwnedPanel } from "../team-owned-panel.ts";
import { parseStarRailTeamDamage, resolveTeamDamageRoles } from "../team-damage-model.ts";

const makeRole = (item_id: string, nick_name: string) => ({ item_id, nick_name, dps_template: {} });
const feixiao = makeRole("1220", "飞霄");
const topaz = makeRole("1112", "托帕&账账");
const ruan = makeRole("1303", "阮•梅");
const harmony = makeRole("8006", "开拓者·同谐");
const catalog = [feixiao, topaz, ruan, harmony];

test("旧队伤档号、详情和队伍缩写独立于单体伤害", () => {
  expect(parseStarRailTeamDamage("*队伤2飞托阮同")).toMatchObject({ profileId: 2, roles: ["飞托阮同"] });
  expect(parseStarRailTeamDamage("#星铁伤害过程 飞霄 托帕 2")).toMatchObject({ profileId: 2, detail: true, roles: ["飞霄", "托帕"] });
  expect(parseStarRailTeamDamage("*伤害 银狼lv999")?.roles).toEqual(["银狼lv999"]);
  expect(parseStarRailTeamDamage("#星铁队伍伤害全图 100000731 飞霄 托帕 29轮 5敌 档案2")).toEqual({
    detail: true, uid: "100000731", cycle: 20, enemies: 5, profileId: 2, roles: ["飞霄", "托帕"],
  });
  expect(parseStarRailTeamDamage("*队伍伤害0飞霄")?.profileId).toBe(0);
  expect(parseStarRailTeamDamage("*队伍伤害100000731 飞霄")?.profileId).toBe(100000731);
  expect(parseStarRailTeamDamage("*飞霄伤害")).toBeUndefined();
  expect(parsePanelCommand("*飞霄伤害")).toMatchObject({ type: "damage", name: "飞霄" });
  expect(resolveTeamDamageRoles(["飞托阮同"], catalog)).toEqual(catalog);
  expect(resolveTeamDamageRoles(["飞霄托帕阮梅同谐主"], catalog)).toEqual(catalog);
  expect(() => resolveTeamDamageRoles(["飞霄未知"], catalog)).toThrow("无法识别");
  expect(() => resolveTeamDamageRoles(["飞霄", "飞霄"], catalog)).toThrow("只能");
});

test("合成面板投影仅送战斗数值，不传账号与 UID，基础和百分比维度保持独立", () => {

  const avatar: PanelAvatar = {
    id: "1220", name: "飞霄", element: "风", path: "巡猎", face: "", splash: "", stars: [], traces: [],
    level: 80, rank: 3, cone: { id: "23031", name: "我将，巡征追猎", level: 80, rank: 1, image: "", description: "" },
    skills: [{ key: "a", level: 7, original: 6, icon: "" }, { key: "q", level: 12, icon: "" }],
    relics: [{ id: "61201", slot: 1, name: "", image: "", rarity: 5, level: 15, main: { key: "hp", value: "705.6" }, subs: [] }],
    stats: [
      { key: "hp", base: "1900", value: "3600" }, { key: "atk", base: "1440", value: "2700" },
      { key: "def", base: "500", value: "970" }, { key: "speed", base: "112", value: "143" },
      { key: "effPct", base: "0%", value: "0.5%" }, { key: "wind", base: "0%", value: "38%" },
    ],
  };
  const personal = projectTeamOwnedPanel(avatar)!;
  expect(personal.base).toMatchObject({ atk: 1440, spd: 112 });
  expect(personal.stats).toMatchObject({ atk: 2700, spd: 143, effectHitRate: 0.005, dmgBonus_Wind: 0.38 });
  expect(personal.cone).toMatchObject({ id: "23031", level: 80, rank: 1 });
  expect(personal.skills).toMatchObject({ basic: { level: 6, effective: false }, ult: { level: 12, effective: true } });
  expect(personal.relics[0]).toMatchObject({ slot: 1, set: "120", main: { key: "hp" } });
  expect(personal.relics[0]?.main?.value).toBeCloseTo(705.6);
  expect(personal).not.toHaveProperty("uid");
});
