import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { renderGridFight } from "./grid-fight-card.ts";
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
};

const changed = "星铁档案已变更，请重新查询货币战争。";

export function createStarRailGridFightQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal, {
  draw = renderGridFight,
  theme = starRailGachaThemeDirectory,
} = {}) {
  return async function query(context: GridContext, request: GridFightQuery) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if (context.isDelegated || (context.at !== undefined && String(context.at) !== String(context.self_id)) ||
        (context.message_type !== "private" && context.message_type !== "group") ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) {
      return "货币战争只查询本人已登录档案，请在 QQ 会话直接发送指令。";
    }
    const { profileId } = request;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    const index = request.mode === "detail" ? request.index : undefined;
    if (index !== undefined && (index < 1 || index > gridFightHistoryMax)) {
      return `货币战争战绩编号须为 1–${gridFightHistoryMax}。`;
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
      if (index !== undefined && index > records.length) return `未找到货币战争第 ${index} 条记录。`;
      if (!brief) return "该档案尚无米游社货币战争战绩。";
      const card = makeGridFightCard(source.role.uid, brief, records, index);
      if (index !== undefined && !card.battle) return "米游社未返回此场货币战争的完整战绩。";
      const image = await draw(card, theme(), signal).catch(() => undefined);
      await verify();
      return image && (context.inlineImageByteLimit === undefined || image.png.length <= context.inlineImageByteLimit)
        ? { type: "image" as const, file: image.png }
        : gridFightText(card);
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "changed") return changed;
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        if (error.code === "refresh") return "货币战争战绩的 Cookie 未能续期，请检查当前档案登录状态。";
        return error.message;
      }
      return "星铁货币战争战绩暂时无法读取，请稍后重试。";
    }
  };
}
