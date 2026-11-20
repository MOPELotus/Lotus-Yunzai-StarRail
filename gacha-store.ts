import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { mergeStarRailGachaHistory, type StarRailGachaSnapshot } from "./gacha-history.ts";

export function createStarRailGachaHistoryStore(directory: string, acquireLock: AcquireRoleArchiveLock,
  legacyDirectories: readonly string[] = [],
) {
  const files = createRoleJsonArchive(directory, acquireLock, { subject: "星铁抽卡历史", lockSuffix: "lotus-gacha" });
  const sourcePaths = new Set(legacyDirectories.map(path => resolve(path)));
  sourcePaths.delete(resolve(directory));
  const sources = [...sourcePaths].map(path => createRoleJsonArchive(path, acquireLock, {
    subject: "旧星铁抽卡历史", lockSuffix: "lotus-gacha", maxBytes: 32 * 1024 * 1024, rejectNull: true,
  }));

  async function readLegacy(qq: string, uid: string): Promise<unknown> {
    let previous: unknown = null;
    for (const source of sources) {
      const value = await source.read(qq, uid);
      if (value === null) continue;
      if (typeof value !== "object" || Array.isArray(value) ||
          !("qq" in value) || value.qq !== qq || !("uid" in value) || value.uid !== uid ||
          !("version" in value) || value.version !== 1) {
        throw new Error("旧星铁抽卡记录版本或身份不一致。");
      }
      if (previous !== null && !isDeepStrictEqual(previous, value)) {
        throw new Error("两个旧安装目录的星铁抽卡记录不一致。");
      }
      previous = value;
    }
    return previous;
  }

  return {
    read: files.read,
    readLegacy,
    merge(
      identity: { readonly qq: string; readonly profileId: number },
      latest: StarRailGachaSnapshot,
      verifyProfile: () => Promise<void>,
    ) {
      return files.update({ qq: identity.qq, uid: latest.uid }, verifyProfile, async (previous) => {
        const history = previous ?? await readLegacy(identity.qq, latest.uid);
        const result = mergeStarRailGachaHistory(history, latest, identity, new Date());
        return { document: result.log, result };
      });
    },
  };
}
