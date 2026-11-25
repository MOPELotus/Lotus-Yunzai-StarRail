import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { renderGridFight } from "./grid-fight-card.ts";
import { readGridFightRecentCount } from "./grid-fight-config.ts";
import { gridFightHistoryMax, gridFightText, makeGridFightCard, type GridFightQuery } from "./grid-fight-model.ts";

type Profiles = Pick<ReturnType<typeof createProfileStore>, "requestSelectedContext">;
type Client = Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailGridFight">;
type GridContext = {
  readonly user_id?: number;
  readonly self_id?: number;
  readonly message_type?: string;
  readonly at?: string | number;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
  readonly isNapCat?: (signal: AbortSignal) => Promise<boolean>;
};

// Same measured reverse WebSocket budget as the simulation sender. Account for
// base64 expansion before handing the image or a batch to the adapter.
const oneBotImageBytes = Math.floor((96 * 1024 * 1024 - 4096) / 4) * 3;
type GridImageReply = { readonly type: "image"; readonly file: Uint8Array };
type GridReply = string | GridImageReply;
type Draw = (...args: Parameters<typeof renderGridFight>) => Promise<{ png: Uint8Array }>;

const changed = $t("grid-fight-command.text_8c8f22b6fe");

export function createStarRailGridFightQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal, {
  draw = renderGridFight,
  theme = starRailGachaThemeDirectory,
  recentCount = readGridFightRecentCount,
}: { draw?: Draw; theme?: typeof starRailGachaThemeDirectory; recentCount?: typeof readGridFightRecentCount } = {}) {
  return async function query(context: GridContext, request: GridFightQuery) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if (context.isDelegated || (context.at !== undefined && String(context.at) !== String(context.self_id)) ||
        (context.message_type !== "private" && context.message_type !== "group") ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) {
      return $t("grid-fight-command.text_438eaecfb7");
    }
    const { profileId } = request;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return $t("grid-fight-command.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
    const index = request.mode === "detail" ? request.index : undefined;
    if (index !== undefined && (index < 1 || index > gridFightHistoryMax)) {
      return $t("grid-fight-command.text_eae9b72371", { "gridFightHistoryMax": gridFightHistoryMax });
    }
    const qq = String(user);
    try {
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { revision, brief, records } = await client.fetchStarRailGridFight(source, { signal });
      async function verify() {
        signal.throwIfAborted();
        const current = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (current?.revision !== revision || current.role.uid !== source.role.uid || current.role.region !== source.role.region ||
            current.role.gameBiz !== source.role.gameBiz) throw new HoyoRequestError("profile-changed", changed);
        signal.throwIfAborted();
      }
      await verify();
      if (index !== undefined && index > records.length) return $t("grid-fight-command.text_e7e6459595", { "index": index });
      if (!brief) return $t("grid-fight-command.text_ab936ec6f3");
      const count = request.mode === "recent" ? await recentCount() : undefined;
      const card = makeGridFightCard(source.role.uid, brief, records, index, count);
      if (index !== undefined && !card.battle) return $t("grid-fight-command.text_c51d62bd8f");
      const limit = context.inlineImageByteLimit ?? oneBotImageBytes;
      const directory = theme();
      let napCat: Promise<boolean> | undefined;
      const clientIsNapCat = context.isNapCat;
      const checkNapCat = clientIsNapCat && (() => napCat ??= clientIsNapCat(signal).catch(() => false));
      async function render(model: typeof card): Promise<GridImageReply | undefined> {
        const image = await draw(model, directory, signal, { inlineImageByteLimit: limit, checkNapCat }).catch(() => undefined);
        await verify();
        if (image && image.png.length <= limit) return { type: "image", file: image.png };
      }

      const image = await render(card);
      if (image) return image;
      if (!card.recent || card.recent.length < 2) return gridFightText(card);

      const nodes: GridReply[] = [];
      let mediaBytes = 0;
      for (const entry of card.recent) {
        const page = { ...card, recent: [entry] };
        const rendered = await render(page);
        if (rendered) mediaBytes += rendered.file.byteLength;
        nodes.push(rendered ?? gridFightText(page));
      }
      return { type: "forward" as const, nodes, ...(mediaBytes > limit ? { batchSize: 1 } : {}) };
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "changed") return changed;
        if (error.code === "missing" || error.code === "login-required") return $t("grid-fight-command.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("grid-fight-command.text_c0d14d54a7", { "profileId": profileId });
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        if (error.code === "refresh") return $t("grid-fight-command.text_df42fb73c5");
        return error.message;
      }
      return $t("grid-fight-command.text_9bc33ba76f");
    }
  };
}
