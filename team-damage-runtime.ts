import { fileURLToPath } from "node:url";
import { id, object, text } from "./panel-model.ts";
import { TeamDamageError } from "./team-damage-model.ts";
import type { TeamOwnedPanel } from "./team-owned-panel.ts";
import catalog from "./team-engine/catalog.json";
import defaults from "./team-engine/defaults.json";

export const starRailTeamCatalog = catalog.characters;
export const starRailTeamCones: Readonly<Record<string, string>> = catalog.lightCones;
export const starRailTeamEngine = "HSR_Nous · 00185dd";

export function starRailTeamDefaultCone(id: string, path: string) {
  return (defaults.characters as Readonly<Record<string, { cone: string }>>)[id]?.cone ??
    (defaults.paths as Readonly<Record<string, { cone: string }>>)[path]?.cone;
}
const workerFile = fileURLToPath(new URL("./team-engine/worker.py", import.meta.url));
const workerRoot = fileURLToPath(new URL("./team-engine/", import.meta.url));

export interface TeamSimulationMember {
  readonly id: string;
  readonly version?: "enhanced" | "legacy";
  readonly panel?: TeamOwnedPanel;
}

export interface TeamBattleResult {
  readonly total: number;
  readonly dps: number;
  readonly damage: readonly { readonly name: string; readonly value: number }[];
  readonly actions: readonly { readonly name: string; readonly value: number }[];
  readonly turns: readonly { readonly title: string; readonly actionPoint: number; readonly lines: readonly string[] }[];
  readonly warnings: readonly string[];
}

function teamBattleResult(result: ReturnType<typeof object>): TeamBattleResult {
  if (result?.error === "python-version") throw new TeamDamageError("星铁队伍伤害需要 Python 3.10 或更新版本。");
  if (result?.error === "data" || result?.error === "invalid") throw new TeamDamageError("HSR_Nous 模板或面板数据校验失败，请检查资源和所选面板。");
  if (result?.error === "limit") throw new TeamDamageError("队伍伤害达到模拟行动上限，请减少轮次后重试。");
  if (result?.error === "characters" && id(result.id)) throw new TeamDamageError(`此版本的 HSR_Nous 暂无角色 ID ${result.id} 的机制模板。`);
  if (result?.error === "light_cones" && id(result.id)) throw new TeamDamageError(`这枚光锥（ID ${result.id}）暂无数据，原面板也没有可核对的白值。`);
  const { total, dps, damage, actions, turns, warnings } = result ?? {};
  const finite = (entry: unknown): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry >= 0;
  function namedRows(input: unknown, limit: number) {
    if (!Array.isArray(input) || input.length > limit) throw new Error("Invalid team rows");
    return input.map(value => {
      const row = object(value), name = text(row?.name, 50);
      if (!name || !finite(row?.value)) throw new Error("Invalid team result value");
      return { name, value: row.value };
    });
  }
  if (!finite(total) || !finite(dps) || !Array.isArray(turns) || turns.length > 36 || !Array.isArray(warnings) || warnings.length > 8) {
    throw new Error("Invalid team battle result");
  }
  return {
    total, dps, damage: namedRows(damage, 16), actions: namedRows(actions, 12),
    warnings: warnings.map(note => text(note, 160)).filter(Boolean),
    turns: turns.map(value => {
      const row = object(value), title = text(row?.title, 90);
      if (!Array.isArray(row?.lines) || row.lines.length > 8) throw new Error("Invalid team turn lines");
      return { title, actionPoint: finite(row.actionPoint) ? row.actionPoint : 0, lines: row.lines.map(line => text(line, 260)).filter(Boolean) };
    }),
  };
}

async function readWorkerStream(stream: ReadableStream<Uint8Array>, signal: AbortSignal) {
  const reader = stream.getReader();
  const bytes: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 256 * 1024) throw new Error("Team result exceeds size limit");
      bytes.push(chunk.value);
    }
    return Buffer.concat(bytes, length).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}

export async function calculateTeamDamage(roles: readonly TeamSimulationMember[], cycle: number, enemies: number, cancellation: AbortSignal) {
  cancellation.throwIfAborted();
  const python = Bun.which("python3") ?? (process.platform === "win32" ? Bun.which("python") : null);
  if (!python) throw new TeamDamageError("星铁队伍伤害需要本机 Python 3.10 或更新版本。");
  if (!(await Bun.file(workerFile).exists())) throw new TeamDamageError("本地队伍伤害模块文件缺失，请检查安装。");
  const timeout = AbortSignal.timeout(8_000);
  const signal = AbortSignal.any([cancellation, timeout]);
  const bytes = JSON.stringify({ roles, cycle, enemies });
  const child = Bun.spawn([python, "-I", "-B", "-S", workerFile], {
    cwd: workerRoot, env: { LANG: "C.UTF-8" }, stdin: new Blob([bytes]), stdout: "pipe", stderr: "ignore",
  });
  const kill = () => child.kill("SIGKILL");
  signal.addEventListener("abort", kill, { once: true });
  if (signal.aborted) kill();
  try {
    const [output, exit] = await Promise.all([readWorkerStream(child.stdout, signal), child.exited]);
    signal.throwIfAborted();
    if (exit !== 0 || !output) throw new TeamDamageError("HSR_Nous 计算进程未完成，请检查 Python 3.10+ 或重试。");
    return teamBattleResult(object(JSON.parse(output)));
  } catch (error) {
    if (timeout.aborted && !cancellation.aborted) throw new TeamDamageError("星铁队伍伤害计算超时，请减少轮次后重试。");
    throw error;
  } finally {
    signal.removeEventListener("abort", kill);
    if (child.exitCode === null && child.signalCode === null) kill();
    await child.exited;
  }
}
