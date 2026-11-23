import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { object, readLegacyPanel } from "./panel-model.ts";

const defaultDirectory = fileURLToPath(new URL("../../data/PlayerData/sr/", import.meta.url));
const maxBytes = 8 * 1024 * 1024;

export async function legacySnapshot(uid: string, sampleFile?: string, directory?: string) {
  if (!/^[1-9]\d{8,9}$/u.test(uid)) throw new Error("旧面板档案 UID 无效。");
  const root = resolve(directory ?? (Bun.env.LOTUS_STAR_RAIL_LEGACY_PANEL_DIR?.trim() || defaultDirectory));
  let handle;
  try {
    handle = await open(sampleFile ?? join(root, `${uid}.json`), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxBytes) throw new Error("旧星铁面板档案无效。");
    const bytes = Buffer.alloc(info.size);
    for (let pos = 0; pos < bytes.length;) {
      const { bytesRead } = await handle.read(bytes, pos, bytes.length - pos, pos);
      if (!bytesRead) throw new Error("旧星铁面板档案已变更。");
      pos += bytesRead;
    }
    const current = await handle.stat();
    if (current.size !== info.size || current.mtimeMs !== info.mtimeMs || current.ctimeMs !== info.ctimeMs) {
      throw new Error("旧星铁面板档案已变更。");
    }
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return { snapshot: readLegacyPanel(uid, data), data: object(data)! };
  } finally {
    await handle.close();
  }
}
