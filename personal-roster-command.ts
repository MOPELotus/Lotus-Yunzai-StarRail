import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { readTheme } from "./panel-card.ts";
import { renderStarRailPersonalRoster } from "./personal-roster-card.ts";
import { buildStarRailPersonalRoster, type RosterCommand } from "./personal-roster-model.ts";

interface RosterContext {
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
}

type Profiles = Pick<ReturnType<typeof createProfileStore>, "requestSelectedContext">;
type Client = Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailPersonalRoster">;

const changed = $t("personal-roster-command.text_1b3721abe9");

export function createStarRailRosterQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal,
  { theme = readTheme, draw = renderStarRailPersonalRoster, now = () => new Date(), qFace = true } = {}) {
  return async function query(context: RosterContext, spec: RosterCommand) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if (context.isDelegated || (context.message_type !== "private" && context.message_type !== "group") ||
      typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return $t("personal-roster-command.text_8b4da19eb2");
    const { mode, profileId } = spec;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return $t("personal-roster-command.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
    const qq = String(user);
    try {
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { revision, ...reply } = await client.fetchStarRailPersonalRoster(source, { includeTalents: true, allowHiddenTalents: mode === "roster", signal });
      async function verify() {
        signal.throwIfAborted();
        const active = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (active?.revision !== revision || active.role.uid !== source.role.uid || active.role.region !== source.role.region ||
          active.role.gameBiz !== source.role.gameBiz) throw new HoyoRequestError("profile-changed", changed);
        signal.throwIfAborted();
      }

      await verify();
      if (!reply.roster.length) return $t("personal-roster-command.text_086ae591cb");
      const availableTheme = await theme();
      const model = await buildStarRailPersonalRoster(reply, source.role, spec, availableTheme, signal, now(), qFace);
      await verify();
      if (!model.rows.length) {
        if (model.week !== undefined && model.week !== 7) {
          return $t("personal-roster-command.text_92af7b1603");
        }
        return $t("personal-roster-command.text_50f9da49dd");
      }
      const title = mode === "roster" ? $t("personal-roster-command.text_7e56820f7d") : $t("personal-roster-command.text_5d9a7000e7");
      const pics = await draw(model, availableTheme.root, "auto", signal).catch(() => undefined);
      await verify();
      const nodes = pics?.map(card => ({ type: "image" as const, file: card.png }));
      if (nodes?.length === 1) return nodes[0]!;
      const heading = $t("personal-roster-command.text_1286aa6d5b", { "uid": model.uid, "title": title, "length": model.rows.length });
      if (nodes?.length) return { type: "forward" as const, nodes: [heading, ...nodes] };
      return [heading, ...model.rows.map(row => [
        row.name, `Lv.${row.level}`, row.rank === undefined ? "" : $t("personal-roster-command.text_c0985f1db5", { "rank": row.rank }),
        mode === "talent" ? `A/E/Q/T ${row.skills.map(skill => skill.level ?? "—").join("/")}`
          : row.cone?.name,
      ].filter(Boolean).join(" · "))].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "changed") return changed;
        if (error.code === "missing" || error.code === "login-required") return $t("personal-roster-command.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("personal-roster-command.text_c0d14d54a7", { "profileId": profileId });
      }
      if (error instanceof HoyoRequestError) return error.code === "profile-changed" ? changed : error.message;
      return $t("personal-roster-command.text_c21c3cb315");
    }
  };
}
