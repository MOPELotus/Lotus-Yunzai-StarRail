import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { mergeStarRailGachaHistory, type StarRailGachaSnapshot } from "./gacha-history.ts";

export function createStarRailGachaHistoryStore(directory: string, acquireLock: AcquireRoleArchiveLock) {
  const files = createRoleJsonArchive(directory, acquireLock, { subject: "星铁抽卡历史", lockSuffix: "lotus-gacha" });
  return {
    read: files.read,
    merge(
      identity: { readonly qq: string; readonly profileId: number },
      latest: StarRailGachaSnapshot,
      verifyProfile: () => Promise<void>,
    ) {
      return files.update({ qq: identity.qq, uid: latest.uid }, verifyProfile, (previous) => {
        const result = mergeStarRailGachaHistory(previous, latest, identity, new Date());
        return { document: result.log, result };
      });
    },
  };
}
