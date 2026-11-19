import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_PROFILE_ID, type GameRole, type createProfileStore } from "@lotus-yunzai/account";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { renderStarRailRelicRank, type RelicRankRow } from "./group-relic-rank-card.ts";
import { object } from "./panel-model.ts";
import { findStarRailRankCharacter } from "./rank-statistics.ts";

export interface StarRailGroupRankContext {
  readonly message_type?: string;
  readonly adapter?: string;
  readonly self_id?: number;
  readonly group_id?: number;
  readonly user_id?: number;
  readonly isDelegated?: boolean;
  readonly listCurrentGroupMembers?: () => Promise<readonly { id: number }[] | undefined>;
}

type Scope = { readonly adapter: "onebot" | "milky"; readonly bot: number; readonly group: number; readonly qq: number };
type Role = Pick<GameRole, "uid" | "region" | "gameBiz">;
type Summary = Omit<RelicRankRow, "uid"> & { readonly observedAt: number };
type Observation = { readonly profileId: number; readonly role: Role; readonly summary: Record<string, Summary> };
type Candidate = { readonly qq: number; readonly profileId: number; readonly role: Role; readonly summary: Summary };

const defaultDirectory = fileURLToPath(new URL("../../data/starrail/relic-rank/", import.meta.url));
const displayLimit = 15;
const rosterLimit = 10_000;

