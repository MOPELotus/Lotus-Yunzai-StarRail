import { fileURLToPath } from "node:url";
import { MAX_PROFILE_ID, ProfileError, type createProfileStore, type GameRole } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient, type StarRailPowerRecovery } from "@lotus-yunzai/hoyo-client";
import { renderStarRailOnlineCard } from "./account-report-renderer.ts";
import { text } from "./panel-model.ts";
import { starRailOnlineReport } from "./online-model.ts";

export const starRailOnlineCommand = /^(?:#星铁|\*|＊|[#*]?sr)\s*在线(?:时长)?(?:统计|分析)?(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;
const theme = new URL("./monthly-theme/online/", import.meta.url);
const note = "数据由米游社开拓力回复推算估计，不保证准确性，仅供参考";

export function makeStarRailOnlineCard(role: GameRole, recoveries: readonly StarRailPowerRecovery[], complete: boolean, now = new Date()) {
  const report = starRailOnlineReport(recoveries, now);
  if (!report) return;
  return {
    ...report, complete, note, tplFile: fileURLToPath(new URL("online.html", theme)), css: new URL("online.css", theme).href,
    logo: new URL("logo.png", theme).href, pamu: new URL("pamu.png", theme).href, uid: role.uid,
    nickname: text(role.nickname, 30) || "开拓者",
    region: text(role.regionName, 20) || (role.region === "prod_qd_cn" ? "国服 B 服" : "国服"),
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
  const changed = "星铁档案已变更，请重新查询在线时长。";
  return async function query(context: Context, profileId: number) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if ((context.message_type !== "private" && context.message_type !== "group") || context.isDelegated ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return "请从本人 QQ 会话查询星铁在线时长。";
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
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
      if (!model) return complete ? "暂无可用于估算在线时长的开拓力恢复记录。" : "已达到查询页数上限，暂无可用于估算的开拓力恢复记录。";
      const image = await renderStarRailOnlineCard(model, { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
      await verify();
      const picture = image?.png;
      return picture ? { type: "image" as const, file: picture } : [
        `UID ${model.uid} · 近期每日在线时长（估算）`, ...model.bars.map(bar => `${bar.date} · ${bar.hours} 小时`), note,
        ...(!complete ? ["已达到查询页数上限，仅显示本次读取的记录。"] : []),
      ].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
        if (error.code === "changed") return changed;
      }
      if (error instanceof HoyoRequestError) return error.code === "profile-changed" ? changed : error.message;
      return "查询星铁在线时长失败，请稍后重试。";
    }
  };
}
