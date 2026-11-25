import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { gameCommandProfileId, MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { isStarRailGachaLinkMessage, starRailLinkEntry } from "../../lib/private-access.ts";
import { starRailLegacyArchiveTimezone } from "./gacha-files.ts";
import { checkedStarRailLinkRole, readStarRailGachaLink, StarRailGachaLinkError } from "./gacha-link-source.ts";
import type { createStarRailGachaRecordArchive } from "./gacha-record-archive.ts";

const ttl = 120_000;
const names = { "1": $t("gacha-link-command.text_300b6634fe"), "2": $t("gacha-link-command.text_dcfce30c45"), "11": $t("gacha-link-command.text_c47b54e84e"), "12": $t("gacha-link-command.text_e733238b28"), "21": $t("gacha-link-command.text_957dff2ffa"), "22": $t("gacha-link-command.text_7085c8362b") };

type LinkContext = {
  readonly normalizedMessage: string;
  readonly adapter?: string;
  readonly self_id?: number;
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly reply: (text: string) => unknown;
};
type Profiles = Pick<ReturnType<typeof createProfileStore>, "savedRole" | "loginIdentity">;
type Pending = { readonly profileId: number; readonly connection: AbortSignal; readonly expires: number;
  readonly identity: ReturnType<typeof currentIdentity> };

const validId = (id: number | undefined): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

async function currentIdentity(profiles: Profiles, qq: string, profileId: number) {
  const [role, login] = await Promise.all([profiles.savedRole(qq, profileId, "sr"), profiles.loginIdentity(qq, profileId)]);
  return { role: checkedStarRailLinkRole(role), login, timezone: starRailLegacyArchiveTimezone(role) };
}

function failure(error: unknown, profileId: number) {
  if (error instanceof StarRailGachaLinkError) return error.message;
  if (error instanceof ProfileError) {
    if (error.code === "missing" || error.code === "login-required") return $t("gacha-link-command.text_c6002c75a1", { "profileId": profileId });
    if (error.code === "role-missing") return $t("gacha-link-command.text_07944695f9", { "profileId": profileId });
    if (error.code === "changed") return $t("gacha-link-command.text_ca4e1ea242");
  }
  return $t("gacha-link-command.text_ef31b347a7");
}

export function createStarRailGachaLinkCommand(profiles: Profiles,
  archive: Pick<ReturnType<typeof createStarRailGachaRecordArchive>, "merge">, signal: AbortSignal, read = readStarRailGachaLink) {
  const pending = new Map<string, Pending>();
  const running = new Set<string>();
  signal.addEventListener("abort", () => pending.clear(), { once: true });

  return async (context: LinkContext): Promise<string | undefined> => {
    const text = context.normalizedMessage.trim();
    const entry = starRailLinkEntry.exec(text);
    const cancel = text === "取消";
    if (signal.aborted || context.isDelegated || (!entry && !cancel && !isStarRailGachaLinkMessage(text))) return;
    const { adapter, self_id, user_id, message_type, privateCredentialSignal: connection } = context;
    if (message_type !== "private" || !connection || connection.aborted || !validId(self_id) || !validId(user_id)) {
      if (entry) return $t("gacha-link-command.text_84f5292199");
      return;
    }
    const qq = String(user_id);
    const scope = `${adapter ?? "onebot"}:${self_id}:${qq}`;
    if (entry) {
      const profileId = gameCommandProfileId("sr", entry[1]);
      if (profileId > MAX_PROFILE_ID) return $t("gacha-link-command.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
      if (pending.size >= 1024 && !pending.has(scope)) return $t("gacha-link-command.text_8027ec52b5");
      const request = { profileId, connection, expires: performance.now() + ttl, identity: currentIdentity(profiles, qq, profileId) };
      pending.set(scope, request);
      setTimeout(() => { if (pending.get(scope) === request) pending.delete(scope); }, ttl).unref();
      try {
        await request.identity;
        if (!signal.aborted && !connection.aborted && pending.get(scope) === request) {
          return $t("gacha-link-command.text_973f5156cc");
        }
      } catch (error) {
        if (pending.get(scope) !== request) return;
        pending.delete(scope);
        if (!signal.aborted && !connection.aborted) return failure(error, profileId);
      }
      return;
    }

    const request = pending.get(scope);
    if (!request) return cancel ? undefined : $t("gacha-link-command.text_3c2ca6e220");
    pending.delete(scope);
    if (request.connection.aborted || request.expires <= performance.now()) {
      return cancel ? undefined : $t("gacha-link-command.text_69453e497f");
    }
    if (cancel) return $t("gacha-link-command.text_292adf26c3");
    const key = `${qq}:${request.profileId}`;
    if (running.has(key)) return $t("gacha-link-command.text_0d547bd7c5");
    running.add(key);
    const active = AbortSignal.any([signal, connection, request.connection]);
    try {
      const identity = await request.identity;
      const verify = async () => {
        active.throwIfAborted();
        const latest = await currentIdentity(profiles, qq, request.profileId).catch(() => undefined);
        if (latest?.login !== identity.login || latest.role.uid !== identity.role.uid || latest.role.region !== identity.role.region ||
            latest.role.gameBiz !== identity.role.gameBiz) throw new ProfileError("changed", $t("gacha-link-command.text_94511bd511"));
        active.throwIfAborted();
      };
      await verify();
      if (!await context.reply($t("gacha-link-command.text_360e61eae1"))) return;
      const incoming = await read(text, identity.role, active, verify);
      const result = await archive.merge({ qq, uid: identity.role.uid }, incoming, verify, { legacyTimezone: identity.timezone });
      await verify();
      const lines = result.pools.filter(pool => pool.received).map(({ pool, received, added, total }) =>
        $t("gacha-link-command.text_2f5bda5de9", { "value1": names[pool], "received": received, "added": added, "total": total }));
      const suffix = request.profileId === 1 ? "" : request.profileId;
      return [$t("gacha-link-command.text_722e81ab36", { "uid": identity.role.uid }), ...lines, $t("gacha-link-command.text_6321d100a9", { "suffix": suffix })].join("\n");
    } catch (error) {
      if (!active.aborted) return failure(error, request.profileId);
    } finally {
      running.delete(key);
    }
  };
}
