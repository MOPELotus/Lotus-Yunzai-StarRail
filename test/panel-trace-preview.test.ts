import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { parsePanelCommand, readLegacyPanel } from "../panel-model.ts";
import { changePanelFullTraces } from "../panel-trace-preview.ts";

const uid = "100000123";
const avatar = readLegacyPanel(uid, { uid, avatars: { 2212: {
  id: 2212, level: 80, cons: 2, _source: "mysPanelHSR", talent: { a: 6, e: 10, q: 10, t: 10 },
  trees: ["12212202"], weapon: { id: 23014, level: 80, affix: 3 },
} } }).avatars[0]!;
const attrIds = Array.from({ length: 10 }, (_, i) => String(12212201 + i));
const metadata = Object.fromEntries(attrIds.map(id => [id, { key: "cdmg", value: 5 }]));

test("matches the original full trace commands for details and a selected damage scenario", () => {
  expect(parsePanelCommand("#星铁镜流Pro伤害5换满行迹 2")).toEqual({
    type: "damage", name: "镜流Pro", scenario: 5, profileId: 2, equipment: { fullTraces: true },
  });
  expect(parsePanelCommand("*希儿面板换满行迹")).toMatchObject({ type: "detail", equipment: { fullTraces: true } });
  expect(parsePanelCommand("*希儿面板换满行迹换六魂")).toBeUndefined();
});

test("activates original short and enhanced IDs without changing skill levels or other fields", () => {
  const before = structuredClone(avatar);
  const preview = changePanelFullTraces(avatar, metadata);
  assert("avatar" in preview);
  expect(preview.avatar.traces.map(({ id, active }) => [id, active])).toEqual(
    ["2212101", "2212102", "2212103", ...attrIds, "301", "302"].map(id => [id, true]),
  );
  expect(preview.avatar).toMatchObject({ rank: 2, skills: avatar.skills, cone: avatar.cone });
  expect(avatar).toEqual(before);
  expect(changePanelFullTraces(avatar, { "12212201": { key: "cdmg", value: 2 } })).toMatchObject({
    error: expect.stringMatching(/缺少角色行迹资料/),
  });
});
