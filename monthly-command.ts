import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { renderStarRailMonthlyCard } from "./account-report-renderer.ts";
import { makeStarRailMonthlyCard, starRailMonthlyText } from "./monthly-card.ts";

export const starRailMonthlyCommand = /^(?:#星铁|\*|＊|[#*]?sr)\s*(?:星琼获取|月历|月收入|收入|原石)(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;

interface MonthlyContext {
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
}

export function createStarRailMonthlyQuery(profiles: ReturnType<typeof createProfileStore>,
  client: ReturnType<typeof createProfileHoyoClient>, lifecycle: AbortSignal) {
  const changed = "星铁档案已变更，请重新查询月收入。";

  return async function query(context: MonthlyContext, profileId: number) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if ((context.message_type !== "private" && context.message_type !== "group") || context.isDelegated ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) {
      return "请从本人 QQ 会话查询星铁月收入。";
    }
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    const qq = String(user);
    try {
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { snapshot, revision } = await client.fetchStarRailMonthly(source, { signal });
      const verify = async () => {
        signal.throwIfAborted();
        const active = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (active?.revision !== revision || active.role.uid !== source.role.uid ||
            active.role.region !== source.role.region || active.role.gameBiz !== source.role.gameBiz) {
          throw new HoyoRequestError("profile-changed", changed);
        }
        signal.throwIfAborted();
      };
      await verify();
      if (!snapshot) return "暂无星铁月收入数据。";
      const picture = await renderStarRailMonthlyCard(makeStarRailMonthlyCard(snapshot), {
        inlineImageByteLimit: context.inlineImageByteLimit,
      }).catch(() => undefined);
      await verify();
      const image = picture?.png;
      return image ? { type: "image" as const, file: image } : starRailMonthlyText(snapshot);
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
        if (error.code === "changed") return changed;
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        return error.message;
      }
      return "获取星铁月收入失败，请稍后重试。";
    }
  };
}
