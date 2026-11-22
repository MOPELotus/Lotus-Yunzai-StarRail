import { MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { renderStarRailRogue, starRailRogueText } from "./rogue-card.ts";
import { makeRogueCard, type RogueCard, type RogueQuery } from "./rogue-model.ts";

type Profiles = Pick<ReturnType<typeof createProfileStore>, "requestSelectedContext">;
type Client = Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailRogue">;
type Draw = (...args: Parameters<typeof renderStarRailRogue>) => Promise<{ png: Uint8Array }>;
type Route = Parameters<Client["fetchStarRailRogue"]>[1];
type RogueContext = {
  readonly user_id?: number;
  readonly self_id?: number;
  readonly message_type?: string;
  readonly at?: number | string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
};
type RogueReply = string | { readonly type: "image"; readonly file: Uint8Array };

const changed = "星铁档案已变更，请重新查询宇宙战绩。";
const oneBotLimit = Math.floor((96 * 1024 * 1024 - 4096) / 4) * 3;
const splitRecords = 8;

export function createStarRailRogueQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal, draw: Draw = renderStarRailRogue) {
  return async (context: RogueContext, request: RogueQuery) => {
    if (request.mode === "weekly-help") return "请发送 *本期演算 或 *上期演算，可在命令后填写战绩编号。";
    const user = context.user_id;
    const credential = context.privateCredentialSignal;
    if (!credential || context.message_type !== "private" || context.isDelegated ||
        (context.at !== undefined && String(context.at) !== String(context.self_id)) ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) {
      return "宇宙战绩只查询本人已绑定档案，请在机器人好友私聊使用。";
    }
    const signal = AbortSignal.any([lifecycle, credential]);
    if (signal.aborted) return [];
    const { profileId } = request;
    if (!Number.isInteger(profileId) || profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    if (!Number.isInteger(request.index) || request.index < 1 || request.index > 64) return "演算战绩编号须为 1–64。";
    const qq = String(user);
    const route: Route = request.mode === "universe" ? { kind: "starrail-rogue", scheduleType: request.period === "current" ? 1 : 2, signal }
      : { kind: request.mode === "locust" ? "starrail-rogue-locust" : "starrail-rogue-tourn", signal };
    try {
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      if (request.ownUid && request.ownUid !== source.role.uid) return "查询 UID 须与当前本人档案一致，请使用对应的档案编号。";
      const { data, revision } = await client.fetchStarRailRogue(source, route);
      async function verify() {
        signal.throwIfAborted();
        const active = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (active?.revision !== revision || active.role.uid !== source.role.uid || active.role.region !== source.role.region ||
            active.role.gameBiz !== source.role.gameBiz) throw new HoyoRequestError("profile-changed", changed);
        signal.throwIfAborted();
      }
      await verify();
      const result = makeRogueCard(source.role.uid, data, request);
      if ("message" in result) return result.message;
      const limit = context.inlineImageByteLimit ?? oneBotLimit;
      async function render(card: RogueCard) {
        const raster = await draw(card, signal, { inlineImageByteLimit: limit }).catch(() => undefined);
        await verify();
        if (raster && raster.png.byteLength <= limit) return { type: "image" as const, file: raster.png };
      }
      const card = result.card;
      const png = await render(card);
      if (png) return png;
      if (card.records.length <= 1) return starRailRogueText(card).slice(0, 5_000);
      const pages: RogueReply[] = [];
      for (const record of card.records) {
        const page = { ...card, records: [record] };
        const rendered = card.records.length <= splitRecords ? await render(page) : undefined;
        pages.push(rendered ?? starRailRogueText(page).slice(0, 5_000));
      }
      await verify();
      return { type: "forward" as const, nodes: pages, batchSize: 1 };
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "changed") return changed;
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        if (error.code === "refresh") return "星铁宇宙战绩的 Cookie 未能续期，请检查当前档案登录状态。";
        return error.message;
      }
      return "星铁宇宙战绩暂时无法读取，请稍后重试。";
    }
  };
}
