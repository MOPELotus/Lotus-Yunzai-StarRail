import { ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import type { createHoyoClient, StarRailGachaOptions } from "@lotus-yunzai/hoyo-client";
import type { createStarRailGachaHistoryStore } from "./gacha-store.ts";

interface StarRailGachaSyncOptions extends StarRailGachaOptions {
  readonly uid?: string;
}

export class StarRailGachaUpdateBusy extends Error {
  constructor() { super("该账号的星铁抽卡记录正在更新，请稍后再试。"); }
}

export function createStarRailGachaSync(
  profiles: Pick<ReturnType<typeof createProfileStore>, "requestContext">,
  client: Pick<ReturnType<typeof createHoyoClient>, "fetchStarRailGacha">,
  history: ReturnType<typeof createStarRailGachaHistoryStore>,
) {
  const active = new Set<string>();
  return {
    async sync(qq: string, profileId = 1, { uid, ...options }: StarRailGachaSyncOptions = {}) {
      const original = await profiles.requestContext(qq, profileId, "sr", uid);
      const key = `${qq}/${original.role.uid}`;
      options.signal?.throwIfAborted();
      if (active.has(key)) throw new StarRailGachaUpdateBusy();
      active.add(key);
      try {
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
      } finally {
        active.delete(key);
      }
    },
  };
}
