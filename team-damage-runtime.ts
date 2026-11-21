import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdtemp, mkdir, open, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { id, object, text } from "./panel-model.ts";
import { TeamDamageError, type TeamRole, type teamPanelInput } from "./team-damage-model.ts";
import { legacyTeamRuntimeFiles } from "./team-runtime-files.ts";

const hostRoot = fileURLToPath(new URL("../../", import.meta.url));
const legacyNames = ["Lotus-ReFactor", "Lotus-Plugin"];
const dictionaryFile = "services/starRailTeamDamage/data/system-data.json";
const maxDataBytes = 8 * 1024 * 1024;
const runtimeMissing = "星铁队伍伤害需要可核验的旧运行库和工坊公开字典。本机暂未发现可用版本。";
const sandboxMissing = "此环境无法启动星铁队伍伤害的 Linux 隔离进程。";

async function readBounded(path: string, limit = maxDataBytes) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const initial = await file.stat();
    if (!initial.isFile() || initial.size < 1 || initial.size > limit) throw new Error("File size outside bounds");
    const data = Buffer.alloc(initial.size);
    for (let offset = 0; offset < data.length;) {
      const { bytesRead } = await file.read(data, offset, data.length - offset, offset);
      if (!bytesRead) throw new Error("File changed during read");
      offset += bytesRead;
    }
    const latest = await file.stat();
    if (initial.mtimeMs !== latest.mtimeMs || initial.ctimeMs !== latest.ctimeMs || initial.size !== latest.size) throw new Error("File changed during read");
    return data;
  } finally {
    await file.close();
  }
}

function tryJson(path: string, limit = maxDataBytes) {
  return readBounded(path, limit).then(data => object(JSON.parse(data.toString("utf8")))).catch(() => undefined);
}

interface TeamDictionary {
  system_roles: TeamRole[];
  system_guangs: unknown[];
  system_artifacts: unknown[];
}

export async function readTeamDamageRuntime() {
  if (process.platform !== "linux" || !Bun.which("bwrap") || !Bun.which("node")) throw new TeamDamageError(sandboxMissing);
  const configured = Bun.env.LOTUS_STAR_RAIL_TEAM_RUNTIME_DIR?.trim();
  const candidates = configured ? [resolve(configured)] : legacyNames.map(name => join(hostRoot, "plugins", name));
  if (!configured) {
    const theme = await realpath(Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR?.trim() || starRailGachaThemeDirectory()).catch(() => "");
    if (basename(theme) === "resources" && basename(dirname(theme)) === "miao-plugin") {
      candidates.push(...legacyNames.map(name => join(dirname(dirname(theme)), name)));
    }
    candidates.push(...legacyNames.map(name => join(hostRoot, "..", name)));
  }
  for (const root of candidates) {
    const cached = await tryJson(join(root, dictionaryFile));
    const roles = cached?.system_roles, weapons = cached?.system_guangs, relics = cached?.system_artifacts;
    if (!Array.isArray(roles) || !roles.length || roles.length > 300 || !Array.isArray(weapons) || weapons.length > 500 ||
        !Array.isArray(relics) || relics.length > 500 || roles.some(role => !object(role) || !id(role.item_id))) continue;

    const files: [string, Buffer][] = [];
    try {
      for (const [file, expected] of Object.entries(legacyTeamRuntimeFiles)) {
        const data = await readBounded(join(root, file), 4 * 1024 * 1024);
        if (createHash("sha256").update(data).digest("hex") !== expected) throw new Error("Legacy runtime hash mismatch");
        files.push([file, data]);
      }
    } catch {
      continue;
    }
    const dictionary: TeamDictionary = { system_roles: roles, system_guangs: weapons, system_artifacts: relics };
    return { files, dictionary };
  }
  throw new TeamDamageError(runtimeMissing);
}

export type TeamRuntime = Awaited<ReturnType<typeof readTeamDamageRuntime>>;
type PanelInput = NonNullable<ReturnType<typeof teamPanelInput>>;
type Promotions = Record<string, { hp: BaseGrowth; atk: BaseGrowth; def: BaseGrowth }[]>;
type BaseGrowth = { base: number; step: number };

function validSegment(segment: unknown): segment is string {
  return typeof segment === "string" && segment.length > 0 && segment.length <= 90 &&
    segment !== "." && segment !== ".." && !/[\/\\\p{Cc}]/u.test(segment);
}

export async function readTeamConePromotions(ids: readonly string[]) {
  const configured = Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR?.trim();
  const theme = configured || starRailGachaThemeDirectory();
  const roots = configured ? [theme] : [theme, join(hostRoot, "plugins", "miao-plugin", "resources"), join(hostRoot, "..", "miao-plugin", "resources")];
  const result: Promotions = {};
  for (const root of [...new Set(roots)]) {
    const directory = join(root, "meta-sr", "weapon");
    const catalog = await tryJson(join(directory, "data.json"));
    for (const weaponId of ids) {
      if (Object.hasOwn(result, weaponId)) continue;
      const cone = object(catalog?.[weaponId]);
      if (!validSegment(cone?.type) || !validSegment(cone.name)) continue;
      const data = await tryJson(join(directory, cone.type, cone.name, "data.json"), 256 * 1024);
      const attrs = data?.attr;
      const stats = Array.isArray(attrs) ? attrs : object(attrs);
      const growth = object(data?.growAttr);
      if (id(data?.id) !== weaponId || !stats || Object.keys(stats).length !== 7 || !growth) continue;
      const values = Array.from({ length: 7 }, (_, index) => {
        const attr = object(object(Array.isArray(stats) ? stats[index] : stats[String(index)])?.attrs);
        const values = (["hp", "atk", "def"] as const).map(key => {
          const base = attr?.[key], step = growth[key];
          return typeof base === "number" && typeof step === "number" && Number.isFinite(base) && Number.isFinite(step) &&
            base >= 0 && base <= 10_000 && step >= 0 && step <= 100 ? { base, step } : undefined;
        });
        const [hp, atk, def] = values;
        return hp && atk && def ? { hp, atk, def } : undefined;
      });
      if (values.every(row => row !== undefined)) result[weaponId] = values;
    }
  }
  if (ids.some(key => !Object.hasOwn(result, key))) throw new TeamDamageError("本地缺少所选光锥的突破属性，请先同步星铁面板资源。");
  return result;
}

