import { expect, test } from "bun:test";
import { changePanelEidolon } from "../panel-eidolon.ts";
import { normalizePanel, parsePanelCommand, readLegacyPanel } from "../panel-model.ts";
import { applyStarRailTraces, confirmedStarRailTraces, readStarRailTraceArchive } from "../panel-trace-refresh.ts";

const uid = "500000123", start = 1_800_000_000_000;
const base = {
  id: 1001, name: "三月七", level: 80, rank: 4, equip: { id: 21001, level: 75, rank: 2 },
  relics: [{ id: 61011, pos: 1, level: 12, rarity: 5 }],
  skills: [{ remake: "普攻", level: 4 }, { remake: "战技", level: 9 }, { remake: "终结技", level: 8 },
    { remake: "天赋", level: 5 }, { remake: "忆灵技", level: 6 }, { point_id: 1001201, is_activated: true }],
};
const update = {
  ...base, equip: { id: 21002, level: 1, rank: 1 }, relics: [],
  skills: [{ remake: "普攻", level: 6 }, { remake: "战技", level: 12 }, { remake: "终结技", level: 10 },
    { remake: "天赋", level: 9 }, { remake: "忆灵技", level: 8 }, { point_id: 1001201, is_activated: false }],
};

test("旧星铁行迹指令保留技能/天赋同义写法和选定档案", () => {
  const parsed = { type: "refresh-traces", name: "", profileId: 2 } as const;
  for (const command of ["*刷新行迹2", "#星铁强制刷新所有角色天赋2", "#星铁更新所有角色技能 档案2"]) {
    expect(parsePanelCommand(command)).toEqual(parsed);
  }
  for (const command of ["#原神刷新行迹2", "#星铁刷新角色行迹档案", "#星铁刷新行迹100000121"]) {
    expect(parsePanelCommand(command)).toBeUndefined();
  }
});

test("确认完整四项后仅叠加本人同星魂角色等级，装备、树、额外技能和原面板保持", () => {
  const snapshot = normalizePanel(uid, [base], new Date(start - 1_000));
  const incoming = confirmedStarRailTraces(snapshot, [update, { ...update, id: 1002 }], start);
  expect(incoming).toEqual({ "1001": { rank: 4, at: start, levels: { a: 6, e: 12, q: 10, t: 9 } } });
  expect(readStarRailTraceArchive(uid, { version: 1, uid, records: incoming })).toEqual(incoming);
  expect(() => readStarRailTraceArchive("500000124", { version: 1, uid, records: incoming })).toThrow("档案无效");
  const refreshed = applyStarRailTraces(snapshot, incoming);
  expect(refreshed.avatars[0]).toMatchObject({
    cone: { id: "21001", level: 75, rank: 2 }, relics: [{ id: "61011", level: 12 }],
    traces: [{ id: "1001201", active: true }], skills: [
      { key: "a", level: 6, effective: true }, { key: "e", level: 12 }, { key: "q", level: 10 },
      { key: "t", level: 9 }, { key: "me", level: 6 },
    ],
  });
  expect(snapshot.avatars[0]?.skills[0]?.level).toBe(4);
  const newer = normalizePanel(uid, [base], new Date(start + 1_000));
  expect(applyStarRailTraces(newer, incoming)).toEqual(newer);
  for (const retry of [[{ ...update, rank: 3 }], [{ ...update, skills: update.skills.slice(0, 3) }],
    [update, update], [{ ...update, skills: [...update.skills, { remake: "普攻", level: 7 }] }]]) {
    expect(confirmedStarRailTraces(snapshot, retry, start)).toEqual({});
  }
});

test("旧面板新等级使用有效值，换星魂只计算一次加级", () => {
  const snapshot = readLegacyPanel(uid, { uid, avatars: { "1001": {
    id: 1001, level: 80, cons: 4, _source: "homo", talent: { a: 4, e: 7, q: 8, t: 5 }, trees: [1001201],
  } } });
  const records = confirmedStarRailTraces(snapshot, [update], start);
  const avatar = applyStarRailTraces(snapshot, records).avatars[0]!;
  const result = changePanelEidolon(avatar, 2, { a: 5, e: 3, q: 5, t: 3 });
  expect(result).toMatchObject({ avatar: { rank: 2, skills: [
    { key: "a", level: 6 }, { key: "e", level: 10, original: 10 }, { key: "q", level: 10 }, { key: "t", level: 7 },
  ] } });
});
