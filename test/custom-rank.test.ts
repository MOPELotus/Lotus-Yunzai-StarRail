import { expect, test } from "bun:test";
import { readStarRailRankingPanel } from "../custom-rank.ts";

const character = { id: 1102, name: "希儿" };
const uid = "12****678";
const raw = { uid: "12@@@@678", name: "hidden", avatars: {
  1102: { id: 1102, name: "不能覆盖当前选择", elem: "量子", level: 80, _source: "homo",
    weapon: { id: 23001, level: 80, affix: 1 }, talent: { a: 6, e: 9, q: 10 }, artis: {}, trees: [] },
  1204: { id: 1204, name: "景元", elem: "雷", level: 80, _source: "homo" },
} };

test("星铁引用榜单只读同遮罩 UID 及确切角色，公开面板不会显示临时解析 UID", () => {
  const panel = readStarRailRankingPanel(raw, uid, character);
  expect(panel?.uid).toBe(uid);
  expect(panel?.avatars).toHaveLength(1);
  expect(panel?.avatars[0]).toMatchObject({ id: "1102", name: "希儿", cone: { id: "23001", rank: 1 } });
  expect(panel).not.toHaveProperty("name");
  expect(readStarRailRankingPanel({ ...raw, uid: "123456678" }, uid, character)).toBeUndefined();
  expect(readStarRailRankingPanel(raw, "12****679", character)).toBeUndefined();
  expect(readStarRailRankingPanel(raw, uid, { id: 1213, name: "丹恒·饮月" })).toBeUndefined();
  expect(readStarRailRankingPanel({ ...raw, avatars: { [character.id]: raw.avatars[1204] } }, uid, character))
    .toBeUndefined();
});
