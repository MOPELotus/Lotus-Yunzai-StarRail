import { renderStatusCard, type StatusCardOptions } from "@lotus-yunzai/skia/status-card";
import type { createStarRailGachaSync } from "./gacha-sync.ts";

type GachaSyncResult = Awaited<ReturnType<ReturnType<typeof createStarRailGachaSync>["sync"]>>;
type GachaCardResult = Pick<GachaSyncResult, "pools"> & {
  readonly log: Pick<GachaSyncResult["log"], "qq" | "uid" | "profileId" | "updatedAt">;
};

const title = "星铁抽卡记录";
const defaultMessage = "已通过官方小程序接口更新五星和抽数；重复更新会按记录 ID 合并，不会叠加。";
const failureMessages = {
  "rate-limited": "访问过于频繁，请稍后再试。",
  "profile-changed": "更新星铁抽卡历史时档案已变更，请重新发起请求。",
  "request-failed": "星铁抽卡记录更新失败。",
} as const;

interface GachaCardFailure {
  readonly qq: string;
  readonly profileId: number;
  readonly reason?: keyof typeof failureMessages;
  readonly at?: Date;
}

export function renderStarRailGachaResult({ log, pools }: GachaCardResult, options: StatusCardOptions = {}) {
  const lead = `QQ ${log.qq} · Profile ${log.profileId} · UID ${log.uid}\n${defaultMessage}`;
  const visiblePools = pools.filter(({ total, totalDraws }) => total || totalDraws);
  const contents = visiblePools.length ? visiblePools.map(({ name, total, added, totalDraws, pity }) =>
    `${name}：五星 ${total}（新增 ${added}）· 已抽 ${totalDraws} · 当前垫 ${pity}`) : ["记录：当前没有可用抽卡数据"];
  return renderStatusCard(title, lead, contents, new Date(log.updatedAt), options);
}

export function renderStarRailGachaFailure(
  { qq, profileId, reason = "request-failed", at = new Date() }: GachaCardFailure, options: StatusCardOptions = {},
) {
  const lead = `QQ ${qq} · Profile ${profileId}\n${failureMessages[reason]}`;
  return renderStatusCard(title, lead, [
    "阶段：profile Cookie / 星铁官方活动接口",
    "建议：检查 profile 登录状态与星铁 UID；无需 authkey。",
  ], at, options);
}
