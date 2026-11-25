import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { GameRecordRequestError, HoyoRequestError, starRailChallengeRegion, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import characterNames from "./challenge-character-names.json";
import { renderStarRailAbyss } from "./challenge-card.ts";
import { makeChallengeText, normalizeStarRailChallenge, type ChallengeQuery } from "./challenge-model.ts";
import { readStarRailRecordItems, starRailGachaThemeDirectory } from "./gacha-detail-source.ts";

export async function queryStarRailChallenge(
  qq: string, query: ChallengeQuery, profiles: ReturnType<typeof createProfileStore>,
  client: Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailChallenge">, signal: AbortSignal,
  isNapCat?: (signal: AbortSignal) => Promise<boolean>,
  inlineImageByteLimit?: number, canForward = true,
) {
  const { profileId } = query;
  try {
    const source = await profiles.requestSelectedContext(qq, profileId, "sr");
    const { records, revision } = await client.fetchStarRailChallenge(source, { ...query, signal });
    const region = starRailChallengeRegion(source.role);
    const current = async () => {
      signal.throwIfAborted();
      const latest = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
      return latest !== undefined && latest.revision === revision && latest.role.uid === source.role.uid &&
        region !== undefined && starRailChallengeRegion(latest.role) === region;
    };
    if (!await current()) return $t("challenge.text_1b3721abe9");
    const { uid } = source.role;
    const themeDirectory = starRailGachaThemeDirectory();
    const lookup = await readStarRailRecordItems(themeDirectory).catch(() => undefined);
    const bundledNames: Readonly<Record<string, string>> = characterNames;
    const results = normalizeStarRailChallenge(records, query, (id) => lookup?.(id)?.name || bundledNames[id]);
    async function render(page: typeof results) {
      const checkNapCat = isNapCat && query.period === "recent" && page[0]?.peak.length === 3 ? () => isNapCat(signal) : undefined;
      try {
        const { png } = await renderStarRailAbyss({ uid, results: page }, signal, checkNapCat,
          { themeDirectory, resolveItem: lookup }, inlineImageByteLimit);
        return { type: "image" as const, file: png };
      } catch {
        return makeChallengeText(uid, page);
      }
    }

    const peakHistory = query.period === "recent" && results.length === 1 && results[0]?.kind === "peak" ? results[0] : undefined;
    if (peakHistory && peakHistory.peak.length > 3) {
      if (!canForward) return makeChallengeText(uid, results);
      const history = peakHistory;
      return {
        type: "forward-image-batches" as const,
        batches: (async function* () {
          yield [$t("challenge.text_9b8b41464d", { "uid": uid, "length": history.peak.length })];
          for (let start = 0; start < history.peak.length && !signal.aborted; start += 3) {
            yield [await render([{ ...history, peak: history.peak.slice(start, start + 3) }])];
          }
        })(),
        async beforeSend() {
          if (!await current()) throw new ProfileError("changed", $t("challenge.text_1b3721abe9"));
        },
      };
    }
    const reply = await render(results);
    if (!await current()) return $t("challenge.text_1b3721abe9");
    return reply;
  } catch (error) {
    if (signal.aborted) return;
    if (error instanceof ProfileError) {
      if (error.code === "missing" || error.code === "login-required") return $t("challenge.text_3caf242584", { "profileId": profileId });
      if (error.code === "role-missing") return $t("challenge.text_1ba90781fc", { "profileId": profileId });
      if (error.code === "changed") return $t("challenge.text_1b3721abe9");
    }
    if (error instanceof GameRecordRequestError) return error.message;
    if (error instanceof HoyoRequestError) {
      if (error.code === "profile-changed") return $t("challenge.text_1b3721abe9");
      if (error.code === "refresh") return $t("challenge.text_c7cc58eb23");
      if (error.code === "invalid-input") return $t("challenge.text_d7ac5c0c1c");
      if (error.code === "api" && (error.retcode === 10102 || error.retcode === 5003)) return $t("challenge.text_7e455c400b");
    }
    return $t("challenge.text_390789ffec");
  }
}