export function matchStarRailRelicRank(message: string) {
  const name = /^#星铁(?:群内?)?([^#]{1,24}?)(?:遗器(?:评分)?|评分)(?:排行|排名)榜?$/u.exec(message)?.[1];
  if (name) return findStarRailRankCharacter(name);
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function scopeOf(context: StarRailGroupRankContext): Scope | undefined {
  const { adapter = "onebot", self_id: bot, user_id: qq, group_id: group } = context;
  if (context.message_type !== "group" || context.isDelegated || !positive(bot) || !positive(group) || !positive(qq) || qq === bot) return;
  if (adapter === "onebot" || adapter === "milky") return { adapter, bot, group, qq };
}

function publicRole(raw: unknown): Role | undefined {
  const role = object(raw);
  if (!role || typeof role.uid !== "string" || !/^[1-9]\d{8,9}$/u.test(role.uid) || Number(role.uid) < 100000006 ||
      typeof role.region !== "string" || !/^[a-z]{2,5}_[a-z0-9_]{2,15}$/u.test(role.region) ||
      (role.gameBiz !== "hkrpg_cn" && role.gameBiz !== "hkrpg_global")) return;
  return { uid: role.uid, region: role.region, gameBiz: role.gameBiz };
}

const sameRole = (left: Role, right?: Role) => left.uid === right?.uid && left.region === right.region && left.gameBiz === right.gameBiz;

function decodeSummary(raw: unknown): Summary | undefined {
  const row = object(raw);
  if (!row || typeof row.characterId !== "string" || !/^[1-9]\d{3}$/u.test(row.characterId) ||
      !findStarRailRankCharacter(row.characterId) || typeof row.score !== "number" || !Number.isFinite(row.score) || row.score < 0 || row.score > 420 ||
      typeof row.grade !== "string" || !/^(?:D|C|B|A|S|SS|SSS|ACE|MAX)$/u.test(row.grade) || !positive(row.observedAt)) return;
  const { characterId, score, grade, observedAt } = row;
  return { characterId, score, grade, observedAt };
}

function observations(raw: unknown, scope: Scope, qq: number): Record<string, Observation> {
  if (raw === null) return {};
  const input = object(raw);
  const profiles = object(input?.profiles);
  if (!profiles || input?.version !== 1 || input.adapter !== scope.adapter || input.bot !== scope.bot || input.group !== scope.group || input.qq !== qq) {
    throw new TypeError("星铁群遗器排行摘要与当前会话不一致。");
  }
  const records: Record<string, Observation> = {};
  for (const [key, value] of Object.entries(profiles)) {
    const row = object(value), role = publicRole(row?.role), profileId = row?.profileId;
    const data = object(row?.summary);
    if (!data || !positive(profileId) || profileId > MAX_PROFILE_ID || key !== String(profileId) || !role) continue;
    const summary: Record<string, Summary> = {};
    for (const [characterId, rawSummary] of Object.entries(data)) {
      const decoded = decodeSummary(rawSummary);
      if (decoded?.characterId === characterId) summary[characterId] = decoded;
    }
    records[key] = { profileId, role, summary };
  }
  return records;
}

async function groupMembers(scope: Scope, context: StarRailGroupRankContext) {
  const entries = await context.listCurrentGroupMembers?.().catch(() => undefined);
  if (!Array.isArray(entries) || entries.length > rosterLimit) return;
  const members = new Set<number>();
  for (const row of entries) {
    if (!positive(row?.id) || members.has(row.id)) return;
    members.add(row.id);
  }
  if (members.has(scope.bot) && members.has(scope.qq)) return members;
}

function rankCharacterId(id: string) {
  const value = Number(id);
  if (value >= 8002 && value <= 8018 && value % 2 === 0) return String(value - 1);
  return id;
}

type RankProfiles = Pick<ReturnType<typeof createProfileStore>, "describe">;
type RenderRank = (...args: Parameters<typeof renderStarRailRelicRank>) => Promise<{ readonly png: Uint8Array } | undefined>;

export function createStarRailGroupRelicRank(profiles: RankProfiles, lockFile: AcquireRoleArchiveLock, signal: AbortSignal, {
  directory = defaultDirectory, groups = Bun.env.LOTUS_STAR_RAIL_PANEL_RANK_GROUPS ?? "", render = renderStarRailRelicRank,
}: { readonly directory?: string; readonly groups?: string; readonly render?: RenderRank } = {}) {
  const enabled = new Set(groups.split(/[\s,]+/u).filter((group) => /^[1-9]\d*$/u.test(group)));
  const folder = (scope: Scope) => join(directory, scope.adapter, String(scope.bot));
  const archive = (scope: Scope) => createRoleJsonArchive(folder(scope), lockFile, {
    subject: "星铁群遗器评分摘要", lockSuffix: "relic-rank", maxBytes: 2 * 1024 * 1024, rejectNull: true,
  });
  const groupEnabled = (scope: Scope) => enabled.has(String(scope.group));

  async function stillActive({ qq, profileId, role }: Pick<Candidate, "qq" | "profileId" | "role">) {
    const profile = await profiles.describe(String(qq), profileId).catch(() => undefined);
    if (!profile?.loggedIn) return false;
    const roles = profile.roles.sr;
    const active = roles.find((item) => item.uid === profile.activeRoles.sr) ?? roles.find((item) => item.chosen) ?? roles[0];
    return sameRole(role, publicRole(active));
  }

  return {
    allows(context: StarRailGroupRankContext | undefined) {
      if (!context || !context.listCurrentGroupMembers || signal.aborted) return false;
      const scope = scopeOf(context);
      return !!scope && groupEnabled(scope);
    },
    async observe(context: StarRailGroupRankContext, profileId: number, selectedRole: Role, shown: Summary, verify: () => Promise<void>) {
      const scope = scopeOf(context), role = publicRole(selectedRole), summary = decodeSummary(shown);
      if (!scope || !role || !summary || !positive(profileId) || profileId > MAX_PROFILE_ID || !groupEnabled(scope) || signal.aborted) return;
      if (!await groupMembers(scope, context) || !await stillActive({ qq: scope.qq, profileId, role })) return;
      await archive(scope).update({ qq: String(scope.group), uid: String(scope.qq) }, verify, (raw) => {
        const profiles = observations(raw, scope, scope.qq);
        const previous = profiles[String(profileId)];
        const prior = previous && sameRole(previous.role, role) ? previous.summary : {};
        if ((prior[summary.characterId]?.observedAt ?? 0) > summary.observedAt) return { result: undefined };
        profiles[String(profileId)] = { profileId, role, summary: { ...prior, [summary.characterId]: summary } };
        return { document: { version: 1, ...scope, profiles }, result: undefined };
      });
    },
    async query(message: string, context: StarRailGroupRankContext) {
      const character = matchStarRailRelicRank(message);
      if (!character || signal.aborted) return;
      const scope = scopeOf(context);
      if (!scope) return "星铁群遗器评分排行只能在群聊中查询。";
      if (!groupEnabled(scope)) return "本群未启用星铁群遗器评分排行。";
      const members = await groupMembers(scope, context);
      if (!members) return "暂时无法核对本群成员，请稍后查询。";
      try {
        const files = await readdir(join(folder(scope), String(scope.group))).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return [];
          throw error;
        });
        const candidates: Candidate[] = [];
        const store = archive(scope);
        const target = rankCharacterId(String(character.id));
        for (const file of files) {
          signal.throwIfAborted();
          const qq = Number(/^([1-9]\d*)\.json$/u.exec(file)?.[1]);
          if (!members.has(qq) || qq === scope.bot) continue;
          const saved = await store.read(String(scope.group), String(qq)).then((raw) => observations(raw, scope, qq)).catch(() => ({}));
          for (const { profileId, role, summary } of Object.values(saved as Record<string, Observation>)) {
            const best = Object.values(summary).filter((item) => rankCharacterId(item.characterId) === target)
              .sort((left, right) => right.observedAt - left.observedAt)[0];
            if (best && best.score > 0 && await stillActive({ qq, profileId, role })) candidates.push({ qq, profileId, role, summary: best });
          }
        }
        candidates.sort((a, b) => b.summary.score - a.summary.score || (b.role.uid > a.role.uid ? 1 : b.role.uid < a.role.uid ? -1 : 0) || a.qq - b.qq || a.profileId - b.profileId);
        const byUid = new Map<string, Candidate>();
        for (const row of candidates) {
          if (!byUid.has(row.role.uid)) byUid.set(row.role.uid, row);
          if (byUid.size === displayLimit) break;
        }
        const ranked = [...byUid.values()];
        if (!ranked.length) return `本群暂无${character.name}的遗器评分。可在本群发送 *${character.name}遗器 展示自己的评分。`;
        const rows = ranked.map(({ role, summary: { characterId, score, grade } }) => ({ uid: role.uid, characterId, score, grade }));
        let png: Uint8Array | undefined;
        try {
          png = (await render(character, rows))?.png;
        } catch {}
        const latest = await groupMembers(scope, context);
        if (signal.aborted) return;
        if (!latest || ranked.some(({ qq }) => !latest.has(qq)) || !(await Promise.all(ranked.map(stillActive))).every(Boolean)) {
          return "群成员或档案已变化，请重新查询排行。";
        }
        if (signal.aborted) return;
        if (png) return { type: "image" as const, file: png };
        return [`${character.name} · 本群遗器评分排行`, ...rows.map(({ uid, score, grade }, index) =>
          `${index + 1}. UID ${uid} · ${score.toFixed(1)} · ${grade}`)].join("\n");
      } catch {
        if (!signal.aborted) return "暂时无法读取本群遗器评分排行。";
      }
    },
  };
}
