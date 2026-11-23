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

const changed = "星铁档案已变更，请重新查询。";

export function createStarRailRosterQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal,
  { theme = readTheme, draw = renderStarRailPersonalRoster, now = () => new Date(), qFace = true } = {}) {
  return async function query(context: RosterContext, spec: RosterCommand) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if (context.isDelegated || (context.message_type !== "private" && context.message_type !== "group") ||
      typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return "请从本人 QQ 会话查询星铁角色资料。";
    const { mode, profileId } = spec;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
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
      if (!reply.roster.length) return "米游社未返回当前星铁角色名册。请确认此档案已同步本人角色。";
      const availableTheme = await theme();
      const model = await buildStarRailPersonalRoster(reply, source.role, spec, availableTheme, signal, now(), qFace);
      await verify();
      if (!model.rows.length) {
        if (model.week !== undefined && model.week !== 7) {
          return "暂无符合该星期筛选的星铁角色。星铁没有按星期开放的天赋书，可发送 *行迹统计 查看全部。";
        }
        return "所选档案没有符合星级筛选的星铁角色。";
      }
      const title = mode === "roster" ? "星铁角色列表" : "星铁行迹统计";
      const pics = await draw(model, availableTheme.root, "auto", signal).catch(() => undefined);
      await verify();
      const nodes = pics?.map(card => ({ type: "image" as const, file: card.png }));
      if (nodes?.length === 1) return nodes[0]!;
      const heading = `UID ${model.uid} · ${title} · ${model.rows.length} 位角色`;
      if (nodes?.length) return { type: "forward" as const, nodes: [heading, ...nodes] };
      return [heading, ...model.rows.map(row => [
        row.name, `Lv.${row.level}`, row.rank === undefined ? "" : `${row.rank}魂`,
        mode === "talent" ? `A/E/Q/T ${row.skills.map(skill => skill.level ?? "—").join("/")}`
          : row.cone?.name,
      ].filter(Boolean).join(" · "))].join("\n");
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "changed") return changed;
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
      }
      if (error instanceof HoyoRequestError) return error.code === "profile-changed" ? changed : error.message;
      return "星铁角色资料暂时无法读取，请稍后重试。";
    }
  };
}
