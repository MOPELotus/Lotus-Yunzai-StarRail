import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { gameCommandProfileId, MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, defaultStarRailGrowthLevels, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { resolveStarRailCharacter } from "../rank-statistics.ts";
import { renderStarRailGrowth, starRailGrowthText } from "./card.ts";

const prefix = /^(?:#?星铁|[*＊])\s*/u;
const body = /^(?<name>[\p{L}\p{N}·・•&★ _.-]{1,36}?)\s*(?:养成计算|养成|计算)\s*(?<levels>[0-9,，\s]*)(?:档案\s*(?<profile>\d{1,3}))?$/u;
const help = $t("growth.command.text_3039cbe2be");
const changed = $t("growth.command.text_7612b174a6");
export function matchStarRailGrowth(message: string) {
  const mark = prefix.exec(message);
  const fields = mark && body.exec(message.slice(mark[0].length).trim())?.groups;
  if (!fields?.name) return;
  const name = fields.name.trim();
  if (name === "角色") return { mode: "help" } as const;
  const input = fields.levels!.split(/[\s,，]+/u).filter(Boolean);
  const profileId = gameCommandProfileId("sr", fields.profile);
  if (!name || input.length > defaultStarRailGrowthLevels.length || profileId < 1 || profileId > MAX_PROFILE_ID ||
      input.some(value => !/^\d{1,3}$/u.test(value) || Number(value) < 1)) return { mode: "invalid" } as const;
  return { mode: "calculate", name, profileId,
    levels: defaultStarRailGrowthLevels.map((value, i) => Math.min(value, Number(input[i] ?? value))) } as const;
}

type Profiles = Pick<ReturnType<typeof createProfileStore>, "requestSelectedContext">;
type Client = Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailGrowth">;
type Render = (...args: Parameters<typeof renderStarRailGrowth>) => Promise<{ readonly png: Uint8Array }>;
type Context = { readonly message_type?: string; readonly user_id?: number; readonly self_id?: number; readonly at?: number | string;
  readonly isDelegated?: boolean; readonly privateCredentialSignal?: AbortSignal; readonly groupActivitySignal?: AbortSignal;
  readonly inlineImageByteLimit?: number };
type Query = NonNullable<ReturnType<typeof matchStarRailGrowth>>;

export function createStarRailGrowthQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal,
  { resolve = resolveStarRailCharacter, render = renderStarRailGrowth }: { resolve?: typeof resolveStarRailCharacter; render?: Render } = {}) {
  return async (context: Context, query: Query) => {
    if (lifecycle.aborted) return [];
    if (query.mode !== "calculate") return help;
    const connection = context.message_type === "private" ? context.privateCredentialSignal :
      context.message_type === "group" ? context.groupActivitySignal : undefined;
    const user = context.user_id;
    if (!connection || context.isDelegated || (context.at !== undefined && String(context.at) !== String(context.self_id)) ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) {
      return $t("growth.command.text_79f84d7379");
    }
    const signal = AbortSignal.any([lifecycle, connection]);
    if (signal.aborted) return [];
    const qq = String(user);
    const { profileId } = query;
    try {
      const role = await resolve(query.name);
      if (!role) return signal.aborted ? [] : $t("growth.command.text_eca02dc851");
      if (role.id === 20000000 || role.id >= 8000 && role.id <= 8099) return $t("growth.command.text_b1c9bd20eb");
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      const model = await client.fetchStarRailGrowth(source, { avatarId: role.id, name: role.name, levels: query.levels, signal });
      async function verify() {
        signal.throwIfAborted();
        const current = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (model.uid !== source.role.uid || current?.revision !== model.revision || current.role.uid !== source.role.uid ||
            current.role.region !== source.role.region || current.role.gameBiz !== source.role.gameBiz) {
          throw new HoyoRequestError("profile-changed", changed);
        }
        signal.throwIfAborted();
      }
      await verify();
      const image = await render(model, signal, { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
      await verify();
      if (image && image.png.byteLength <= (context.inlineImageByteLimit ?? Infinity)) return { type: "image" as const, file: image.png };
      return starRailGrowthText(model);
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "changed") return changed;
        if (error.code === "missing" || error.code === "login-required") return $t("growth.command.text_76720712c8", { "profileId": query.profileId });
        if (error.code === "role-missing") return $t("growth.command.text_c0d14d54a7", { "profileId": query.profileId });
      }
      if (error instanceof HoyoRequestError) return error.code === "profile-changed" ? changed : error.message;
      return $t("growth.command.text_3c31c3029a");
    }
  };
}
