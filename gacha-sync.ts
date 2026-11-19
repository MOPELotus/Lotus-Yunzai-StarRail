import { ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import type { createHoyoClient, StarRailGachaOptions } from "@lotus-yunzai/hoyo-client";
import type { createStarRailGachaHistoryStore } from "./gacha-store.ts";

interface StarRailGachaSyncOptions extends StarRailGachaOptions {
  readonly uid?: string;
}

export function createStarRailGachaSync(
  profiles: Pick<ReturnType<typeof createProfileStore>, "requestContext">,
  client: Pick<ReturnType<typeof createHoyoClient>, "fetchStarRailGacha">,
  history: ReturnType<typeof createStarRailGachaHistoryStore>,
) {
  return {
    async sync(qq: string, profileId = 1, { uid, ...options }: StarRailGachaSyncOptions = {}) {
      const original = await profiles.requestContext(qq, profileId, "sr", uid);
      const latest = await client.fetchStarRailGacha(original, options);
      if (latest.uid !== original.role.uid) throw new Error("星铁抽卡快照与请求角色不一致。");

      async function verifyProfile() {
        options.signal?.throwIfAborted();
        const current = await profiles.requestContext(qq, profileId, "sr", latest.uid).catch(() => undefined);
        if (current?.revision !== latest.revision || current?.role.uid !== latest.uid) {
          throw new ProfileError("changed", "更新星铁抽卡历史时档案已变更，请重新发起请求。");
        }
        options.signal?.throwIfAborted();
      }

      const result = await history.merge({ qq, profileId }, latest, verifyProfile);
      return { ...result, refreshedCookie: latest.refreshedCookie };
    },
  };
}
