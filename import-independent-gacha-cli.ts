import { link, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { isChatFileName, maxChatFileBytes } from "../../lib/chat-files.ts";
import { prepareIndependentStarRailGachaImport, StarRailGachaArchiveError } from "./gacha-record-archive.ts";

const [source, uid, offset, destination, ...extra] = Bun.argv.slice(2);

if (!source || !uid || !offset || !destination || extra.length || [source, destination].some(arg => arg.startsWith("--")) ||
    !/^[+-]?\d+(?:\.\d+)?$/u.test(offset) || !isChatFileName(basename(destination)) || !/\.json$/iu.test(basename(destination))) {
  console.error("用法：bun plugins/starrail/import-independent-gacha-cli.ts <旧 data/gatcha 根目录> <UID> <时区偏移> <新 UIGF .json 路径>");
  process.exitCode = 2;
} else {
  try {
    const [sourceRoot, outputParent] = await Promise.all([realpath(source), realpath(dirname(destination))]);
    const child = relative(sourceRoot, outputParent);
    if (!(isAbsolute(child) || child === ".." || child.startsWith(".." + sep))) {
      throw new Error("请将 UIGF 文件输出到旧档案以外的目录。");
    }
    const { document, count } = await prepareIndependentStarRailGachaImport(source, uid, Number(offset));
    const content = Buffer.from(JSON.stringify(document) + "\n");
    if (content.length > maxChatFileBytes) throw new Error("UIGF 文件超过聊天附件导入大小上限。");
    const temporary = await mkdtemp(join(outputParent, ".starrail-uigf-"));
    try {
      const staged = join(temporary, "archive.json");
      await writeFile(staged, content, { flag: "wx", mode: 0o600, flush: true });
      await link(staged, join(outputParent, basename(destination)));
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
    console.log(`已生成 ${count} 条星铁逐抽记录。请先私聊发送 *导入记录，再上传生成的 JSON。`);
  } catch (error) {
    console.error(error instanceof StarRailGachaArchiveError || error instanceof TypeError
      ? error.message
      : (error as NodeJS.ErrnoException)?.code === "EEXIST" ? "目标文件已存在，请指定新文件。"
        : error instanceof Error && !("code" in error) ? error.message : "无法读取独立旧档或生成 UIGF 文件。");
    process.exitCode = 1;
  }
}
