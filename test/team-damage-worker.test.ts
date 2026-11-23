import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { calculateTeamDamage, starRailTeamCatalog } from "../team-damage-runtime.ts";

const members = ["1220", "1112", "1303", "8005"].map(id => ({ id }));

test("固定开源引擎无需旧安装即可计算，并保留多目标与确定性", async () => {
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

test("本地工作进程尊重提前取消", async () => {
  const cancelled = AbortSignal.abort();
  await expect(calculateTeamDamage(members, 20, 5, cancelled)).rejects.toBeDefined();
});

test("计算期间保留调用方取消原因", async () => {
  const abort = new AbortController();
  const reason = new Error("fixture owner disconnected");
  const outcome = calculateTeamDamage(members, 20, 5, abort.signal).then(() => undefined, error => error);
  await Bun.sleep(5);
  abort.abort(reason);
  expect(await outcome).toBe(reason);
});

test("工作进程保持单 JSON 回包和输入边界", async () => {
  const worker = fileURLToPath(new URL("../team-engine/worker.ts", import.meta.url));
  const run = async (input: string) => {
    const child = Bun.spawn([process.execPath, "--no-env-file", worker], {
      stdin: new Blob([input]), stdout: "pipe", stderr: "pipe", timeout: 8_000, killSignal: "SIGKILL",
    });
    return await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  };
  const valid = JSON.stringify({ roles: members, cycle: 1, enemies: 1 });
  const unknown = JSON.stringify({ roles: [{ id: "9999" }], cycle: 1, enemies: 1 });
  const [success, invalid, missing, oversized] = await Promise.all([
    run(valid.padEnd(512 * 1024, " ")), run("{"), run(unknown), run(valid.padEnd(512 * 1024 + 1, " ")),
  ]);
  expect(success[0]).toBe(0);
  expect(success[1].trim().split("\n")).toHaveLength(1);
  expect(JSON.parse(success[1]).total).toBeGreaterThan(0);
  expect(invalid.slice(0, 2)).toEqual([0, '{"error":"invalid"}\n']);
  expect(missing.slice(0, 2)).toEqual([0, '{"error":"characters","id":"9999"}\n']);
  expect(oversized).toEqual([1, "", "Invalid team request\n"]);
});

test("行动详情显示官方形态与角色名称", async () => {
  const signal = new AbortController().signal;
  const roster = ["1310", "1224", "1014", "1015"].map(id => ({ id }));
  const report = await calculateTeamDamage(roster, 3, 3, signal);
  const lines = report.turns.flatMap(turn => turn.lines);
  expect(lines).toContain("进入「完全燃烧」");
  expect(lines).toContain("退出「完全燃烧」");
  expect(report.damage.map(row => row.name)).toEqual(expect.arrayContaining(["Saber", "Archer", "三月七·巡猎"]));
  expect(report.turns.map(turn => turn.title)).toEqual(expect.arrayContaining(["Saber", "Archer", "三月七·巡猎"]));
  expect(lines.join("\n")).not.toMatch(/[A-Za-z_]/u);
}, 16_000);
