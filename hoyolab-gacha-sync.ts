import { createTranslator } from "../../packages/i18n/index.ts";
import catalog from "./i18n/zh-CN.json";
import { ProfileError, type ProfileRequestContext, type createProfileStore } from "@lotus-yunzai/account";
import { starRailGachaPools, type createHoyoClient, type StarRailGachaOptions } from "@lotus-yunzai/hoyo-client";
import type { createStarRailGachaRecordArchive } from "./gacha-record-archive.ts";
import { checkedStarRailLinkRole, readStarRailGachaLink, StarRailGachaLinkError } from "./gacha-link-source.ts";
const $t = createTranslator("starrail", catalog.messages);

export class HoYoLabStarRailAuthKeyRejected extends Error {
  constructor() { super($t('hoyolab-gacha-sync.authkey-rejected')); }
}

export async function syncHoYoLabStarRailGacha(original: ProfileRequestContext,
  profiles: Pick<ReturnType<typeof createProfileStore>, "requestContext">,
  client: Pick<ReturnType<typeof createHoyoClient>, "fetchHoYoLabGachaLink">,
  archive: ReturnType<typeof createStarRailGachaRecordArchive>, options: StarRailGachaOptions,
  transport?: NonNullable<Parameters<typeof readStarRailGachaLink>[4]>["transport"]) {
  const { qq, profileId } = original;
  const latest = await client.fetchHoYoLabGachaLink(original, options);
  const signal = options.signal ?? new AbortController().signal;
  const verify = async () => {
    signal.throwIfAborted();
    const current = await profiles.requestContext(qq, profileId, "sr", original.role.uid);
    if (current.revision !== latest.revision || current.role.region !== latest.region) {
      throw new ProfileError("changed", $t("gacha-sync.text_561966cbbe"));
    }
  };
  const incoming = await readStarRailGachaLink(latest.url.href, checkedStarRailLinkRole(original.role), signal, verify,
    { transport: transport, intervalMs: options.intervalMs }).catch(error => {
      if (error instanceof StarRailGachaLinkError && error.reason === 'authkey-rejected') {
        throw new HoYoLabStarRailAuthKeyRejected();
      }
      throw error;
    });
  const old = await archive.read({ qq, uid: latest.uid }, { legacyTimezone: incoming.timezone });
  const known = new Set(old.status === "available" ? old.archive.records.map(row => row.id) : []);
  const result = await archive.merge({ qq, uid: latest.uid }, incoming, verify, { legacyTimezone: incoming.timezone });
  const types = { "11": "GachaType_AvatarUp", "12": "GachaType_EquipmentUp", "21": "GachaType_CollabAvatarUp",
    "22": "GachaType_CollabEquipmentUp", "1": "GachaType_Standard", "2": "GachaType_Newbie" } as const;
  const pools = result.pools.map(pool => {
    const rows = result.archive.records.filter(row => row.gacha_type === pool.pool).sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1);
    const fiveStars = rows.filter(row => row.rank_type === "5");
    const index = rows.findIndex(row => row.rank_type === "5");
    return { type: types[pool.pool], name: starRailGachaPools[types[pool.pool]], total: fiveStars.length,
      added: fiveStars.filter(row => !known.has(row.id)).length, totalDraws: rows.length, pity: index < 0 ? rows.length : index };
  });
  return { log: { qq, uid: latest.uid, profileId, updatedAt: new Date().toISOString() }, pools,
    added: pools.reduce((sum, pool) => sum + pool.added, 0), refreshedCookie: latest.refreshedCookie };
}
