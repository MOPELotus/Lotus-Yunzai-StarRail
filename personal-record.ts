import { gameCommandProfileId, MAX_PROFILE_ID, ProfileError, gameRegionDisplayName, normalizeProfileRoleArtworkUrl, type GameRole, type createProfileStore } from "@lotus-yunzai/account";
import { HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { renderStarRailPersonalRecord } from "./personal-record-card.ts";

const command = /^(?:[#*＊]?(?:星铁|星轨|崩铁|星穹铁道|铁道|sr)|[*＊])\s*(?:卡片|探索)(?:\s*(?:档案\s*)?(\d{1,3}))?$/iu;
const emptyBackground = "https://act-webstatic.mihoyo.com/game_record/hkrpg/.png";
const elements = new Set(["fire", "ice", "imaginary", "lightning", "physical", "quantum", "wind"]);

export function matchStarRailPersonalRecord(message: string) {
  const match = command.exec(message.trim());
  return match ? { profileId: gameCommandProfileId("sr", match[1]) } : undefined;
}

function object(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, max) : "";
}

function count(value: unknown, max = Number.MAX_SAFE_INTEGER) {
  const number = typeof value === "string" && /^\d{1,16}$/u.test(value) ? Number(value) : value;
  if (typeof number === "number" && Number.isSafeInteger(number) && number >= 0 && number <= max) return number;
}

export function makeStarRailPersonalRecord(data: Record<string, unknown>, source: GameRole) {
  const stats = object(data.stats);
  const role = object(data.role);
  if (!stats && !Array.isArray(data.avatar_list)) throw new HoyoRequestError("response", "米游社未返回有效的星铁战绩名片。");
  const entries = Array.isArray(data.avatar_list) ? data.avatar_list : [];
  if (entries.length > 256) throw new HoyoRequestError("response", "米游社返回的星铁名片角色数无效。");
  const avatars = entries.flatMap(entry => {
    const item = object(entry);
    const name = text(item?.name, 40);
    if (!item || !name) return [];
    const rawElement = text(item.element, 12).toLowerCase();
    const element = rawElement === "thunder" ? "lightning" : rawElement;
    return [{
      id: count(item.id ?? item.avatar_id, 999_999) || "" as const,
      name, icon: normalizeProfileRoleArtworkUrl(item.icon) ?? "",
      element: elements.has(element) ? element : "",
      level: count(item.level, 80), rank: count(item.rank, 6), rarity: count(item.rarity, 5),
    }];
  });
  return {
    uid: source.uid,
    nickname: text(source.nickname, 60) || text(role?.nickname ?? data.nickname, 60) || "开拓者",
    region: gameRegionDisplayName("sr", source.region,
      text(source.regionName, 40), text(role?.region_name ?? data.region_name, 40)),
    level: count(source.level ?? role?.level ?? data.level, 70),
    avatar: normalizeProfileRoleArtworkUrl(data.cur_head_icon_url ?? role?.cur_head_icon_url) ??
      normalizeProfileRoleArtworkUrl(source.avatar),
    background: data.phone_background_image_url !== emptyBackground
      ? normalizeProfileRoleArtworkUrl(data.phone_background_image_url) : undefined,
    stats: [
      ["活跃天数", count(stats?.active_days ?? stats?.active_day_number)],
      ["已解锁角色", count(stats?.avatar_num ?? stats?.avatar_count)],
      ["达成成就数", count(stats?.achievement_num ?? stats?.achievement_count ?? stats?.achievement_number)],
      ["战利品开启", count(stats?.chest_num ?? stats?.chest_count)],
      ["忘却之庭", text(stats?.abyss_process, 48) || count(stats?.abyss_process)],
    ] as const,
    avatars,
  };
}

export type StarRailPersonalRecord = ReturnType<typeof makeStarRailPersonalRecord>;

export function starRailPersonalRecordText(record: StarRailPersonalRecord) {
  const header = `星铁战绩名片 · ${record.nickname} · ${record.region} · UID ${record.uid}` +
    (record.level === undefined ? "" : ` · Lv.${record.level}`);
  return [header, ...record.stats.map(([name, value]) => `${name} ${value ?? "—"}`),
    ...(record.avatars.length ? ["我的角色", ...record.avatars.map(avatar =>
      `${avatar.name}${avatar.level === undefined ? "" : ` Lv.${avatar.level}`}${avatar.rank ? ` · ${avatar.rank}魂` : ""}`)] : [])].join("\n");
}

type Profiles = Pick<ReturnType<typeof createProfileStore>, "requestSelectedContext">;
type Client = Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailPersonalRecord">;
type Context = {
  readonly user_id?: number; readonly self_id?: number; readonly message_type?: string;
  readonly at?: number | string; readonly isDelegated?: boolean; readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
};
type Draw = (...args: Parameters<typeof renderStarRailPersonalRecord>) => Promise<{ png: Uint8Array }>;

const changed = "星铁档案已变更，请重新查询战绩名片。";
const oneBotLimit = Math.floor((96 * 1024 * 1024 - 4096) / 4) * 3;

export function createStarRailPersonalRecordQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal, draw: Draw = renderStarRailPersonalRecord) {
  return async (context: Context, { profileId }: { readonly profileId: number }) => {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if (context.isDelegated || (context.message_type !== "group" && context.message_type !== "private") ||
        (context.at !== undefined && String(context.at) !== String(context.self_id)) ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return "请从本人 QQ 会话查询星铁战绩名片。";
    if (!Number.isInteger(profileId) || profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    const qq = String(user);
    try {
      const source = await profiles.requestSelectedContext(qq, profileId, "sr");
      const { data, revision } = await client.fetchStarRailPersonalRecord(source, { signal });
      async function verify() {
        signal.throwIfAborted();
        const active = await profiles.requestSelectedContext(qq, profileId, "sr").catch(() => undefined);
        if (active?.revision !== revision || active.role.uid !== source.role.uid || active.role.region !== source.role.region ||
            active.role.gameBiz !== source.role.gameBiz) throw new HoyoRequestError("profile-changed", changed);
        signal.throwIfAborted();
        return active.role;
      }
      const record = makeStarRailPersonalRecord(data, await verify());
      const limit = context.inlineImageByteLimit ?? oneBotLimit;
      const rendered = await draw(record, signal, { inlineImageByteLimit: limit }).catch(() => undefined);
      await verify();
      if (rendered && rendered.png.byteLength <= limit) return { type: "image" as const, file: rendered.png };
      const lines = starRailPersonalRecordText(record).split("\n");
      if (lines.length <= 65) return lines.join("\n");
      const nodes = [lines.slice(0, 7).join("\n")];
      for (let start = 7; start < lines.length; start += 50) nodes.push(lines.slice(start, start + 50).join("\n"));
      return { type: "forward" as const, nodes, batchSize: 1 };
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "changed") return changed;
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        if (error.code === "refresh") return "星铁战绩名片的 Cookie 未能续期，请检查当前档案登录状态。";
        if (error.retcode === 10102) return "米游社战绩未公开，或尚未在米游社绑定当前星铁角色。";
        return error.message;
      }
      return "星铁战绩名片暂时无法读取，请稍后重试。";
    }
  };
}
