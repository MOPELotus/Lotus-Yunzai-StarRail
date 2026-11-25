import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
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
  if (!stats && !Array.isArray(data.avatar_list)) throw new HoyoRequestError("response", $t("personal-record.text_b20a2696e7"));
  const entries = Array.isArray(data.avatar_list) ? data.avatar_list : [];
  if (entries.length > 256) throw new HoyoRequestError("response", $t("personal-record.text_b1d0fc34e1"));
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
    nickname: text(source.nickname, 60) || text(role?.nickname ?? data.nickname, 60) || $t("personal-record.text_865ee04ffd"),
    region: gameRegionDisplayName("sr", source.region,
      text(source.regionName, 40), text(role?.region_name ?? data.region_name, 40)),
    level: count(source.level ?? role?.level ?? data.level, 70),
    avatar: normalizeProfileRoleArtworkUrl(data.cur_head_icon_url ?? role?.cur_head_icon_url) ??
      normalizeProfileRoleArtworkUrl(source.avatar),
    background: data.phone_background_image_url !== emptyBackground
      ? normalizeProfileRoleArtworkUrl(data.phone_background_image_url) : undefined,
    stats: [
      [$t("personal-record.text_829827347a"), count(stats?.active_days ?? stats?.active_day_number)],
      [$t("personal-record.text_df81ec4e67"), count(stats?.avatar_num ?? stats?.avatar_count)],
      [$t("personal-record.text_3f04ad9ddf"), count(stats?.achievement_num ?? stats?.achievement_count ?? stats?.achievement_number)],
      [$t("personal-record.text_16f293b5f1"), count(stats?.chest_num ?? stats?.chest_count)],
      [$t("personal-record.text_e0d7f93059"), text(stats?.abyss_process, 48) || count(stats?.abyss_process)],
    ] as const,
    avatars,
  };
}

export type StarRailPersonalRecord = ReturnType<typeof makeStarRailPersonalRecord>;

export function starRailPersonalRecordText(record: StarRailPersonalRecord) {
  const header = $t("personal-record.text_3f1fec81ff", { "nickname": record.nickname, "region": record.region, "uid": record.uid }) +
    (record.level === undefined ? "" : ` · Lv.${record.level}`);
  return [header, ...record.stats.map(([name, value]) => `${name} ${value ?? "—"}`),
    ...(record.avatars.length ? [$t("personal-record.text_299e349fd3"), ...record.avatars.map(avatar =>
      `${avatar.name}${avatar.level === undefined ? "" : ` Lv.${avatar.level}`}${avatar.rank ? $t("personal-record.text_2275384b53", { "rank": avatar.rank }) : ""}`)] : [])].join("\n");
}

type Profiles = Pick<ReturnType<typeof createProfileStore>, "requestSelectedContext">;
type Client = Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailPersonalRecord">;
type Context = {
  readonly user_id?: number; readonly self_id?: number; readonly message_type?: string;
  readonly at?: number | string; readonly isDelegated?: boolean; readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
};
type Draw = (...args: Parameters<typeof renderStarRailPersonalRecord>) => Promise<{ png: Uint8Array }>;

const changed = $t("personal-record.text_ed8d5db2e0");
const oneBotLimit = Math.floor((96 * 1024 * 1024 - 4096) / 4) * 3;

export function createStarRailPersonalRecordQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal, draw: Draw = renderStarRailPersonalRecord) {
  return async (context: Context, { profileId }: { readonly profileId: number }) => {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const user = context.user_id;
    if (context.isDelegated || (context.message_type !== "group" && context.message_type !== "private") ||
        (context.at !== undefined && String(context.at) !== String(context.self_id)) ||
        typeof user !== "number" || !Number.isSafeInteger(user) || user < 1) return $t("personal-record.text_f9570b1529");
    if (!Number.isInteger(profileId) || profileId < 1 || profileId > MAX_PROFILE_ID) return $t("personal-record.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
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
        if (error.code === "missing" || error.code === "login-required") return $t("personal-record.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("personal-record.text_c0d14d54a7", { "profileId": profileId });
      }
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return changed;
        if (error.code === "refresh") return $t("personal-record.text_c29a0aeca5");
        if (error.retcode === 10102) return $t("personal-record.text_1acdeee61f");
        return error.message;
      }
      return $t("personal-record.text_9d2a50b82b");
    }
  };
}
