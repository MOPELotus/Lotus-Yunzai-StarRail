import { renderStatusCard, type StatusCardOptions } from "@lotus-yunzai/skia/status-card";
import type { createStarRailGachaSync } from "./gacha-sync.ts";

type GachaSyncResult = Awaited<ReturnType<ReturnType<typeof createStarRailGachaSync>["sync"]>>;
type GachaCardResult = Pick<GachaSyncResult, "pools"> & {
  readonly log: Pick<GachaSyncResult["log"], "qq" | "uid" | "profileId" | "updatedAt">;
};

const title = "星铁抽卡记录";
const failureMessages = {
  "rate-limited": "访问过于频繁，请稍后再试。",
  "profile-changed": "更新星铁抽卡历史时档案已变更，请重新发起请求。",
  "request-failed": "星铁抽卡记录更新失败。",
} as const;
const failureAdvice = {
  "rate-limited": "已有记录仍可查询，稍后再更新。",
  "profile-changed": "确认当前档案和星铁 UID 后重新发起。",
  "request-failed": "检查档案登录状态与星铁 UID。",
} as const;

export function starRailGachaFailureText(reason: keyof typeof failureMessages) {
  return reason === "request-failed" ? `${failureMessages[reason]}${failureAdvice[reason]}` : failureMessages[reason];
}

interface GachaCardFailure {
  readonly qq: string;
  readonly profileId: number;
  readonly reason?: keyof typeof failureMessages;
  readonly at?: Date;
}

export function renderStarRailGachaResult({ log, pools }: GachaCardResult, options: StatusCardOptions = {}) {
  const lead = `QQ ${log.qq} · 档案 ${log.profileId} · UID ${log.uid}`;
  const visiblePools = pools.filter(({ total, totalDraws }) => total || totalDraws);
  const contents = visiblePools.length ? visiblePools.map(({ name, total, added, totalDraws, pity }) =>
    `${name}：五星 ${total}（新增 ${added}）· 已抽 ${totalDraws} · 当前垫 ${pity}`) : ["记录：当前没有可用抽卡数据"];
  return renderStatusCard(title, lead, contents, new Date(log.updatedAt), options);
}

export function renderStarRailGachaFailure(
  { qq, profileId, reason = "request-failed", at = new Date() }: GachaCardFailure, options: StatusCardOptions = {},
) {
  const lead = `QQ ${qq} · 档案 ${profileId}\n${failureMessages[reason]}`;
  return renderStatusCard(title, lead, [
    failureAdvice[reason],
  ], at, options);
}
