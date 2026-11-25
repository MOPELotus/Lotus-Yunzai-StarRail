import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { readOptionalLocalConfig } from "../../lib/config.ts";
import { object } from "./panel-model.ts";
import { ShowcaseError } from "./panel-showcase.ts";

const generatedConfig = "plugins/miao-plugin/config/cfg.js";
const maxLegacyBytes = 64 * 1024;
const invalid = () => new ShowcaseError($t("panel-showcase-config.text_0256c0f4c8"));

function selector(value: unknown) {
  const text = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  if (!/^[0-4]{1,3}$/u.test(text)) throw invalid();
  return text;
}

async function readLegacySelector(root: URL) {
  let handle;
  try {
    handle = await open(new URL(generatedConfig, root), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw invalid();
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxLegacyBytes) throw invalid();
    const bytes = Buffer.alloc(stat.size);
    for (let offset = 0; offset < bytes.length;) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) throw invalid();
      offset += bytesRead;
    }
    const current = await handle.stat();
    if (current.size !== stat.size || current.mtimeMs !== stat.mtimeMs || current.ctimeMs !== stat.ctimeMs) throw invalid();
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\/\*[\s\S]*?\*\//gu, "");
    const rows = source.split(/\r?\n/u).filter(line => /^\s*export\s+const\s+srProfileServer\b/u.test(line));
    if (!rows.length) return;
    const literal = /^\s*export\s+const\s+srProfileServer\s*=\s*(?:(["'])([0-4]{1,3})\1|([0-4]{1,3}))\s*;?\s*(?:\/\/.*)?$/u.exec(rows[0]!);
    if (rows.length !== 1 || !literal) throw invalid();
    return selector(literal[2] ?? literal[3]);
  } catch {
    throw invalid();
  } finally {
    await handle.close();
  }
}

export async function readShowcaseServer(root = new URL("../../", import.meta.url), override = Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER) {
  if (override?.trim()) return selector(override);
  const config = await readOptionalLocalConfig(root, "global").catch(() => { throw invalid(); });
  const preferred = object(config?.starrail)?.showcase_server;
  if (preferred !== undefined) return selector(preferred);
  return await readLegacySelector(root) ?? "0";
}
