import { fileURLToPath } from "node:url";
import { MAX_PROFILE_ID, ProfileError, type createProfileStore, type ProfileRequestContext } from "@lotus-yunzai/account";
import { GameRecordRequestError, HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { MessageEvent } from "../../lib/messages.ts";
import type { LegacyPanelRecoveryOffer } from "../../lib/legacy-panel-recovery-flow.ts";
import { createStarRailPanelOriginals } from "./panel-original.ts";
import type { PanelRebuilder } from "../../lib/panel-rebuild.ts";
import { findPanelAvatar, makePanelDetailCard, makePanelListCards, makePanelPracticeCards, makePanelRelicCard, makePanelRelicListCard, readPanelDamageMetadata, readPanelTalentCons, readTheme } from "./panel-card.ts";
import { calculateEquipmentAttributeRows, changePanelLevel, formatPanelAttributeRows, type PanelAttributeRows } from "./panel-attributes.ts";
import { changePanelEidolon } from "./panel-eidolon.ts";
import { changePanelRelicSets } from "./panel-relic-set.ts";
import { changePanelFullTraces } from "./panel-trace-preview.ts";
import { changePanelCoreSkills } from "./panel-skill-preview.ts";
import { changePanelNamedCone } from "./panel-cone-preview.ts";
import { changePanelSuperimposition, replacePanelEquipment } from "./panel-equipment.ts";
import { panelExportFile } from "./panel-file.ts";
import { legacySnapshot } from "./panel-legacy.ts";
import { createStarRailPanelArchive, discardedStarRailPanel, panelDiscardedAt, retainPanelDiscardBoundary } from "./panel-discard.ts";
import { applyStarRailTraces, confirmedStarRailTraces, matchesStarRailTraceOwner, readStarRailTraceArchive,
  starRailTraceOwner, type StarRailTraceOwner } from "./panel-trace-refresh.ts";
import { fetchStarRailShowcase, ShowcaseError, showcaseProviderNames, showcaseTarget } from "./panel-showcase.ts";
import { readShowcaseServer } from "./panel-showcase-config.ts";
import { hasPersonalDamage, personalDamageMetricLabel, personalDamageNames, readStarRailPersonalDamage } from "./panel-damage.ts";
import { renderStarRailPanelPractice } from "./panel-practice-skia.ts";
import { renderStarRailPanelList } from "./panel-list-skia.ts";
import { renderStarRailRelicList, renderStarRailRelicMark } from "./panel-relic-skia.ts";
import { renderStarRailPanelDetail } from "./panel-detail-skia.ts";
import { renderStarRailPersonalDamage } from "./panel-damage-card.ts";
import { groupPanelNumber } from "../../lib/group-panel-rank-settings.ts";
import type { createStarRailGroupRelicRank, StarRailGroupRankContext } from "./group-relic-rank.ts";
import { id as readId, normalizePanel, object, readLegacyPanel, text, whole, type PanelAvatar, type PanelCommand, type PanelSnapshot } from "./panel-model.ts";

export { legacySnapshot } from "./panel-legacy.ts";
const extremePanelUid = "100000000";
const bundledExtremePanel = fileURLToPath(new URL("../../resources/extreme-panels/sr.json", import.meta.url));
const showcaseDirectory = fileURLToPath(new URL("../../data/starrail/showcases/", import.meta.url));
const traceDirectory = fileURLToPath(new URL("../../data/starrail/trace-levels/", import.meta.url));
const maxBytes = 8 * 1024 * 1024;

export function managedSnapshot(uid: string, raw: unknown, showcase = false, allowEmpty = false) {
  if (raw === null) return;
  const stored = object(raw);
  const source = stored?.source;
  const allowedSource = showcase ? typeof source === "string" && Object.hasOwn(showcaseProviderNames, source) : source === "miyoushe" || source === "legacy";
  if (stored?.version !== 1 || stored.uid !== uid || !allowedSource || typeof stored.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(stored.updatedAt)) || !Array.isArray(stored.avatars) || (!allowEmpty && !stored.avatars.length && !panelDiscardedAt(raw)) ||
      stored.avatars.length > 256 || stored.avatars.some(row => !object(row) || !readId(row.id) || typeof row.name !== "string" ||
        !Array.isArray(row.skills) || !Array.isArray(row.traces) || !Array.isArray(row.stars) || !Array.isArray(row.stats) || !Array.isArray(row.relics))) {
    throw new Error("星铁面板档案无效。");
  }
  return stored as unknown as PanelSnapshot;
}

