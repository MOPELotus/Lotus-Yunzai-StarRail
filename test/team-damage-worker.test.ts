import { expect, test } from "bun:test";
import { calculateTeamDamage, starRailTeamCatalog } from "../team-damage-runtime.ts";

const python = Bun.which("python3") ?? (process.platform === "win32" ? Bun.which("python") : null);
const members = ["1220", "1112", "1303", "8005"].map(id => ({ id }));

test.skipIf(!python)("固定开源引擎无需旧安装即可计算，并保留多目标与确定性", async () => {
  const signal = new AbortController().signal;
  const single = await calculateTeamDamage(members, 1, 1, signal);
  const [multi, repeated] = await Promise.all([calculateTeamDamage(members, 3, 5, signal), calculateTeamDamage(members, 3, 5, signal)]);
  expect(single.total).toBeGreaterThan(0);
  expect(multi.total).toBeGreaterThan(single.total);
  expect(multi).toEqual(repeated);
  expect(multi.damage).toHaveLength(4);
  expect(multi.turns.length).toBeGreaterThan(8);
  expect(new Set(multi.actions.map(action => action.name)).size).toBe(4);
  expect(multi.damage.reduce((sum, row) => sum + row.value, 0)).toBeCloseTo(multi.total, 4);
  expect(multi.warnings).toContain("飞霄：终结技视为追加攻击等细节未完整计入。");
  expect(multi.warnings).toContain("托帕&账账：账账继承托帕攻击力和部分暴击伤害效果按近似规则计算。");
  const lines = multi.turns.flatMap(turn => turn.lines);
  expect(lines).toContain("召唤 · 账账登场");
  expect(lines).toContain("战技 · 钺贯");
  expect(lines).toContain("追加攻击 · 雷狩");
  expect(lines).toContain("追加攻击 · 猪市？！");
  expect(lines).toContain("第 2 轮开始");
  expect(lines.some(line => /^造成 [\d,.]+ 点伤害/u.test(line))).toBe(true);
  expect([...multi.warnings, ...lines].join("\n")).not.toMatch(/[A-Za-z_]/u);
  expect(starRailTeamCatalog.some(role => role.item_id === "1413")).toBe(true);
  expect(starRailTeamCatalog.every(role => role.item_id.length === 4)).toBe(true);
}, 16_000);

test.skipIf(!python)("本地工作进程尊重提前取消", async () => {
  const cancelled = AbortSignal.abort();
  await expect(calculateTeamDamage(members, 20, 5, cancelled)).rejects.toBeDefined();
});

test.skipIf(!python)("行动详情显示官方形态与角色名称", async () => {
  const signal = new AbortController().signal;
  const roster = ["1310", "1303", "1014", "1015"].map(id => ({ id }));
  const report = await calculateTeamDamage(roster, 3, 3, signal);
  const lines = report.turns.flatMap(turn => turn.lines);
  expect(lines).toContain("进入「完全燃烧」");
  expect(lines).toContain("退出「完全燃烧」");
  expect(report.damage.map(row => row.name)).toEqual(expect.arrayContaining(["Saber", "Archer"]));
  expect(report.turns.map(turn => turn.title)).toEqual(expect.arrayContaining(["Saber", "Archer"]));
  expect(lines.join("\n")).not.toMatch(/[A-Za-z_]/u);
}, 16_000);
