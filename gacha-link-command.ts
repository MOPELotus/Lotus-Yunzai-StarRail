import { gameCommandProfileId, MAX_PROFILE_ID, ProfileError, type createProfileStore } from "@lotus-yunzai/account";
import { isStarRailGachaLinkMessage, starRailLinkEntry } from "../../lib/private-access.ts";
import { starRailLegacyArchiveTimezone } from "./gacha-files.ts";
import { checkedStarRailLinkRole, readStarRailGachaLink, StarRailGachaLinkError } from "./gacha-link-source.ts";
import type { createStarRailGachaRecordArchive } from "./gacha-record-archive.ts";

const ttl = 120_000;
const names = { "1": "常驻", "2": "新手", "11": "角色", "12": "光锥", "21": "角色联动", "22": "光锥联动" };

type LinkContext = {
  readonly normalizedMessage: string;
  readonly adapter?: string;
  readonly self_id?: number;
  readonly user_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly reply: (text: string) => unknown;
};
type Profiles = Pick<ReturnType<typeof createProfileStore>, "savedRole" | "loginIdentity">;
type Pending = { readonly profileId: number; readonly connection: AbortSignal; readonly expires: number;
  readonly identity: ReturnType<typeof currentIdentity> };

const validId = (id: number | undefined): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;

async function currentIdentity(profiles: Profiles, qq: string, profileId: number) {
  const [role, login] = await Promise.all([profiles.savedRole(qq, profileId, "sr"), profiles.loginIdentity(qq, profileId)]);
  return { role: checkedStarRailLinkRole(role), login, timezone: starRailLegacyArchiveTimezone(role) };
}

function failure(error: unknown, profileId: number) {
  if (error instanceof StarRailGachaLinkError) return error.message;
  if (error instanceof ProfileError) {
    if (error.code === "missing" || error.code === "login-required") return `请先登录星铁档案 ${profileId}。`;
    if (error.code === "role-missing") return `星铁档案 ${profileId} 没有绑定角色，请先同步。`;
    if (error.code === "changed") return "星铁档案的账号或角色已变化，请重新发起录入。";
  }
  return "星铁逐抽录入失败，原档案已保留。";
}

export function createStarRailGachaLinkCommand(profiles: Profiles,
  archive: Pick<ReturnType<typeof createStarRailGachaRecordArchive>, "merge">, signal: AbortSignal, read = readStarRailGachaLink) {
  const pending = new Map<string, Pending>();
  const running = new Set<string>();
  signal.addEventListener("abort", () => pending.clear(), { once: true });

  return async (context: LinkContext): Promise<string | undefined> => {
    const text = context.normalizedMessage.trim();
    const entry = starRailLinkEntry.exec(text);
    const cancel = text === "取消";
    if (signal.aborted || context.isDelegated || (!entry && !cancel && !isStarRailGachaLinkMessage(text))) return;
    const { adapter, self_id, user_id, message_type, privateCredentialSignal: connection } = context;
    if (message_type !== "private" || !connection || connection.aborted || !validId(self_id) || !validId(user_id)) {
      if (entry) return "请在已连接机器人的好友私聊使用 *抽卡链接。";
      return;
    }
    const qq = String(user_id);
    const scope = `${adapter ?? "onebot"}:${self_id}:${qq}`;
    if (entry) {
      const profileId = gameCommandProfileId("sr", entry[1]);
      if (profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
      if (pending.size >= 1024 && !pending.has(scope)) return "当前录入会话较多，请稍后重试。";
      const request = { profileId, connection, expires: performance.now() + ttl, identity: currentIdentity(profiles, qq, profileId) };
      pending.set(scope, request);
      setTimeout(() => { if (pending.get(scope) === request) pending.delete(scope); }, ttl).unref();
      try {
        await request.identity;
        if (!signal.aborted && !connection.aborted && pending.get(scope) === request) {
          return "请发送本档案的完整星铁官方抽卡链接，链接仅用于本次录入。两分钟内有效，可发送「取消」。";
        }
      } catch (error) {
        if (pending.get(scope) !== request) return;
        pending.delete(scope);
        if (!signal.aborted && !connection.aborted) return failure(error, profileId);
      }
      return;
    }

    const request = pending.get(scope);
    if (!request) return cancel ? undefined : "请先私聊发送 *抽卡链接，再发送官方链接。";
    pending.delete(scope);
    if (request.connection.aborted || request.expires <= performance.now()) {
      return cancel ? undefined : "录入会话已超时，请重新发送 *抽卡链接。";
    }
    if (cancel) return "已取消星铁抽卡链接录入。";
    const key = `${qq}:${request.profileId}`;
    if (running.has(key)) return "该星铁档案正在录入链接，请稍后再试。";
    running.add(key);
    const active = AbortSignal.any([signal, connection, request.connection]);
    try {
      const identity = await request.identity;
      const verify = async () => {
        active.throwIfAborted();
        const latest = await currentIdentity(profiles, qq, request.profileId).catch(() => undefined);
        if (latest?.login !== identity.login || latest.role.uid !== identity.role.uid || latest.role.region !== identity.role.region ||
            latest.role.gameBiz !== identity.role.gameBiz) throw new ProfileError("changed", "星铁档案已变化。");
        active.throwIfAborted();
      };
      await verify();
      if (!await context.reply("正在读取星铁官方逐抽记录，请稍候。")) return;
      const incoming = await read(text, identity.role, active, verify);
      const result = await archive.merge({ qq, uid: identity.role.uid }, incoming, verify, { legacyTimezone: identity.timezone });
      await verify();
      const lines = result.pools.filter(pool => pool.received).map(({ pool, received, added, total }) =>
        `${names[pool]}：读取 ${received} 条，新增 ${added} 条，共 ${total} 条`);
      const suffix = request.profileId === 1 ? "" : request.profileId;
      return [`UID ${identity.role.uid} · 星铁逐抽录入完成`, ...lines, `发送 *逐抽记录${suffix} 查看。`].join("\n");
    } catch (error) {
      if (!active.aborted) return failure(error, request.profileId);
    } finally {
      running.delete(key);
    }
  };
}
