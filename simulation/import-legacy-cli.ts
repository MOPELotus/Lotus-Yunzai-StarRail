import { lockFile } from "../../../lib/file-lock.ts";
import { importLegacyWarps } from "./legacy-import.ts";
import { warpStateDirectory } from "./store.ts";

const args = Bun.argv.slice(2);
const apply = args[0] === "--apply";
const [authorizationFile, destinationDirectory = warpStateDirectory(), ...extra] = apply ? args.slice(1) : args;
const sourceUrl = Bun.env.LOTUS_STAR_RAIL_WARP_LEGACY_REDIS_URL?.trim();

if (!authorizationFile || extra.length || !sourceUrl || authorizationFile.startsWith("--") || destinationDirectory.startsWith("--")) {
  console.error("设置 LOTUS_STAR_RAIL_WARP_LEGACY_REDIS_URL 后运行 bun plugins/starrail/simulation/import-legacy-cli.ts [--apply] 授权JSON [模拟存档目录]");
  process.exitCode = 2;
} else {
  try {
    const totals = await importLegacyWarps({ sourceUrl, authorizationFile, destinationDirectory, apply }, lockFile);
    console.log(JSON.stringify({ mode: apply ? "apply" : "preview", ...totals }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "星铁旧模拟迁移失败。");
    process.exitCode = 1;
  }
}
