import { MissingTemplate } from "./native/compile/library.ts";
import { nativeMechanics } from "./native/mechanics/index.ts";
import { BattleRunner, reportBattle } from "./native/runner/index.ts";
import { compileWorkerBuild, type WorkerBuildRequest } from "./native/worker-build.ts";

const INPUT_LIMIT = 512 * 1024;

async function readRequest(): Promise<WorkerBuildRequest | undefined> {
  const reader = Bun.stdin.stream().getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > INPUT_LIMIT) return undefined;
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const input = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, size));
  const request = JSON.parse(input) as WorkerBuildRequest;
  if (!Array.isArray(request?.roles) || request.roles.some(role => typeof role?.id !== "string")) {
    throw new TypeError("Invalid team members");
  }
  return request;
}

async function run(): Promise<void> {
  try {
    const request = await readRequest();
    if (!request) {
      console.error("Invalid team request");
      process.exitCode = 1;
      return;
    }
    const { encounter, panelCalibration, notices } = await compileWorkerBuild(request);
    const battle = new BattleRunner(encounter, nativeMechanics({
      panelCalibration,
      diagnose: warning => console.error(warning),
    }));
    battle.run();
    const response = reportBattle(battle, request.cycle, notices);
    if ("total" in response && (!Number.isFinite(response.total)
      || response.damage.some(row => !Number.isFinite(row.value)))) throw new TypeError("Invalid team report");
    console.log(JSON.stringify(response));
  } catch (error) {
    if (error instanceof MissingTemplate && (error.kind === "characters" || error.kind === "light_cones")) {
      console.log(JSON.stringify({ error: error.kind, id: error.id }));
    } else if (error instanceof TypeError || error instanceof SyntaxError || error instanceof RangeError) {
      console.log(JSON.stringify({ error: "invalid" }));
    } else if (error instanceof MissingTemplate || (error instanceof Error && "code" in error && error.code === "ENOENT")) {
      console.log(JSON.stringify({ error: "data" }));
    } else {
      console.error(error);
      process.exitCode = 1;
    }
  }
}

await run();