export function createStarRailPersonalPanelReader(lock: AcquireRoleArchiveLock, archiveDirectory?: string) {
  const store = createStarRailPanelArchive(lock, archiveDirectory);
  const traces = createRoleJsonArchive(traceDirectory, lock, { subject: "星铁行迹", lockSuffix: "traces", maxBytes: 128 * 1024, rejectNull: true });
  return async (qq: string, uid: string, owner?: StarRailTraceOwner) => {
    const saved = await store.read(qq, uid);
    const managed = managedSnapshot(uid, saved, false, true);
    const discardedAt = panelDiscardedAt(saved);
    const snapshot = managed?.avatars.length ? managed : discardedAt ? undefined : (await legacySnapshot(uid))?.snapshot;
    if (!snapshot) return;
    if (!owner || owner.qq !== qq || owner.uid !== uid) {
      if (panelDiscardedAt(await store.read(qq, uid)) === discardedAt) return snapshot;
      return;
    }
    const records = await traces.read(qq, uid).then(raw => readStarRailTraceArchive(owner, raw)).catch(() => undefined);
    if (panelDiscardedAt(await store.read(qq, uid)) !== discardedAt) return;
    return records ? applyStarRailTraces(snapshot, records, discardedAt) : snapshot;
  };
}

export function createStarRailPanel(
  profiles: ReturnType<typeof createProfileStore>, client: ReturnType<typeof createProfileHoyoClient>,
  lock: AcquireRoleArchiveLock, signal: AbortSignal, groupRank?: ReturnType<typeof createStarRailGroupRelicRank>,
  archiveDirectory?: string, extremeSampleFile = bundledExtremePanel, showcaseArchiveDirectory = showcaseDirectory,
) {
  const store = createStarRailPanelArchive(lock, archiveDirectory);
  const showcases = createRoleJsonArchive(showcaseArchiveDirectory, lock, { subject: "星铁公开展板", lockSuffix: "showcase", maxBytes, rejectNull: true });
  const traces = createRoleJsonArchive(traceDirectory, lock, { subject: "星铁行迹", lockSuffix: "traces", maxBytes: 128 * 1024, rejectNull: true });
  const originals = createStarRailPanelOriginals(profiles, signal, { storage: {
    async get(key) { return globalThis.redis?.get(key); },
    async set(key, value, seconds) { return globalThis.redis?.set(key, value, { EX: seconds }); },
  } });
  const refreshing = new Set<string>();

  async function queryExtremePanel(name: string, inlineImageByteLimit?: number) {
    if (signal.aborted) return;
    try {
      let theme: Awaited<ReturnType<typeof readTheme>> | undefined;
      let available = false;
      let unreadable = false;
      for (const sampleFile of [undefined, extremeSampleFile]) {
        const saved = await legacySnapshot(extremePanelUid, sampleFile).catch(() => { unreadable = true; });
        if (signal.aborted) return;
        if (!saved) continue;
        available = true;
        const { snapshot } = saved;
        theme ??= await readTheme();
        const avatar = findPanelAvatar(snapshot.avatars, name, theme);
        if (signal.aborted) return;
        if (!avatar) continue;
        const model = await makePanelDetailCard(snapshot, avatar, theme, signal, {
          localOnly: true, sourceLabel: "极限面板", allowCustomizedSample: sampleFile !== undefined,
        });
        if (signal.aborted) return;
        const card = await renderStarRailPanelDetail(model, theme.root, "auto", inlineImageByteLimit).catch(() => undefined);
        if (signal.aborted) return;
        return card ? { type: "image" as const, file: card.png } : `星铁极限面板 · ${avatar.name}\n图片暂时无法生成。`;
      }
      if (available) return "星铁极限面板样例档没有这个角色。";
      return unreadable ? "星铁极限面板样例档暂时无法读取。" : "当前没有安装星铁极限面板样例档。";
    } catch {
      if (!signal.aborted) return "星铁极限面板样例档暂时无法读取。";
    }
  }

  async function refreshPanel(account: ProfileRequestContext, verify: (revision?: string) => Promise<void>,
    discardedAt: number, active: AbortSignal, allowRecovery?: true) {
    const { qq, role: { uid } } = account;
    const key = `${qq}:${uid}`;
    if (refreshing.has(key)) return { status: "busy" } as const;
    refreshing.add(key);
    try {
      await verify();
      const startedAt = new Date(Math.max(Date.now(), discardedAt + 1));
      const result = await client.fetchStarRailPanel(account, { signal: active }).catch((error: unknown) => {
        if (allowRecovery && !active.aborted && error instanceof HoyoRequestError && error.code !== "profile-changed") return error;
        throw error;
      });
      if (result instanceof HoyoRequestError) return { status: "unavailable", error: result } as const;
      await verify(result.revision);
      const next = normalizePanel(uid, result.avatars, startedAt);
      if (!next.avatars.length) return { status: "empty" } as const;
      let updated = false;
      const snapshot = await store.update({ qq, uid }, verify, current => {
        const previous = managedSnapshot(uid, current);
        if (previous?.updatedAt && next.updatedAt && previous.updatedAt > next.updatedAt) return { result: previous };
        updated = true;
        return { document: retainPanelDiscardBoundary(next, discardedAt), result: next };
      });
      return { status: "ready", snapshot, updated } as const;
    } finally {
      refreshing.delete(key);
    }
  }

  const rebuild: PanelRebuilder = async (qq, profileId, uid, requesterSignal, verifyAuthority) => {
    const active = AbortSignal.any([signal, requesterSignal]);
    verifyAuthority();
    active.throwIfAborted();
    const selected = await profiles.savedRole(qq, profileId, "sr");
    const account = await profiles.requestContext(qq, profileId, "sr");
    const owner = selected.uid === uid && starRailTraceOwner(account, selected);
    if (!owner) throw new ProfileError("changed", "星铁面板档案已变更。");
    const discardedAt = panelDiscardedAt(await store.read(qq, uid));
    let revision = account.revision;
    const result = await refreshPanel(account, async (updatedRevision) => {
      if (updatedRevision !== undefined) revision = updatedRevision;
      verifyAuthority();
      active.throwIfAborted();
      const latest = await profiles.requestContext(qq, profileId, "sr");
      const selection = await profiles.savedRole(qq, profileId, "sr");
      if (latest.revision !== revision || !matchesStarRailTraceOwner(owner, starRailTraceOwner(latest, selection)) ||
          panelDiscardedAt(await store.read(qq, uid)) !== discardedAt) {
        throw new ProfileError("changed", "星铁面板档案已变更。");
      }
      active.throwIfAborted();
      verifyAuthority();
    }, discardedAt, active);
    if (result.status === "empty") throw new Error("米游社未返回星铁角色数据。");
    return result.status === "ready" && result.updated;
  };

  async function query(qq: string, command: PanelCommand,
    context?: StarRailGroupRankContext & Pick<MessageEvent, "uploadFile"> & {
      readonly offerLegacyPanelRecovery?: LegacyPanelRecoveryOffer;
      readonly reply?: (message: string) => unknown;
    }) {
    const { type, profileId, name } = command;
    if (type === "extreme") return queryExtremePanel(name, context?.inlineImageByteLimit);
    const uploadFile = context?.uploadFile;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    if (type === "discard") {
      if (context?.isDelegated || context?.user_id?.toString() !== qq ||
          (context.message_type !== "private" && context.message_type !== "group")) return "请在本人 QQ 会话删除星铁面板。";
      const target = "uid" in command ? command.uid : undefined;
      try {
        const source = await profiles.requestContext(qq, profileId, "sr", target);
        const owner = starRailTraceOwner(source, source.role);
        if (!owner) return "档案的登录凭据与账号不一致，请重新登录。";
        const { uid } = owner;
        if (!target) {
          const suffix = profileId === 1 ? "" : ` 档案${profileId}`;
          return `你确认要删除面板数据吗？请回复 *删除面板${uid}${suffix} 以删除面板数据。`;
        }
        if (target !== uid) return "仅允许删除当前登录档案已同步的星铁 UID。";
        await store.update({ qq, uid }, async () => {
          signal.throwIfAborted();
          const latest = await profiles.requestContext(qq, profileId, "sr", uid).catch(() => undefined);
          if (latest?.revision !== source.revision || !latest || !matchesStarRailTraceOwner(owner, starRailTraceOwner(latest, latest.role))) {
            throw new ProfileError("changed", "星铁面板档案已变更。");
          }
          signal.throwIfAborted();
        }, current => ({ document: discardedStarRailPanel(uid, Math.max(Date.now(), panelDiscardedAt(current) + 1)), result: undefined }));
        return `已删除 UID ${uid} 的星铁面板，旧面板和遗器排行登记已失效。`;
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ProfileError) {
          if (error.code === "missing" || error.code === "login-required") return `请先登录 profile ${profileId}。`;
          if (error.code === "role-missing") return "仅允许删除当前登录档案已同步的星铁 UID。";
          if (error.code === "changed") return "星铁面板档案已变更，请重新确认。";
        }
        return "星铁面板暂时无法删除，请稍后重试。";
      }
    }
    if (type === "refresh-traces" && context?.isDelegated) return "请在本人 QQ 会话刷新星铁角色行迹。";
    if ((type === "reload" || type === "showcase") && context?.isDelegated) return "请在本人 QQ 会话重新加载或查询星铁公开展板。";
    if (type === "export") {
      const group = context?.message_type === "group";
      if (group && !command.share) {
        return `请私聊发送【*导出面板${profileId === 1 ? "" : profileId}】。如确认将本人面板发到本群，请发送【*强制导出面板${profileId === 1 ? "" : profileId}】。`;
      }
      if (context?.isDelegated || (context?.message_type !== "private" && (!group || !context.group_id || !context.self_id ||
          (context.adapter !== undefined && context.adapter !== "onebot" && context.adapter !== "milky")))) return "请在绑定网关的私聊会话中导出星铁面板。";
      if (!uploadFile) return "当前会话不支持发送星铁面板文件。";
    }
    const recover = type === "update" && context?.message_type === "private" && !context.isDelegated &&
      context.user_id?.toString() === qq ? context.offerLegacyPanelRecovery : undefined;
    async function offerRecovery(uid: string) {
      if (!recover || signal.aborted) return;
      async function isEmpty() {
        return !signal.aborted && !refreshing.has(`${qq}:${uid}`) &&
          await store.read(qq, uid) === null && !await legacySnapshot(uid);
      }
      if (!await isEmpty().catch(() => false)) return;
      return recover({
        game: "sr", profileId, uid, isEmpty,
        async save(data, verify) {
          await verify();
          if (!await isEmpty()) return;
          const legacy = readLegacyPanel(uid, data);
          const avatars = legacy.avatars.filter(avatar => avatar.legacy &&
            ["mysPanelHSR", "homo", "EnkaHSR", "avocado.wiki"].includes(avatar.legacy.source));
          if (!avatars.length) return 0;
          const updatedAt = legacy.updatedAt && Date.parse(legacy.updatedAt) <= Date.now()
            ? legacy.updatedAt : new Date(0).toISOString();
          return store.update<number | undefined>({ qq, uid }, async () => {
            signal.throwIfAborted();
            await verify();
            if (refreshing.has(`${qq}:${uid}`) || await legacySnapshot(uid)) {
              throw new ProfileError("changed", "星铁面板档案已变更。");
            }
          }, current => current === null ? {
            document: { ...legacy, updatedAt, avatars },
            result: avatars.length,
          } : { result: undefined });
        },
      });
    }
    try {
      const account = await profiles.requestContext(qq, profileId, "sr").catch(error => {
        if (error instanceof ProfileError) {
          if (recover && (error.code === "login-required" || error.code === "missing" || error.code === "role-missing")) return error;
          if (type !== "update" && type !== "export" && type !== "refresh-traces" && error.code === "login-required") return undefined;
        }
        throw error;
      });
      const explicitUid = "uid" in command;
      if (account instanceof ProfileError) {
        const selected = await profiles.savedRole(qq, profileId, "sr").catch(error => {
          if (error instanceof ProfileError && (error.code === "missing" || error.code === "role-missing")) throw account;
          throw error;
        });
        if (explicitUid && command.uid !== selected.uid) return "此 UID 与所选档案当前绑定的星铁角色不一致。";
        const offer = await offerRecovery(selected.uid);
        if (offer) return offer;
        throw account;
      }
      const role = account?.role ?? await profiles.savedRole(qq, profileId, "sr");
      const { uid } = role;
      if (explicitUid && command.uid !== uid) return "此 UID 与所选档案当前绑定的星铁角色不一致。";
      const groupPanel = type === "relics" || (type === "detail" && !explicitUid && !("equipment" in command));
      const registerList = !explicitUid && (type === "list" || type === "update" || type === "reload" ||
        (type === "showcase" && !command.name));
      const observedAt = (groupPanel || registerList) && account && await groupRank?.allows(context) ? Date.now() : undefined;
      const key = `${qq}:${uid}`;
      const initialPanel = await store.read(qq, uid);
      const discardedAt = panelDiscardedAt(initialPanel);
      let revision = account?.revision;
      let traceOwner: StarRailTraceOwner | undefined;
      let snapshot: PanelSnapshot | undefined;
      let legacy: Record<string, unknown> | undefined;
      let updated = false;
      let publicLookup = false;
      async function verify(updatedRevision?: string) {
        if (updatedRevision !== undefined) revision = updatedRevision;
        signal.throwIfAborted();
        const selectedRole = traceOwner ? await profiles.savedRole(qq, profileId, "sr").catch(() => undefined) : undefined;
        const latestAccount = account ? await profiles.requestContext(qq, profileId, "sr").catch(() => undefined) : undefined;
        const latestRole = account ? latestAccount?.role : await profiles.savedRole(qq, profileId, "sr").catch(() => undefined);
        if (!latestRole || latestAccount?.revision !== revision || latestRole.uid !== uid || latestRole.region !== role.region ||
            latestRole.gameBiz !== role.gameBiz || (traceOwner && (!latestAccount || !selectedRole ||
              !matchesStarRailTraceOwner(traceOwner, starRailTraceOwner(latestAccount, selectedRole)))) ||
            panelDiscardedAt(await store.read(qq, uid)) !== discardedAt) {
          throw new ProfileError("changed", "星铁面板档案已变更，请重新查询。");
        }
      }

      if (type === "update" && account) {
        const result = await refreshPanel(account, verify, discardedAt, signal, recover ? true : undefined);
        if (result.status === "unavailable") {
          const offer = await offerRecovery(uid);
          if (offer) return offer;
          throw result.error;
        }
        if (result.status === "busy") return "此星铁角色面板正在更新，请稍后查询。";
        if (result.status === "empty") return (await offerRecovery(uid)) ?? "米游社未返回星铁角色数据，原面板已保留。";
        snapshot = result.snapshot;
        updated = result.updated;
      } else if (type !== "showcase") {
        snapshot = managedSnapshot(uid, initialPanel, false, type === "practice");
        if (!discardedAt && (!snapshot || (type === "practice" && !snapshot.avatars.length))) {
          const old = await legacySnapshot(uid);
          snapshot = old?.snapshot;
          if (old?.snapshot.avatars.length) legacy = old.data;
        }
        if (type !== "refresh-traces" && !snapshot?.avatars.length) {
          const saved = managedSnapshot(uid, await showcases.read(qq, uid), true, type === "practice");
          if (saved?.updatedAt && Date.parse(saved.updatedAt) > discardedAt) snapshot = saved;
        }
      }

      if (type === "refresh-traces" && account) {
        const selectedRole = await profiles.savedRole(qq, profileId, "sr");
        if (selectedRole.uid !== uid || selectedRole.region !== role.region || selectedRole.gameBiz !== role.gameBiz) {
          return "所选档案当前绑定的星铁角色无法核验。";
        }
        const owner = starRailTraceOwner(account, selectedRole);
        if (!owner) return "档案的登录凭据与账号不一致，请重新登录。";
        traceOwner = owner;
        if (!snapshot?.avatars.length) return `请先使用 *更新面板${profileId === 1 ? "" : profileId} 获取本人星铁面板。`;
        if (refreshing.has(key)) return "此星铁角色面板正在更新，请稍后查询。";
        refreshing.add(key);
        try {
          await verify();
          const started = Math.max(Date.now(), discardedAt + 1);
          const result = await client.fetchStarRailPanel(account, { signal });
          revision = result.revision;
          await verify();
          const incoming = confirmedStarRailTraces(snapshot, result.avatars, started);
          const entries = Object.entries(incoming);
          if (!entries.length) return "米游社未返回可核对的角色技能等级，已保留原行迹。";
          const avatarIds = new Set(snapshot.avatars.map(avatar => avatar.id));
          const count = await traces.update({ qq, uid }, verify, current => {
            const records = Object.fromEntries(Object.entries(readStarRailTraceArchive(owner, current))
              .filter(([id, entry]) => avatarIds.has(id) && entry.at > discardedAt));
            let saved = 0;
            for (const [id, entry] of entries) {
              if ((records[id]?.at ?? 0) >= entry.at) continue;
              records[id] = entry;
              saved++;
            }
            return saved ? { document: { version: 2, owner, records }, result: saved } : { result: 0 };
          });
          await verify();
          if (!count) return "此档案已有更新的星铁角色行迹，原存档已保留。";
          return `星铁角色行迹刷新成功，共核对 ${count} 位角色的普攻、战技、终结技和天赋。可用 *角色名详情${profileId === 1 ? "" : profileId} 查看。`;
        } finally {
          refreshing.delete(key);
        }
      }

      if (type === "showcase" || (type === "reload" && !discardedAt && !snapshot?.avatars.length && context?.reply)) {
        publicLookup = true;
        const bound = await profiles.savedRole(qq, profileId, "sr");
        if (bound.uid !== uid || bound.region !== role.region || bound.gameBiz !== role.gameBiz) {
          return "所选档案当前绑定的星铁角色无法核验。";
        }
        const target = showcaseTarget(bound, await readShowcaseServer());
        const refreshKey = `showcase:${key}`;
        if (refreshing.has(refreshKey)) return "此星铁公开展板正在查询，请稍后再试。";
        refreshing.add(refreshKey);
        try {
          const cached = type === "reload" ? managedSnapshot(uid, await showcases.read(qq, uid), true) : undefined;
          const started = new Date(Math.max(Date.now(), discardedAt + 1));
          if (cached?.source === target.provider && cached.updatedAt && Date.parse(cached.updatedAt) > discardedAt &&
              Date.parse(cached.updatedAt) + (whole(cached.showcaseTtl, 86_400) ?? 60) * 1000 > started.getTime()) {
            snapshot = cached;
          } else {
            await verify();
            if (type === "reload") {
              const notice = `本地暂无星铁面板，正在向 ${showcaseProviderNames[target.provider]} 查询此绑定 UID 的公开展板。`;
              const delivered = await Promise.resolve().then(() => context?.reply?.(notice)).catch(() => false);
              if (delivered !== true) return `通知发送失败，已取消公开展板回退。可使用 *展板更新面板${profileId === 1 ? "" : profileId} 主动查询。`;
            }
            await verify();
            const next = await fetchStarRailShowcase(target, signal, undefined, started);
            snapshot = await showcases.update({ qq, uid }, verify, current => {
              const previous = managedSnapshot(uid, current, true);
              if (previous?.source === target.provider && previous.updatedAt && Date.parse(previous.updatedAt) > started.getTime()) {
                return { result: previous };
              }
              return { document: next, result: next };
            });
          }
        } finally {
          refreshing.delete(refreshKey);
        }
      }

      if (!snapshot?.avatars.length) {
        if (type === "reload") await verify();
        if (type === "relic-list" || type === "practice") {
          await verify();
          if (type === "practice") return `UID ${uid} 暂无星铁角色数据，请先使用 *更新面板${profileId === 1 ? "" : profileId}。`;
          return "请先获取角色面板数据后再查看遗器列表。";
        }
        return `UID ${uid} 暂无星铁角色面板，请先使用 *更新面板${profileId === 1 ? "" : profileId}。`;
      }
      if (registerList && observedAt !== undefined && groupRank && context?.user_id?.toString() === qq &&
          snapshot.avatars.some(avatar => !["customize", "change", "share"].includes(avatar.legacy?.source ?? ""))) {
        await groupRank.register(context, profileId, role, observedAt, verify).catch(() => undefined);
        await verify();
      }
      if (account && context?.user_id?.toString() === qq && !context.isDelegated &&
          (type === "detail" || type === "damage" || type === "export" || type === "practice") && (snapshot.source === "legacy" || snapshot.source === "miyoushe")) {
        const selectedRole = await profiles.savedRole(qq, profileId, "sr").catch(() => undefined);
        const owner = selectedRole && starRailTraceOwner(account, selectedRole);
        if (owner) {
          const records = await traces.read(qq, uid).then(raw => readStarRailTraceArchive(owner, raw)).catch(() => undefined);
          if (records && Object.keys(records).length) {
            traceOwner = owner;
            await verify();
            snapshot = applyStarRailTraces(snapshot, records, discardedAt);
          }
        }
      }
      if (type === "export" && uploadFile) {
        const talentCons = new Map<string, Record<string, unknown>>();
        const ranked = legacy && snapshot.avatars.filter(avatar => (avatar.rank ?? 0) > 0 && avatar.skills.some(skill => skill.effective));
        if (ranked?.length) {
          const theme = await readTheme();
          await Promise.all(ranked.map(async avatar => {
            const unlocks = await readPanelTalentCons(avatar, theme);
            if (unlocks) talentCons.set(avatar.id, unlocks);
          }));
        }
        const { name, bytes, format, unresolved } = panelExportFile(snapshot, legacy, talentCons);
        await verify();
        const outcome = await uploadFile({ name, bytes }).catch(() => "unknown");
        if (outcome === "rejected") return "星铁面板文件发送失败，请检查网关的文件发送功能。";
        if (outcome !== "confirmed") return "星铁面板文件发送结果未确认，请在当前会话查看。";
        const retained = unresolved ? `旧格式有 ${unresolved} 项技能无法确认基础等级，已保留原档对应字段。` : "";
        return `已导出 ${name}（${format}）。${retained}`;
      }
      const theme = await readTheme();
      if (type === "practice") {
        const models = await makePanelPracticeCards(snapshot, theme, signal, command.rarity, legacy);
        await verify();
        if (!models.length) return `UID ${uid} 暂无符合筛选条件的星铁角色。`;
        const first = models[0]!;
        const title = `UID ${uid} · 面板练度统计 · 共 ${first.total} 名角色`;
        const nodes = [];
        for (const model of models) {
          const files = await renderStarRailPanelPractice(model, theme.root).then(card => [card.png]).catch(() => false as const);
          await verify();
          if (files && files.length) nodes.push(...files.map(file => ({ type: "image" as const, file })));
          else {
            const updateTimes = [model.updateTime.profile && `更新面板 ${model.updateTime.profile}`,
              model.updateTime.mys && `米游社 ${model.updateTime.mys}`].filter(Boolean).join(" · ");
            nodes.push([title, ...model.avatars.map(row => {
              const weapon = row.weapon && `${row.weapon.name} Lv.${row.weapon.level ?? "—"} 叠影 ${row.weapon.affix ?? "—"}`;
              const rating = row.rating ? `遗器 ${row.rating.mark} ${row.rating.markClass}` : "遗器暂无面板数据";
              return `${row.name} · Lv.${row.level ?? "—"} · ${row.cons ?? "—"} 魂 · A/E/Q/T ${row.talent.map(skill => skill.level).join("/")} · ${weapon || "光锥—"} · ${rating}`;
            }), ...(updateTimes ? [updateTimes] : [])].join("\n"));
          }
        }
        return nodes.length === 1 ? nodes[0] : { type: "forward" as const, nodes: [title, ...nodes] };
      }
      if (type === "relic-list") {
        const model = await makePanelRelicListCard(snapshot, theme, signal, explicitUid);
        await verify();
        if (!model.eligible) return "请先获取角色面板数据后再查看遗器列表。";
        if (!model.artis.length) return "当前面板没有符合旧版词条筛选条件的遗器。";
        const title = `UID ${uid} · 遗器列表`;
        const files = await renderStarRailRelicList(model, theme.root).then(card => [card.png]).catch(() => false as const);
        await verify();
        if (files && files.length) {
          const images = files.map(file => ({ type: "image" as const, file }));
          return images.length === 1 ? images[0] : { type: "forward" as const, nodes: [title, ...images] };
        }
        return [title, ...model.artis.map(({ avatar, name, mark, markClass }) => `${avatar} · ${name} · ${mark} 分 · ${markClass}`)].join("\n");
      }
      let selected: PanelAvatar | undefined;
      const skillPreview = "equipment" in command && "skillLevels" in command.equipment;
      let equipmentLabel: string | undefined;
      let equipmentRows: PanelAttributeRows | undefined;
      let equipmentMetadata: Awaited<ReturnType<typeof readPanelDamageMetadata>>;
      const archiveSuffix = profileId === 1 ? "" : ` ${profileId}`;
      if (type === "damage" || type === "detail" || type === "relics") {
        selected = findPanelAvatar(snapshot.avatars, name, theme);
        await verify();
        if (!selected) return `当前星铁面板中没有「${name}」，请用 *面板${archiveSuffix} 查看列表。`;
        if (type === "damage" && !hasPersonalDamage(selected.id)) {
          return `「${selected.name}」的星铁个人伤害规则尚未接入。当前支持${personalDamageNames}。`;
        }
        if ("equipment" in command) {
          const change = command.equipment;
          let temporary = selected;
          let promotion: number | undefined;
          const labels: string[] = [];
          if ("donor" in change) {
            const donor = findPanelAvatar(snapshot.avatars, change.donor, theme);
            if (!donor) return `当前星铁面板中没有换装来源「${change.donor}」。`;
            const replacement = replacePanelEquipment(temporary, donor, change.slots);
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            labels.push(replacement.label);
          } else if ("superimposition" in change) {
            const equipped = temporary.cone && object(theme.weapons[temporary.cone.id]);
            const replacement = changePanelSuperimposition(temporary, change.superimposition, change.coneName, text(equipped?.name));
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            labels.push(replacement.label);
          } else if ("namedCone" in change) {
            const named = object(theme.weapons[change.namedCone]);
            const previous = temporary.cone && object(theme.weapons[temporary.cone.id]);
            const coneName = text(named?.name), coneStar = whole(named?.star, 5);
            if (!coneName || !coneStar) return "本地主题缺少指定光锥资料。";
            const originalMetadata = await readPanelDamageMetadata(temporary, theme);
            await verify();
            if (!originalMetadata || !temporary.level) return `「${temporary.name}」缺少可确认的当前光锥和角色属性资料。`;
            const current = changePanelLevel(temporary, temporary.level, originalMetadata);
            if ("error" in current) return current.error;
            const replacement = changePanelNamedCone(current.avatar, { id: change.namedCone, name: coneName, star: coneStar }, whole(previous?.star, 5));
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            promotion = current.promotion;
            labels.push(replacement.label);
          } else if ("relicSets" in change) {
            const replacement = changePanelRelicSets(temporary, change.relicSets, theme.relicSets);
            if ("error" in replacement) return replacement.error;
            temporary = replacement.avatar;
            labels.push(replacement.label);
          }

          // A donor changes the cone metadata, but the talent thresholds belong to the target.
          equipmentMetadata = await readPanelDamageMetadata(temporary, theme);
          // At a saved level boundary, the level preview needs the original base HP before other changes clear it.
          if ("level" in change && equipmentMetadata) {
            const replacement = changePanelLevel(temporary, change.level, equipmentMetadata);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            promotion = replacement.promotion;
            labels.push(replacement.label);
          }
          if ("eidolon" in change && change.eidolon !== undefined) {
            const replacement = changePanelEidolon(temporary, change.eidolon, equipmentMetadata?.character.talentCons);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            labels.unshift(replacement.label);
          }
          if ("fullTraces" in change) {
            const replacement = changePanelFullTraces(temporary, equipmentMetadata?.character.tree);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            labels.push(replacement.label);
          }
          if ("skillLevels" in change) {
            const replacement = changePanelCoreSkills(temporary, change.skillLevels, equipmentMetadata?.character.talentCons);
            if ("error" in replacement) {
              await verify();
              return replacement.error;
            }
            temporary = replacement.avatar;
            labels.push(replacement.label);
          }
          equipmentRows = equipmentMetadata && calculateEquipmentAttributeRows(temporary, equipmentMetadata, promotion);
          await verify();
          if (!equipmentRows) return `「${selected.name}」临时面板无法复算，缺少角色、光锥或遗器的完整数据。`;
          equipmentLabel = labels.join(" · ");
          selected = { ...temporary, stats: formatPanelAttributeRows(equipmentRows) };
        }
      }

      if (type === "damage" && selected) {
        const metadata = equipmentMetadata ?? await readPanelDamageMetadata(selected, theme);
        const scenario = "scenario" in command ? command.scenario : undefined;
        const result = metadata ? readStarRailPersonalDamage(selected, metadata, scenario, equipmentRows, skillPreview) : { reason: "角色或光锥主题数据不齐", scenarioCount: undefined };
        await verify();
        if (result.scenarioCount !== undefined) {
          return equipmentLabel
            ? `${selected.name}在当前星魂下支持 ${result.scenarioCount} 个伤害场景，请调整原试算指令中的伤害序号。`
            : `${selected.name}在当前星魂下支持 ${result.scenarioCount} 个伤害场景，可用 *${selected.name}伤害${archiveSuffix} 查看编号。`;
        }
        if (!result.damage) return `${selected.name}伤害计算暂不可用。${result.reason}。`;
        const damage = equipmentLabel ? { ...result.damage, buffs: [equipmentLabel, ...result.damage.buffs] } : result.damage;
        const card = await renderStarRailPersonalDamage(damage, theme.root, selected.id, context?.inlineImageByteLimit, theme.commaGroup)
          .catch(() => undefined);
        await verify();
        if (card) return { type: "image" as const, file: card.png };
        const displayed = (value: string | number) => groupPanelNumber(String(value), theme.commaGroup);
        return [equipmentLabel, ...damage.rows.map(row => {
          if (row.average === undefined) return `${row.title} · ${row.note}`;
          return row.critical === undefined ? `${row.title} · ${personalDamageMetricLabel[row.metric]} ${displayed(row.percentage ?? row.display ?? Math.round(row.average))}` :
            `${row.title} · 暴击 ${displayed(Math.round(row.critical))} · 期望 ${displayed(Math.round(row.average))}`;
        })].filter(Boolean).join("\n");
      }
      let models;
      let relicScore: { readonly mark?: string; readonly markClass?: string; readonly incomplete?: number } | undefined;
      if (selected) {
        if (type === "relics") {
          const relics = await makePanelRelicCard(snapshot, selected, theme, signal);
          await verify();
          if (!relics) return `「${selected.name}」暂无可评分的遗器，可用 *更新面板${profileId === 1 ? "" : profileId} 补齐面板。`;
          models = [relics];
          relicScore = relics.artisDetail;
        } else {
          const detail = await makePanelDetailCard(snapshot, selected, theme, signal, { equipmentLabel, skillPreview, localOnly: explicitUid });
          models = [detail];
          relicScore = detail.artisDetail;
        }
      } else {
        models = await makePanelListCards(snapshot, theme, profileId, signal, updated, type === "reload" || publicLookup);
      }
      const images = [];
      for (const model of models) {
        await verify();
        const native = "damageRows" in model ? renderStarRailPanelDetail(model, theme.root, "auto", context?.inlineImageByteLimit)
          : "chars" in model ? renderStarRailPanelList(model, theme.root)
            : renderStarRailRelicMark(model, theme.root);
        const result = await native.then(card => [card.png]).catch(() => false as const);
        if (!result) {
          await verify();
          if (type === "update") return `UID ${uid} 星铁面板已更新，共 ${snapshot.avatars.length} 位角色。图片暂时无法生成。`;
          if (selected) {
            if (type === "relics" && relicScore) return `UID ${uid} · ${selected.name} · 遗器总分 ${relicScore.mark} · ${relicScore.markClass}`;
            const visible = [selected.name, selected.level && `Lv.${selected.level}`, selected.rank !== undefined && `${selected.rank}魂`,
              selected.cone?.name, ...selected.relics.map(relic => relic.name)].filter(Boolean).join(" · ");
            return [`UID ${uid}`, equipmentLabel, visible].filter(Boolean).join("\n");
          }
          const label = snapshot.source === "miyoushe" || snapshot.source === "legacy"
            ? "星铁面板" : `星铁公开展板 · ${showcaseProviderNames[snapshot.source]}`;
          return `UID ${uid} ${label} · ${snapshot.avatars.length} 位角色\n${snapshot.avatars.map(avatar => avatar.name).join("、")}`;
        }
        images.push(...result.map(file => ({ type: "image" as const, file })));
      }
      await verify();
      if (images.length === 1) {
        if (observedAt !== undefined && groupRank && context && context.user_id?.toString() === qq && selected &&
            relicScore?.incomplete === 0 && relicScore.mark && relicScore.markClass) {
          await groupRank.observe(context, profileId, role, {
            characterId: selected.id, score: Number(relicScore.mark), grade: relicScore.markClass, observedAt,
          }, verify).catch(() => undefined);
          await verify();
        }
        const model = models[0];
        const photo = model && "original" in model ? model.original : undefined;
        const owner = type === "detail" && account ? starRailTraceOwner(account, role) : undefined;
        if (context?.self_id && context.user_id?.toString() === qq && photo && owner) {
          return { type: "delivery" as const, message: images[0]!, async onDelivered(confirmed: number) {
            await verify();
            await originals.delivered(context, confirmed, { ...owner, profileId }, photo);
          } };
        }
        return images[0];
      }
      if (images.length) return { type: "forward" as const, nodes: [`UID ${uid} · ${snapshot.avatars.length} 位角色`, ...images] };
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ProfileError) {
        if (error.code === "changed") return "星铁面板档案已变更，请重新查询。";
        if (error.code === "missing" || error.code === "login-required") return `[starrail] 请先登录 profile ${profileId}。`;
        if (error.code === "role-missing") return `[starrail] profile ${profileId} 没有同步星铁 UID。`;
      }
      if (error instanceof ShowcaseError) return error.message;
      if (error instanceof GameRecordRequestError) return error.message;
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return "星铁面板档案已变更，请重新查询。";
        if (error.code === "refresh") return "星铁面板 Cookie 未能续期，请确认当前档案登录状态。";
        if (error.code === "invalid-input") return "星铁面板更新需使用档案中已同步的国服星铁角色。";
        if (error.retcode === 10102) return "米游社面板未公开或当前档案没有绑定该角色，原面板已保留。";
      }
      if (type === "export") return "星铁面板导出失败，请检查本地面板档案。";
      if (type === "reload") return "星铁面板暂时无法重新加载，请检查本地面板档案。";
      if (type === "refresh-traces") return "星铁角色行迹暂时无法刷新，已保留原行迹。";
      return "星铁面板暂时无法读取或更新，请稍后重试。";
    }
  }
  return Object.assign(query, { rebuild, original: originals.reply });
}
