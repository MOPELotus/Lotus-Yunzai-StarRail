import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { renderTemplate } from "../../lib/renderer/shotium.ts";
import { makeStarRailMonthlyCard, starRailMonthlyText } from "./monthly-card.ts";

export const starRailMonthlyCommand = /^(?:#星铁|\*|＊|[#*]?sr)\s*(?:星琼获取|月历|月收入|收入|原石)(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;

interface MonthlyContext {
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
}

export function createStarRailMonthlyQuery(profiles: ReturnType<typeof createProfileStore>,
  client: ReturnType<typeof createProfileHoyoClient>, signal: AbortSignal) {
  const changed = "星铁档案已变更，请重新查询月收入。";
  async function selectedRole(qq: string, profileId: number) {
    const before = await profiles.requestContext(qq, profileId, "sr");
    const selected = await profiles.savedRole(qq, profileId, "sr");
    const source = await profiles.requestContext(qq, profileId, "sr", selected.uid);
    if (before.revision !== source.revision) throw new ProfileError("changed", changed);
    if (!source.role.region || !source.role.gameBiz || source.role.region !== selected.region || source.role.gameBiz !== selected.gameBiz) {
      throw new ProfileError("role-missing", "档案没有已同步的星铁角色。");
    }
    return source;
  }

  return async function query(context: MonthlyContext, profileId: number) {
    const user = context.user_id;
    if ((context.message_type !== "private" && context.message_type !== "group") || context.isDelegated ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) {
      return "请从本人 QQ 会话查询星铁月收入。";
    }
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    const qq = String(user);
    try {
      const source = await selectedRole(qq, profileId);
      const { snapshot, revision } = await client.fetchStarRailMonthly(source, { signal });
      const verify = async () => {
        signal.throwIfAborted();
        const active = await selectedRole(qq, profileId).catch(() => undefined);
        if (active?.revision !== revision || active.role.uid !== source.role.uid ||
            active.role.region !== source.role.region || active.role.gameBiz !== source.role.gameBiz) {
          throw new HoyoRequestError("profile-changed", changed);
        }
      };
      await verify();
      if (!snapshot) return "暂无星铁月收入数据。";
      const pictures = await renderTemplate(makeStarRailMonthlyCard(snapshot)).catch(() => false as const);
      await verify();
      const image = pictures && pictures[0];
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
