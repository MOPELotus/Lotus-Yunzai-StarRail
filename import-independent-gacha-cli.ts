import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { link, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { isChatFileName, maxChatFileBytes } from "../../lib/chat-files.ts";
import { prepareIndependentStarRailGachaImport, StarRailGachaArchiveError } from "./gacha-record-archive.ts";

const [source, uid, offset, destination, ...extra] = Bun.argv.slice(2);

if (!source || !uid || !offset || !destination || extra.length || [source, destination].some(arg => arg.startsWith("--")) ||
    !/^[+-]?\d+(?:\.\d+)?$/u.test(offset) || !isChatFileName(basename(destination)) || !/\.json$/iu.test(basename(destination))) {
  console.error($t("import-independent-gacha-cli.text_cefe5c224f"));
  process.exitCode = 2;
} else {
  try {
    const [sourceRoot, outputParent] = await Promise.all([realpath(source), realpath(dirname(destination))]);
    const child = relative(sourceRoot, outputParent);
    if (!(isAbsolute(child) || child === ".." || child.startsWith(".." + sep))) {
      throw new Error($t("import-independent-gacha-cli.text_30e17420ae"));
    }
    const { document, count } = await prepareIndependentStarRailGachaImport(source, uid, Number(offset));
    const content = Buffer.from(JSON.stringify(document) + "\n");
    if (content.length > maxChatFileBytes) throw new Error($t("import-independent-gacha-cli.text_0d8946ed49"));
    const temporary = await mkdtemp(join(outputParent, ".starrail-uigf-"));
    try {
      const staged = join(temporary, "archive.json");
      await writeFile(staged, content, { flag: "wx", mode: 0o600, flush: true });
      await link(staged, join(outputParent, basename(destination)));
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    console.log($t("import-independent-gacha-cli.text_c1abe47be7", { "count": count }));
  } catch (error) {
    console.error(error instanceof StarRailGachaArchiveError || error instanceof TypeError
      ? error.message
      : (error as NodeJS.ErrnoException)?.code === "EEXIST" ? $t("import-independent-gacha-cli.text_5eb4aa253d")
        : error instanceof Error && !("code" in error) ? error.message : $t("import-independent-gacha-cli.text_2ea4962688"));
    process.exitCode = 1;
  }
}
