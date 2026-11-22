import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGroupRankRefresh, MAX_PROFILE_ID, type GameRole, type createProfileStore } from "@lotus-yunzai/account";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { relicRankCoverageText, renderStarRailRelicRank, type RelicRankRow } from "./group-relic-rank-card.ts";
import { readPanelRankAvatar, readTheme, scorePanelAvatarRelics } from "./panel-card.ts";
import { fetchStarRailShowcase, ShowcaseError, showcaseTarget } from "./panel-showcase.ts";
import { readShowcaseServer } from "./panel-showcase-config.ts";
import { object } from "./panel-model.ts";
import { findStarRailRankCharacter } from "./rank-statistics.ts";

export interface StarRailGroupRankContext {
  readonly message_type?: string;
  readonly adapter?: string;
  readonly inlineImageByteLimit?: number;
  readonly self_id?: number;
  readonly group_id?: number;
  readonly user_id?: number;
  readonly isDelegated?: boolean;
  readonly listCurrentGroupMembers?: () => Promise<readonly { id: number }[] | undefined>;
  readonly groupActivitySignal?: AbortSignal;
}

type Scope = { readonly adapter: "onebot" | "milky"; readonly bot: number; readonly group: number; readonly qq: number };
type Role = Pick<GameRole, "uid" | "region" | "gameBiz">;
type Summary = Pick<RelicRankRow, "characterId" | "grade" | "score"> & { readonly observedAt: number };
type Observation = { readonly profileId: number; readonly role: Role; readonly summary: Record<string, Summary> };
type BoundProfile = { readonly qq: number; readonly profileId: number; readonly role: Role };
type Candidate = { readonly role: Role; readonly profiles: BoundProfile[] };

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
  fetchShowcase = fetchStarRailShowcase, readServer = readShowcaseServer, readRankTheme = readTheme,
}: {
  readonly directory?: string;
  readonly groups?: string;
  readonly render?: RenderRank;
  readonly fetchShowcase?: typeof fetchStarRailShowcase;
  readonly readServer?: typeof readShowcaseServer;
  readonly readRankTheme?: typeof readTheme;
} = {}) {
  const refresh = createGroupRankRefresh();
  const refreshing = new Set<string>();
  const enabled = new Set(groups.split(/[\s,]+/u).filter((group) => /^[1-9]\d*$/u.test(group)));
  const folder = (scope: Scope) => join(directory, scope.adapter, String(scope.bot));
  const archive = (scope: Scope) => createRoleJsonArchive(folder(scope), lockFile, {
    subject: "星铁群遗器评分摘要", lockSuffix: "relic-rank", maxBytes: 2 * 1024 * 1024, rejectNull: true,
  });
  const groupEnabled = (scope: Scope) => enabled.has(String(scope.group));

  async function stillActive({ qq, profileId, role }: BoundProfile) {
    const profile = await profiles.describe(String(qq), profileId).catch(() => undefined);
    if (!profile?.loggedIn) return false;
    const roles = profile.roles.sr;
    const active = roles.find((item) => item.uid === profile.activeRoles.sr) ?? roles.find((item) => item.chosen) ?? roles[0];
    return sameRole(role, publicRole(active));
  }

  async function remainsRegistered(candidate: Candidate, members: Set<number>) {
    for (const profile of candidate.profiles) {
      if (members.has(profile.qq) && await stillActive(profile)) return true;
    }
    return false;
  }

  return {
    allows(context: StarRailGroupRankContext | undefined) {
      if (!context || !context.listCurrentGroupMembers || context.groupActivitySignal?.aborted || signal.aborted) return false;
      const scope = scopeOf(context);
      return !!scope && groupEnabled(scope);
    },
    async observe(context: StarRailGroupRankContext, profileId: number, selectedRole: Role, shown: Summary, verify: () => Promise<void>) {
      const scope = scopeOf(context), role = publicRole(selectedRole), summary = decodeSummary(shown);
      if (!scope || !role || !summary || !positive(profileId) || profileId > MAX_PROFILE_ID || !groupEnabled(scope) || context.groupActivitySignal?.aborted || signal.aborted) return;
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
      const active = context.groupActivitySignal ? AbortSignal.any([signal, context.groupActivitySignal]) : signal;
      if (!character || active.aborted) return;
      const scope = scopeOf(context);
      if (!scope) return "星铁群遗器评分排行只能在群聊中查询。";
      if (!groupEnabled(scope)) return "本群未启用星铁群遗器评分排行。";
      const groupKey = `${scope.adapter}:${scope.bot}:${scope.group}`;
      if (refreshing.has(groupKey)) return "本群星铁遗器排行正在刷新，请稍后再查。";
      refreshing.add(groupKey);
      try {
        const members = await groupMembers(scope, context);
        active.throwIfAborted();
        if (!members) return "暂时无法核对本群成员，请稍后查询。";
        const files = await readdir(join(folder(scope), String(scope.group))).catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return [];
          throw error;
        });
        const registered = new Map<string, Candidate>();
        const store = archive(scope);
        for (const file of files) {
          active.throwIfAborted();
          const qq = Number(/^([1-9]\d*)\.json$/u.exec(file)?.[1]);
          if (!members.has(qq) || qq === scope.bot) continue;
          const saved = await store.read(String(scope.group), String(qq)).then(raw => observations(raw, scope, qq)).catch(() => ({}));
          for (const { profileId, role, summary } of Object.values(saved as Record<string, Observation>)) {
            if (!Object.keys(summary).length) continue;
            const profile = { qq, profileId, role };
            if (!await stillActive(profile)) continue;
            const candidate = registered.get(role.uid);
            if (candidate) candidate.profiles.push(profile);
            else registered.set(role.uid, { role, profiles: [profile] });
          }
        }
        active.throwIfAborted();
        if (!registered.size) return `本群暂无已登记的星铁 UID。可在本群发送 *${character.name}遗器 登记当前档案。`;
        const [provider, theme] = await Promise.all([readServer(), readRankTheme()]);
        const targetId = rankCharacterId(String(character.id));
        const results = await refresh([...registered.values()], async (entry, requestSignal) => {
          if (!await remainsRegistered(entry, members)) return;
          requestSignal.throwIfAborted();
          const target = showcaseTarget(entry.role, provider);
          try {
            const snapshot = await fetchShowcase(target, requestSignal);
            if (snapshot.uid !== entry.role.uid || snapshot.source !== target.provider) throw new ShowcaseError("展板身份不一致。");
            const matching = snapshot.avatars.filter(avatar => rankCharacterId(avatar.id) === targetId);
            if (matching.length !== 1) return;
            const avatar = matching[0]!;
            const { score } = await scorePanelAvatarRelics(avatar, theme);
            const mark = score && score.incomplete === 0 ? Number(score.mark) : NaN;
            if (!score || !Number.isFinite(mark) || mark <= 0 || mark > 420) return;
            return { uid: snapshot.uid, characterId: avatar.id, score: mark, grade: score.markClass, avatar };
          } catch (error) {
            if (error instanceof ShowcaseError && error.notListed) return;
            throw error;
          }
        }, active);
        const latest = await groupMembers(scope, context);
        active.throwIfAborted();
        if (!latest) return "暂时无法核对本群成员，请稍后查询。";
        const current = [];
        for (const result of results) {
          active.throwIfAborted();
          if (await remainsRegistered(result.entry, latest)) current.push(result);
        }
        if (!current.length) return "群成员或档案已变化，请重新查询排行。";
        const scored = current.flatMap(row => row.status === "fresh" ? [row] : []);
        scored.sort((a, b) => b.value.score - a.value.score ||
          (b.value.uid > a.value.uid ? 1 : b.value.uid < a.value.uid ? -1 : 0));
        const ranked = scored.slice(0, displayLimit);
        const rows: RelicRankRow[] = await Promise.all(ranked.map(async ({ value: { avatar, ...row } }) => ({
          ...row, presentation: await readPanelRankAvatar(avatar, theme).catch(() => undefined),
        })));
        const coverage = {
          registered: current.length, scored: scored.length,
          notListed: current.filter(row => row.status === "not-listed").length,
          failed: current.filter(row => row.status === "failed").length,
        };
        if (!rows.length) return `本群暂无${character.name}的本轮有效公开展板评分。\n${relicRankCoverageText(coverage)}`;
        let png: Uint8Array | undefined;
        try {
          png = (await render(character, rows, undefined, context.inlineImageByteLimit, coverage))?.png;
        } catch {}
        const confirmed = await groupMembers(scope, context);
        active.throwIfAborted();
        if (!confirmed || !(await Promise.all(ranked.map(({ entry }) => remainsRegistered(entry, confirmed)))).every(Boolean)) {
          return "群成员或档案已变化，请重新查询排行。";
        }
        active.throwIfAborted();
        if (png) return { type: "image" as const, file: png };
        return [`${character.name} · 本群遗器评分排行`, relicRankCoverageText(coverage), ...rows.map(({ uid, score, grade }, index) =>
          `${index + 1}. UID ${uid} · ${score.toFixed(1)} · ${grade}`)].join("\n");
      } catch {
        if (!active.aborted) return "暂时无法刷新本群公开展板，未生成本轮遗器评分排行。";
      } finally {
        refreshing.delete(groupKey);
      }
    },
  };
}
