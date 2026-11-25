import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { renderStatusCard, type StatusCardOptions } from "@lotus-yunzai/skia/status-card";
import type { createStarRailGachaSync } from "./gacha-sync.ts";

type GachaSyncResult = Awaited<ReturnType<ReturnType<typeof createStarRailGachaSync>["sync"]>>;
type GachaCardResult = Pick<GachaSyncResult, "pools"> & {
  readonly log: Pick<GachaSyncResult["log"], "qq" | "uid" | "profileId" | "updatedAt">;
};

const title = $t("gacha-result-card.text_a5195432b4");
const failureMessages = {
  "rate-limited": $t("gacha-result-card.text_3f341e6635"),
  "network-failed": $t("gacha-result-card.text_aef566e1e7"),
  "service-unavailable": $t("gacha-result-card.text_45f501d999"),
  "profile-changed": $t("gacha-result-card.text_e77f1910c7"),
  "request-failed": $t("gacha-result-card.text_87c3bcd74e"),
} as const;
export function starRailGachaFailureText(reason: keyof typeof failureMessages) {
  return failureMessages[reason];
}

interface GachaCardFailure {
  readonly qq: string;
  readonly profileId: number;
  readonly reason?: keyof typeof failureMessages;
  readonly at?: Date;
}

export function renderStarRailGachaResult({ log, pools }: GachaCardResult, options: StatusCardOptions = {}) {
  const lead = $t("gacha-result-card.text_e747eddef9", { "qq": log.qq, "profileId": log.profileId, "uid": log.uid });
  const visiblePools = pools.filter(({ total, totalDraws }) => total || totalDraws);
  const contents = visiblePools.length ? visiblePools.map(({ name, total, added, totalDraws, pity }) =>
    $t("gacha-result-card.text_baee777c76", { "name": name, "total": total, "added": added, "totalDraws": totalDraws, "pity": pity })) : [$t("gacha-result-card.text_d9233de22e")];
  return renderStatusCard(title, lead, contents, new Date(log.updatedAt), options);
}

export function renderStarRailGachaFailure(
  { qq, profileId, reason = "request-failed", at = new Date() }: GachaCardFailure, options: StatusCardOptions = {},
) {
  const lead = $t("gacha-result-card.text_7a351db5c1", { "qq": qq, "profileId": profileId, "value3": failureMessages[reason] });
  return renderStatusCard(title, lead, [], at, options);
}
