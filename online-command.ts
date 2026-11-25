import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { fileURLToPath } from "node:url";
import { gameRegionDisplayName, MAX_PROFILE_ID, ProfileError, type createProfileStore, type GameRole } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient, type StarRailPowerRecovery } from "@lotus-yunzai/hoyo-client";
import { renderStarRailOnlineCard } from "./account-report-renderer.ts";
import { text } from "./panel-model.ts";
import { starRailOnlineReport } from "./online-model.ts";

export const starRailOnlineCommand = /^(?:#星铁|\*|＊|[#*]?sr)\s*在线(?:时长)?(?:统计|分析)?(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;
const theme = new URL("./monthly-theme/online/", import.meta.url);
const note = $t("online-command.text_844f4c40f7");

export function makeStarRailOnlineCard(role: GameRole, recoveries: readonly StarRailPowerRecovery[], complete: boolean, now = new Date()) {
  const report = starRailOnlineReport(recoveries, now);
  if (!report) return;
  return {
    ...report, complete, note, tplFile: fileURLToPath(new URL("online.html", theme)), css: new URL("online.css", theme).href,
    logo: new URL("logo.png", theme).href, pamu: new URL("pamu.png", theme).href, uid: role.uid,
    nickname: text(role.nickname, 30) || $t("online-command.text_865ee04ffd"),
    region: gameRegionDisplayName("sr", role.region, text(role.regionName, 20)),
    level: text(String(role.level ?? ""), 8),
    cardBrand: "Lotus-Yunzai · StarRail", imgType: "png" as const, viewport: { width: 820, height: 1800 }, scale: 1,
  };
}

interface Context {
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
}

export function createStarRailOnlineQuery(profiles: ReturnType<typeof createProfileStore>,
  client: ReturnType<typeof createProfileHoyoClient>, lifecycle: AbortSignal) {
  const changed = $t("online-command.text_f8591d14d8");
  return async function query(context: Context, profileId: number) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if ((context.message_type !== "private" && context.message_type !== "group") || context.isDelegated ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return $t("online-command.text_ed7b06a749");
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return $t("online-command.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
    try {
      const qq = String(user);
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { recoveries, complete, revision } = await client.fetchStarRailOnline(source, { signal });
      async function verify() {
        signal.throwIfAborted();
        const active = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (active?.revision !== revision || active.role.uid !== source.role.uid ||
            active.role.region !== source.role.region || active.role.gameBiz !== source.role.gameBiz) {
          throw new HoyoRequestError("profile-changed", changed);
        }
        signal.throwIfAborted();
      }
      await verify();
      const model = makeStarRailOnlineCard(source.role, recoveries, complete);
      if (!model) return complete ? $t("online-command.text_79726120e7") : $t("online-command.text_500738fd6e");
      const image = await renderStarRailOnlineCard(model, { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
      await verify();
      const picture = image?.png;
      return picture ? { type: "image" as const, file: picture } : [
        $t("online-command.text_ba3b14c2ee", { "uid": model.uid }), ...model.bars.map(bar => $t("online-command.text_223db1cc64", { "date": bar.date, "hours": bar.hours })), note,
        ...(!complete ? [$t("online-command.text_e16c1c65b9")] : []),
      ].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return $t("online-command.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("online-command.text_c0d14d54a7", { "profileId": profileId });
        if (error.code === "changed") return changed;
      }
      if (error instanceof HoyoRequestError) return error.code === "profile-changed" ? changed : error.message;
      return $t("online-command.text_2ad540dd74");
    }
  };
}
