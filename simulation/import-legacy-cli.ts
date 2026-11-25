import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { lockFile } from "../../../lib/file-lock.ts";
import { importLegacyWarps } from "./legacy-import.ts";
import { warpStateDirectory } from "./store.ts";

const args = Bun.argv.slice(2);
const apply = args[0] === "--apply";
const [authorizationFile, destinationDirectory = warpStateDirectory(), ...extra] = apply ? args.slice(1) : args;
const sourceUrl = Bun.env.LOTUS_STAR_RAIL_WARP_LEGACY_REDIS_URL?.trim();

if (!authorizationFile || extra.length || !sourceUrl || authorizationFile.startsWith("--") || destinationDirectory.startsWith("--")) {
  console.error($t("simulation.import-legacy-cli.text_b4866e71ac"));
  process.exitCode = 2;
} else {
  try {
    const totals = await importLegacyWarps({ sourceUrl, authorizationFile, destinationDirectory, apply }, lockFile);
    console.log(JSON.stringify({ mode: apply ? "apply" : "preview", ...totals }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : $t("simulation.import-legacy-cli.text_eb40b425f5"));
    process.exitCode = 1;
  }
}
