import { expect, test } from "bun:test";
import { normalizePanel, readLegacyPanel, readStarRailExtraEidolon, type PanelAvatar } from "../panel-model.ts";
import { parseEquipmentChange } from "../panel-equipment.ts";
import { calculateStarRailPersonalDamage } from "../panel-damage.ts";
import physical from "./fixtures/panel-damage-physical-imaginary.json";
import additional from "./fixtures/panel-damage-additional.json";
import ordinary from "./fixtures/panel-damage.json";

test("奇缘星魂与普通星魂分开归一化，关闭值与未激活节点不会误判开启", () => {
  for (const row of [{exCons:1},{ex_rank:1},{extra_rank:1},{ex_cons:1},{exRankList:[120401]},
    {exRankIdList:[120401]},{ex_rank_list:[120401]},{ex_ranks:{120401:true}},
    {skills:[{point_id:120401,is_activated:true}]},{skillTreeList:[{pointId:120401,level:1}]}]) {
    expect(readStarRailExtraEidolon(row,"1204")).toBe(1);
  }
  expect(readStarRailExtraEidolon({exCons:0,skills:[{point_id:120401,is_activated:true}]},"1204")).toBe(0);
  expect(readStarRailExtraEidolon({skills:[{point_id:120401,is_activated:false}]},"1204")).toBe(0);
  expect(readStarRailExtraEidolon({skills:[{point_id:120401}]},"1204")).toBe(0);
  const official = normalizePanel("100000001",[{id:1204,name:"景元",level:80,rank:2,ex_rank:1}]).avatars[0]!;
  expect([official.rank,official.exCons]).toEqual([2,1]);
  const old = readLegacyPanel("100000001",{uid:"100000001",avatars:{1204:{id:1204,_source:"EnkaHSR",name:"景元",level:80,cons:2,exCons:1}}}).avatars[0]!;
  expect([old.rank,old.exCons]).toEqual([2,1]);
});

test("临时换奇缘开关保留普通星魂和其它预览参数", () => {
  expect(parseEquipmentChange("*景元伤害换奇缘")?.equipment).toEqual({extraEidolon:1});
  expect(parseEquipmentChange("*黄泉面板换关闭奇缘星魂")?.equipment).toEqual({extraEidolon:0});
  expect(parseEquipmentChange("*饮月伤害换奇缘换2魂")?.equipment).toEqual({eidolon:2,extraEidolon:1});
});

for (const [id, fixtures, title] of [["1204",additional,"30层神君单体伤害"],
  ["1213",physical,"奇缘追击伤害(全体)"],["1308",ordinary,"奇缘追击伤害·对单"]] as const) {
  test(`${id}只在奇缘开启时使用新增倍率，旧存档伤害场景保持`, () => {
    const fixture = fixtures.find(entry => entry.avatar.id === id)!;
    const {setNames,...metadata} = fixture.metadata;
    const sets = new Map(Object.entries(setNames));
    const options = {...metadata,setForId:(key:string)=>sets.get(key)};
    const avatar = structuredClone(fixture.avatar) as PanelAvatar;
    const before = calculateStarRailPersonalDamage(avatar,options)!;
    const changed = calculateStarRailPersonalDamage({...avatar,exCons:1},options)!;
    expect(before.rows.some(row=>row.title===title)).toBe(false);
    expect(changed.rows.find(row=>row.title===title)?.average).toBeGreaterThan(0);
    expect(avatar.exCons).toBeUndefined();
    if (id === "1204") expect(changed.rows.some(row=>row.title==="10层神君单体伤害")).toBe(false);
  });
}
