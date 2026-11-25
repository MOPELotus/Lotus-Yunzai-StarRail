import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import type { createHoyoClient, StarRailGachaOptions } from "@lotus-yunzai/hoyo-client";
import type { createStarRailGachaHistoryStore } from "./gacha-store.ts";

interface StarRailGachaSyncOptions extends StarRailGachaOptions {
  readonly uid?: string;
}

export class StarRailGachaUpdateBusy extends Error {
  constructor() { super($t("gacha-sync.text_de583dfe2b")); }
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
        if (latest.uid !== original.role.uid) throw new Error($t("gacha-sync.text_57d3d2be9d"));

        async function verifyProfile() {
          options.signal?.throwIfAborted();
          const current = await profiles.requestContext(qq, profileId, "sr", latest.uid).catch(() => undefined);
          if (current?.revision !== latest.revision || current?.role.uid !== latest.uid) {
            throw new ProfileError("changed", $t("gacha-sync.text_561966cbbe"));
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