export interface TeamBattleResult {
  readonly total: number;
  readonly dps: number;
  readonly damage: readonly { readonly name: string; readonly value: number }[];
  readonly actions: readonly { readonly name: string; readonly value: number }[];
  readonly turns: readonly { readonly title: string; readonly actionPoint: number; readonly lines: readonly string[] }[];
}

function teamBattleResult(result: ReturnType<typeof object>): TeamBattleResult {
  if (result?.error === "unsupported" && id(result.roleId)) throw new TeamDamageError(`旧队伍伤害引擎暂不支持角色 ID ${result.roleId}。`);
  if (result?.error === "engine") throw new TeamDamageError("旧星铁队伍伤害引擎无法完成本次计算。");
  if (result?.error === "missing-cone") throw new TeamDamageError("本地缺少所选光锥的突破属性，请先同步星铁面板资源。");
  const { total, dps, damage, actions, turns } = result ?? {};
  const finite = (entry: unknown): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry >= 0;
  function namedRows(input: unknown, limit: number) {
    if (!Array.isArray(input) || input.length > limit) throw new Error("Invalid team rows");
    return input.map(value => {
      const row = object(value), name = text(row?.name, 50);
      if (!name || !finite(row?.value)) throw new Error("Invalid team result value");
      return { name, value: row.value };
    });
  }
  if (!finite(total) || !finite(dps) || !Array.isArray(turns) || turns.length > 36) throw new Error("Invalid team battle result");
  return { total, dps, damage: namedRows(damage, 16), actions: namedRows(actions, 12), turns: turns.map(value => {
    const row = object(value), title = text(row?.title, 90);
    if (!Array.isArray(row?.lines) || row.lines.length > 8) throw new Error("Invalid team turn lines");
    return { title, actionPoint: finite(row.actionPoint) ? row.actionPoint : 0, lines: row.lines.map(line => text(line, 260)).filter(Boolean) };
  }) };
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

export async function calculateTeamDamage(runtime: TeamRuntime, roles: readonly TeamRole[], panels: Readonly<Record<string, PanelInput>>,
  promotions: Promotions, cycle: number, enemies: number, cancellation: AbortSignal) {
  cancellation.throwIfAborted();
  const bwrap = Bun.which("bwrap"), node = Bun.which("node");
  if (!bwrap || !node || process.platform !== "linux") throw new TeamDamageError(sandboxMissing);
  const temp = await mkdtemp(join(tmpdir(), "lotus-star-rail-team-"));
  const timeout = AbortSignal.timeout(8_000);
  const signal = AbortSignal.any([cancellation, timeout]);
  let child: ReturnType<typeof Bun.spawn<"pipe", "pipe", "ignore">> | undefined;
  const kill = () => child?.kill("SIGKILL");
  try {
    await mkdir(join(temp, "legacy"));
    for (const [file, bytes] of runtime.files) {
      const dest = join(temp, "legacy", file);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, bytes, { flag: "wx" });
    }
    const worker = await readBounded(fileURLToPath(new URL("./team-damage-worker.mjs", import.meta.url)), 64 * 1024);
    await Promise.all([
      writeFile(join(temp, "legacy/package.json"), '{"type":"module"}', { flag: "wx" }),
      writeFile(join(temp, "worker.mjs"), worker, { flag: "wx" }),
    ]);
    const executable = await realpath(node);
    signal.throwIfAborted();
    child = Bun.spawn([
      bwrap, "--unshare-all", "--die-with-parent", "--clearenv", "--cap-drop", "ALL", "--chdir", "/",
      "--ro-bind", "/usr", "/usr", "--ro-bind-try", "/lib", "/lib", "--ro-bind-try", "/lib64", "/lib64",
      "--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp",
      "--ro-bind", temp, "/job", "--ro-bind", executable, "/runtime/node",
      "/runtime/node", "--max-old-space-size=192", "/job/worker.mjs",
    ], { stdin: "pipe", stdout: "pipe", stderr: "ignore" });
    signal.addEventListener("abort", kill, { once: true });
    if (signal.aborted) kill();
    const bytes = JSON.stringify({ dictionary: runtime.dictionary, roles, panels, promotions, cycle, enemies });
    const childInput = child.stdin;
    const completed = Promise.all([
      readWorkerStream(child.stdout, signal),
      child.exited,
      Promise.resolve().then(() => { childInput.write(bytes); return childInput.end(); }),
    ]);
    const [output, exit] = await completed;
    signal.throwIfAborted();
    if (exit !== 0 || !output) throw new TeamDamageError(sandboxMissing);
    return teamBattleResult(object(JSON.parse(output)));
  } catch (error) {
    if (timeout.aborted && !cancellation.aborted) throw new TeamDamageError("星铁队伍伤害计算超时，请减少轮次后重试。");
    throw error;
  } finally {
    signal.removeEventListener("abort", kill);
    if (child?.exitCode == null) kill();
    await child?.exited;
    await rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}
