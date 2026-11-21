import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("队伤引擎预检拒绝缺失角色时清除已启动的旧计时器", async () => {
  const root = await mkdtemp(join(tmpdir(), "lotus-team-worker-test-"));
  try {
    const old = join(root, "legacy/services/starRailTeamDamage");
    await mkdir(old, { recursive: true });
    await Promise.all([
      Bun.write(join(root, "worker.mjs"), Bun.file(new URL("../team-damage-worker.mjs", import.meta.url))),
      Bun.write(join(root, "legacy/package.json"), '{"type":"module"}'),
      Bun.write(join(old, "engine.js"), `
        export class StarRailDpsEngine {
          async ensureLoaded() { this.timer = setInterval(() => {}, 100); }
          defaultModule() { return [{ item_id: 8006 }]; }
          calculate() { throw new Error("Unsupported role reached simulator"); }
          clearTimers() { clearInterval(this.timer); }
        }
      `),
    ]);
    const child = Bun.spawn([process.execPath, join(root, "worker.mjs")], {
      stdin: new Blob([JSON.stringify({ roles: [{ item_id: 8005 }] })]), stdout: "pipe", stderr: "inherit",
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 1500);
    try {
      expect(await new Response(child.stdout).json()).toEqual({ error: "unsupported", roleId: 8005 });
      expect(await child.exited).toBe(0);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null) child.kill("SIGKILL");
      await child.exited;
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
