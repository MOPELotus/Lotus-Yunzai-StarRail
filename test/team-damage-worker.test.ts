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
  expect(multi.warnings.some(note => note.includes("飞霄") || note.includes("托帕"))).toBe(true);
  expect(starRailTeamCatalog.some(role => role.item_id === "1413")).toBe(true);
  expect(starRailTeamCatalog.every(role => role.item_id.length === 4)).toBe(true);
}, 16_000);

test.skipIf(!python)("本地工作进程尊重提前取消", async () => {
  const cancelled = AbortSignal.abort();
  await expect(calculateTeamDamage(members, 20, 5, cancelled)).rejects.toBeDefined();
});
