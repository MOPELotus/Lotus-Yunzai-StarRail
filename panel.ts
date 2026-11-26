import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { readPanelTrialDisplay, trialDamageTitleLines } from "../../lib/panel-trial-display.ts";
import { fileURLToPath } from "node:url";
import { MAX_PROFILE_ID, ProfileError, type createProfileStore, type ProfileRequestContext } from "@lotus-yunzai/account";
import { GameRecordRequestError, HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { MessageEvent, ReplyOptions } from "../../lib/messages.ts";
import type { LegacyPanelRecoveryOffer } from "../../lib/legacy-panel-recovery-flow.ts";
import { createStarRailPanelOriginals } from "./panel-original.ts";
import type { PanelRebuilder } from "../../lib/panel-rebuild.ts";
import { findPanelAvatar, makePanelDetailCard, makePanelListCards, makePanelPracticeCards, makePanelRelicCard, makePanelRelicListCard, readPanelDamageMetadata, readPanelTalentCons, readTheme } from "./panel-card.ts";
import { calculateEquipmentAttributeRows, changePanelLevel, formatPanelAttributeRows } from "./panel-attributes.ts";
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
import { resolveStarRailCharacter } from "./rank-statistics.ts";
import { formatStarRailDamageChange, hasPersonalDamage, personalDamageMetricLabel, personalDamageNames,
  readStarRailPersonalDamage, type StarRailPersonalDamage } from "./panel-damage.ts";
import { renderStarRailPanelPractice } from "./panel-practice-skia.ts";
import { renderStarRailPanelList } from "./panel-list-skia.ts";
import { renderStarRailRelicList, renderStarRailRelicMark } from "./panel-relic-skia.ts";
import { renderStarRailPanelDetail } from "./panel-detail-skia.ts";
import { starRailUsesBuiltInPortrait } from "./panel-original-config.ts";
import { renderStarRailPersonalDamage } from "./panel-damage-card.ts";
import { groupPanelNumber } from "../../lib/group-panel-rank-settings.ts";
import type { createStarRailGroupRelicRank, StarRailGroupRankContext } from "./group-relic-rank.ts";
import { id as readId, normalizePanel, object, readLegacyPanel, text, whole, type PanelAvatar, type PanelCommand, type PanelSnapshot } from "./panel-model.ts";

export { legacySnapshot } from "./panel-legacy.ts";
const extremePanelUid = "100000000";
const bundledExtremePanel = fileURLToPath(new URL("../../resources/extreme-panels/sr.json", import.meta.url));
const showcaseDirectory = fileURLToPath(new URL("../../data/starrail/showcases/", import.meta.url));
const traceDirectory = fileURLToPath(new URL("../../data/starrail/trace-levels/", import.meta.url));
const configRoot = new URL("../../", import.meta.url);
const maxBytes = 8 * 1024 * 1024;

function panelDamageText(damage: StarRailPersonalDamage, commaGroup?: number) {
  function display(value: string | number, difference: number | undefined) {
    const number = groupPanelNumber(String(value), commaGroup);
    return difference === undefined ? number : `${number}（${formatStarRailDamageChange(difference)}）`;
  }
  return damage.rows.map(row => {
    const title = trialDamageTitleLines(row.title, damage.trialTitleMode).join("\n");
    if (row.average === undefined) return `${title} · ${row.note}`;
    const average = display(row.percentage ?? row.display ?? Math.round(row.average), row.change?.average);
    if (row.critical === undefined) return `${title} · ${personalDamageMetricLabel[row.metric]} ${average}`;
    return $t("panel.text_a50dfb8cb3", { "title": title, "value2": display(Math.round(row.critical), row.change?.critical), "average": average });
  });
}

export function managedSnapshot(uid: string, raw: unknown, showcase = false, allowEmpty = false) {
  if (raw === null) return;
  const stored = object(raw);
  const source = stored?.source;
  const allowedSource = showcase ? typeof source === "string" && Object.hasOwn(showcaseProviderNames, source) : source === "miyoushe" || source === "legacy";
  if (stored?.version !== 1 || stored.uid !== uid || !allowedSource || typeof stored.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(stored.updatedAt)) || !Array.isArray(stored.avatars) || (!allowEmpty && !stored.avatars.length && !panelDiscardedAt(raw)) ||
      stored.avatars.length > 256 || stored.avatars.some(row => !object(row) || !readId(row.id) || typeof row.name !== "string" ||
        !Array.isArray(row.skills) || !Array.isArray(row.traces) || !Array.isArray(row.stars) || !Array.isArray(row.stats) || !Array.isArray(row.relics))) {
    throw new Error($t("panel.text_b864dec361"));
  }
  return stored as unknown as PanelSnapshot;
}

export function createStarRailPersonalPanelReader(lock: AcquireRoleArchiveLock, archiveDirectory?: string) {
  const store = createStarRailPanelArchive(lock, archiveDirectory);
  const traces = createRoleJsonArchive(traceDirectory, lock, { subject: $t("panel.text_86266aa7b7"), lockSuffix: "traces", maxBytes: 128 * 1024, rejectNull: true });
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
  { qFace = true } = {},
) {
  const store = createStarRailPanelArchive(lock, archiveDirectory);
  const showcases = createRoleJsonArchive(showcaseArchiveDirectory, lock, { subject: $t("panel.text_2d34c03b5f"), lockSuffix: "showcase", maxBytes, rejectNull: true });
  const traces = createRoleJsonArchive(traceDirectory, lock, { subject: $t("panel.text_86266aa7b7"), lockSuffix: "traces", maxBytes: 128 * 1024, rejectNull: true });
  const originals = createStarRailPanelOriginals(profiles, signal, { storage: {
    async get(key) { return globalThis.redis?.get(key); },
    async set(key, value, seconds) { return globalThis.redis?.set(key, value, { EX: seconds }); },
  } });
  const refreshing = new Set<string>();

  async function queryExtremePanel(name: string, inlineImageByteLimit?: number, builtInPortraitOnly = false) {
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
          localOnly: true, sourceLabel: $t("panel.text_bda8dd0ff5"), allowCustomizedSample: sampleFile !== undefined, builtInPortraitOnly,
        });
        if (signal.aborted) return;
        const card = await renderStarRailPanelDetail(model, theme.root, "auto", inlineImageByteLimit).catch(() => undefined);
        if (signal.aborted) return;
        return card ? { type: "image" as const, file: card.png } : $t("panel.text_233849b139", { "name": avatar.name });
      }
      if (available) return $t("panel.text_d5393570b4");
      return unreadable ? $t("panel.text_b498b4fa98") : $t("panel.text_f02e3564f6");
    } catch {
      if (!signal.aborted) return $t("panel.text_b498b4fa98");
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
    if (!owner) throw new ProfileError("changed", $t("panel.text_c2e478daea"));
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
        throw new ProfileError("changed", $t("panel.text_c2e478daea"));
      }
      active.throwIfAborted();
      verifyAuthority();
    }, discardedAt, active);
    if (result.status === "empty") throw new Error($t("panel.text_7d81550030"));
    return result.status === "ready" && result.updated;
  };

  async function query(qq: string, command: PanelCommand,
    context?: StarRailGroupRankContext & Pick<MessageEvent, "uploadFile" | "privateCredentialSignal"> & {
      readonly offerLegacyPanelRecovery?: LegacyPanelRecoveryOffer;
      readonly reply?: (message: string, quote?: boolean, options?: ReplyOptions) => unknown;
    }) {
    const { type, profileId, name } = command;
    if (type === "extreme") return queryExtremePanel(name, context?.inlineImageByteLimit, await starRailUsesBuiltInPortrait(context));
    const uploadFile = context?.uploadFile;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return $t("panel.text_68901e8078", { "MAX_PROFILE_ID": MAX_PROFILE_ID });
    if (type === "discard") {
      if (context?.isDelegated || context?.user_id?.toString() !== qq ||
          (context.message_type !== "private" && context.message_type !== "group")) return $t("panel.text_5df4b85862");
      const target = "uid" in command ? command.uid : undefined;
      try {
        const source = await profiles.requestContext(qq, profileId, "sr", target);
        const owner = starRailTraceOwner(source, source.role);
        if (!owner) return $t("panel.text_dbd093cee6");
        const { uid } = owner;
        if (!target) {
          return $t("panel.text_b222031fca", { "uid": uid, "profileId": profileId });
        }
        if (target !== uid) return $t("panel.text_8800069a32");
        await store.update({ qq, uid }, async () => {
          signal.throwIfAborted();
          const latest = await profiles.requestContext(qq, profileId, "sr", uid).catch(() => undefined);
          if (latest?.revision !== source.revision || !latest || !matchesStarRailTraceOwner(owner, starRailTraceOwner(latest, latest.role))) {
            throw new ProfileError("changed", $t("panel.text_c2e478daea"));
          }
          signal.throwIfAborted();
        }, current => ({ document: discardedStarRailPanel(uid, Math.max(Date.now(), panelDiscardedAt(current) + 1)), result: undefined }));
        return $t("panel.text_a63f150734", { "uid": uid });
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ProfileError) {
          if (error.code === "missing" || error.code === "login-required") return $t("panel.text_76720712c8", { "profileId": profileId });
          if (error.code === "role-missing") return $t("panel.text_8800069a32");
          if (error.code === "changed") return $t("panel.text_d571a6c08b");
        }
        return $t("panel.text_443fba56e5");
      }
    }
    if (type === "refresh-traces" && context?.isDelegated) return $t("panel.text_66515e6b90");
    if ((type === "reload" || type === "showcase") && context?.isDelegated) return $t("panel.text_75d2c1bcc8");
    if (type === "export") {
      const group = context?.message_type === "group";
      if (group && !command.share) {
        return $t("panel.text_9786b04902", { "profileId": profileId, "value2": profileId });
      }
      if (context?.isDelegated || (context?.message_type !== "private" && (!group || !context.group_id || !context.self_id ||
          (context.adapter !== undefined && context.adapter !== "onebot" && context.adapter !== "milky")))) return $t("panel.text_9040b03d92");
      if (!uploadFile) return $t("panel.text_f141e670ab");
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
              throw new ProfileError("changed", $t("panel.text_c2e478daea"));
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
        if (explicitUid && command.uid !== selected.uid) return $t("panel.text_370919db22");
        const offer = await offerRecovery(selected.uid);
        if (offer) return offer;
        throw account;
      }
      const role = account?.role ?? await profiles.savedRole(qq, profileId, "sr");
      const { uid } = role;
      if (explicitUid && command.uid !== uid) return $t("panel.text_370919db22");
      const namedPanel = (type === "detail" || type === "damage" || type === "relics") && !("equipment" in command);
      const allowEmptyPanel = namedPanel || type === "list" || type === "reload" || type === "practice";
      const groupPanel = type === "relics" || (type === "detail" && !explicitUid && !("equipment" in command));
      const registerList = !explicitUid && (type === "list" || type === "update" || type === "reload" ||
        (type === "showcase" && !command.name));
      const observedAt = (groupPanel || registerList) && account && context?.user_id?.toString() === qq && await groupRank?.allows(context) ? Date.now() : undefined;
      const key = `${qq}:${uid}`;
      const initialPanel = await store.read(qq, uid);
      const discardedAt = panelDiscardedAt(initialPanel);
      let revision = account?.revision;
      let traceOwner: StarRailTraceOwner | undefined;
      let snapshot: PanelSnapshot | undefined;
      let legacy: Record<string, unknown> | undefined;
      let updated = false;
      let publicLookup = false;
      let fallbackSession: AbortSignal | undefined;
      let preloadedTheme: Awaited<ReturnType<typeof readTheme>> | undefined;
      async function verify(updatedRevision?: string) {
        if (updatedRevision !== undefined) revision = updatedRevision;
        signal.throwIfAborted();
        fallbackSession?.throwIfAborted();
        const selectedRole = traceOwner ? await profiles.savedRole(qq, profileId, "sr").catch(() => undefined) : undefined;
        const latestAccount = account ? await profiles.requestContext(qq, profileId, "sr").catch(() => undefined) : undefined;
        const latestRole = account ? latestAccount?.role : await profiles.savedRole(qq, profileId, "sr").catch(() => undefined);
        if (!latestRole || latestAccount?.revision !== revision || latestRole.uid !== uid || latestRole.region !== role.region ||
            latestRole.gameBiz !== role.gameBiz || (traceOwner && (!latestAccount || !selectedRole ||
              !matchesStarRailTraceOwner(traceOwner, starRailTraceOwner(latestAccount, selectedRole)))) ||
            panelDiscardedAt(await store.read(qq, uid)) !== discardedAt) {
          throw new ProfileError("changed", $t("panel.text_7a535890ba"));
        }
        fallbackSession?.throwIfAborted();
      }

      if (type === "update" && account) {
        const result = await refreshPanel(account, verify, discardedAt, signal, recover ? true : undefined);
        if (result.status === "unavailable") {
          const offer = await offerRecovery(uid);
          if (offer) return offer;
          throw result.error;
        }
        if (result.status === "busy") return $t("panel.text_60c0cd6d32");
        if (result.status === "empty") return (await offerRecovery(uid)) ?? $t("panel.text_7ff1f509d2");
        snapshot = result.snapshot;
        updated = result.updated;
      } else if (type !== "showcase") {
        snapshot = managedSnapshot(uid, initialPanel, false, allowEmptyPanel);
        if (!discardedAt && !snapshot?.avatars.length) {
          const old = await legacySnapshot(uid);
          snapshot = old?.snapshot;
          if (old?.snapshot.avatars.length) legacy = old.data;
        }
        if (type !== "refresh-traces" && !snapshot?.avatars.length) {
          const saved = managedSnapshot(uid, await showcases.read(qq, uid), true, allowEmptyPanel);
          if (saved?.updatedAt && Date.parse(saved.updatedAt) > discardedAt) snapshot = saved;
        }
      }

      if (type === "refresh-traces" && account) {
        const selectedRole = await profiles.savedRole(qq, profileId, "sr");
        if (selectedRole.uid !== uid || selectedRole.region !== role.region || selectedRole.gameBiz !== role.gameBiz) {
          return $t("panel.text_3580284441");
        }
        const owner = starRailTraceOwner(account, selectedRole);
        if (!owner) return $t("panel.text_dbd093cee6");
        traceOwner = owner;
        if (!snapshot?.avatars.length) return $t("panel.text_23c915b125", { "value1": profileId === 1 ? "" : profileId });
        if (refreshing.has(key)) return $t("panel.text_60c0cd6d32");
        refreshing.add(key);
        try {
          await verify();
          const started = Math.max(Date.now(), discardedAt + 1);
          const result = await client.fetchStarRailPanel(account, { signal });
          revision = result.revision;
          await verify();
          const incoming = confirmedStarRailTraces(snapshot, result.avatars, started);
          const entries = Object.entries(incoming);
          if (!entries.length) return $t("panel.text_1ad426dcce");
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
          if (!count) return $t("panel.text_d10b2b8bd5");
          return $t("panel.text_850303c8b2", { "count": count, "value2": profileId === 1 ? "" : profileId });
        } finally {
          refreshing.delete(key);
        }
      }

      const canUsePublicFallback = !discardedAt && (!explicitUid || type === "reload") && !context?.isDelegated && context?.reply &&
        context.user_id?.toString() === qq && (context.message_type === "private" || context.message_type === "group");
      let publicFallback = Boolean(canUsePublicFallback && !snapshot?.avatars.length && (type === "list" || type === "reload"));
      if (canUsePublicFallback && namedPanel) {
        preloadedTheme = await readTheme();
        publicFallback = !findPanelAvatar(snapshot?.avatars ?? [], name, preloadedTheme) && Boolean(await resolveStarRailCharacter(name));
      }
      if (type === "showcase" || publicFallback) {
        if (publicFallback) fallbackSession = context?.message_type === "group" ? context.groupActivitySignal : context?.privateCredentialSignal;
        const showcaseSignal = fallbackSession ? AbortSignal.any([signal, fallbackSession]) : signal;
        await verify();
        const bound = await profiles.savedRole(qq, profileId, "sr");
        if (bound.uid !== uid || bound.region !== role.region || bound.gameBiz !== role.gameBiz) {
          return $t("panel.text_3580284441");
        }
        const target = showcaseTarget(bound, await readShowcaseServer());
        const refreshKey = `showcase:${key}`;
        if (refreshing.has(refreshKey)) return $t("panel.text_8ec0abf712");
        refreshing.add(refreshKey);
        try {
          const cached = publicFallback ? managedSnapshot(uid, await showcases.read(qq, uid), true) : undefined;
          const started = new Date(Math.max(Date.now(), discardedAt + 1));
          let publicSnapshot;
          if (cached?.source === target.provider && cached.updatedAt && Date.parse(cached.updatedAt) > discardedAt &&
              Date.parse(cached.updatedAt) + (whole(cached.showcaseTtl, 86_400) ?? 60) * 1000 > started.getTime()) {
            publicSnapshot = cached;
          } else {
            await verify();
            if (publicFallback) {
              const absent = namedPanel ? $t("panel.text_0254a3b80e", { "name": name }) : $t("panel.text_f50d1fce13");
              const notice = $t("panel.text_c42026396b", { "absent": absent, "value2": showcaseProviderNames[target.provider] });
              let confirmed = false;
              const accepted = await Promise.resolve().then(() =>
                context?.reply?.(notice, false, { onDelivered() { confirmed = true; } })).catch(() => false);
              if (accepted !== true || !confirmed) return $t("panel.text_6073c50cbc", { "value1": profileId === 1 ? "" : profileId });
            }
            await verify();
            const next = await fetchStarRailShowcase(target, showcaseSignal, undefined, started);
            publicSnapshot = await showcases.update({ qq, uid }, verify, current => {
              const previous = managedSnapshot(uid, current, true);
              if (previous?.source === target.provider && previous.updatedAt && Date.parse(previous.updatedAt) > started.getTime()) {
                return { result: previous };
              }
              return { document: next, result: next };
            });
          }
          if (!publicFallback || !namedPanel || (preloadedTheme && findPanelAvatar(publicSnapshot.avatars, name, preloadedTheme))) {
            snapshot = publicSnapshot;
            publicLookup = true;
          }
        } finally {
          refreshing.delete(refreshKey);
        }
      }

      if (!snapshot?.avatars.length) {
        if (type === "reload" || publicFallback) await verify();
        if (type === "relic-list" || type === "practice") {
          await verify();
          if (type === "practice") return $t("panel.text_3bc476444f", { "uid": uid, "value2": profileId === 1 ? "" : profileId });
          return $t("panel.text_17cdb4af42");
        }
        return $t("panel.text_86eb29d272", { "uid": uid, "value2": profileId === 1 ? "" : profileId });
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
        if (outcome === "rejected") return $t("panel.text_4314bb01b9");
        if (outcome !== "confirmed") return $t("panel.text_f9bbf47236");
        const retained = unresolved ? $t("panel.text_1d96613ea3", { "unresolved": unresolved }) : "";
        return $t("panel.text_320e06fbd7", { "name": name, "format": format, "retained": retained });
      }
      const theme = preloadedTheme ?? await readTheme();
      if (type === "practice") {
        const models = await makePanelPracticeCards(snapshot, theme, signal, command.rarity, legacy);
        await verify();
        if (!models.length) return $t("panel.text_0731389216", { "uid": uid });
        const first = models[0]!;
        const title = $t("panel.text_6e81d0d44a", { "uid": uid, "total": first.total });
        const nodes = [];
        for (const model of models) {
          const files = await renderStarRailPanelPractice(model, theme.root, "auto", context?.inlineImageByteLimit).then(card => [card.png]).catch(() => false as const);
          await verify();
          if (files && files.length) nodes.push(...files.map(file => ({ type: "image" as const, file })));
          else {
            const updateTimes = [model.updateTime.profile && $t("panel.text_bcc3ac4d26", { "profile": model.updateTime.profile }),
              model.updateTime.mys && $t("panel.text_5531563d2e", { "mys": model.updateTime.mys })].filter(Boolean).join(" · ");
            nodes.push([title, ...model.avatars.map(row => {
              const weapon = row.weapon && $t("panel.text_4f2fc3d385", { "name": row.weapon.name, "value2": row.weapon.level ?? "—", "value3": row.weapon.affix ?? "—" });
              const rating = row.rating ? $t("panel.text_ef17e8101e", { "mark": row.rating.mark, "markClass": row.rating.markClass }) : $t("panel.text_e0ad3b6f5e");
              return $t("panel.text_26c0e139d9", { "name": row.name, "value2": row.level ?? "—", "value3": row.cons ?? "—", "value4": row.talent.map(skill => skill.level).join("/"), "value5": weapon || $t("panel.text_089a418766"), "rating": rating });
            }), ...(updateTimes ? [updateTimes] : [])].join("\n"));
          }
        }
        return nodes.length === 1 ? nodes[0] : { type: "forward" as const, nodes: [title, ...nodes] };
      }
      if (type === "relic-list") {
        const model = await makePanelRelicListCard(snapshot, theme, signal, explicitUid);
        await verify();
        if (!model.eligible) return $t("panel.text_17cdb4af42");
        if (!model.artis.length) return $t("panel.text_0941d92863");
        const title = $t("panel.text_c31d4108d2", { "uid": uid });
        const files = await renderStarRailRelicList(model, theme.root).then(card => [card.png]).catch(() => false as const);
        await verify();
        if (files && files.length) {
          const images = files.map(file => ({ type: "image" as const, file }));
          return images.length === 1 ? images[0] : { type: "forward" as const, nodes: [title, ...images] };
        }
        return [title, ...model.artis.map(({ avatar, name, mark, markClass }) => $t("panel.text_6c1dc5edcf", { "avatar": avatar, "name": name, "mark": mark, "markClass": markClass }))].join("\n");
      }
      let selected: PanelAvatar | undefined;
      const skillPreview = "equipment" in command && "skillLevels" in command.equipment;
      let equipmentLabel: string | undefined;
      let previewDamage: (ReturnType<typeof readStarRailPersonalDamage> & { damage?: StarRailPersonalDamage }) | undefined;
      const archiveSuffix = profileId === 1 ? "" : ` ${profileId}`;
      if (type === "damage" || type === "detail" || type === "relics") {
        selected = findPanelAvatar(snapshot.avatars, name, theme);
        await verify();
        if (!selected) return $t("panel.text_a886dd92b0", { "name": name, "archiveSuffix": archiveSuffix });
        if (type === "damage" && !hasPersonalDamage(selected.id)) {
          return $t("panel.text_98292ec141", { "name": selected.name, "personalDamageNames": personalDamageNames });
        }
        if ("equipment" in command) {
          const change = command.equipment;
          let temporary = selected;
          let promotion: number | undefined;
          const labels: string[] = [];
          if ("donor" in change) {
            const donor = findPanelAvatar(snapshot.avatars, change.donor, theme);
            if (!donor) return $t("panel.text_864b407dfd", { "donor": change.donor });
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
            if (!coneName || !coneStar) return $t("panel.text_7d478364e0");
            const originalMetadata = await readPanelDamageMetadata(temporary, theme);
            await verify();
            if (!originalMetadata || !temporary.level) return $t("panel.text_5a5b29b174", { "name": temporary.name });
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
          const equipmentMetadata = await readPanelDamageMetadata(temporary, theme);
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
          if (change.extraEidolon !== undefined) {
            if (!["1204", "1213", "1308"].includes(temporary.id)) return $t("panel.text_4d93fa2059", { "name": temporary.name });
            temporary = { ...temporary, exCons: change.extraEidolon };
            labels.push($t("panel.text_d2b4db8bd7", { "value1": change.extraEidolon ? $t("panel.text_8da97ddda9") : $t("panel.text_3fd47edce4") }));
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
          const equipmentRows = equipmentMetadata && calculateEquipmentAttributeRows(temporary, equipmentMetadata, promotion);
          await verify();
          if (!equipmentRows) return $t("panel.text_cf23424484", { "name": selected.name });
          equipmentLabel = labels.join(" · ");
          if (type !== "relics" && equipmentMetadata && hasPersonalDamage(selected.id)) {
            const display = await readPanelTrialDisplay(configRoot);
            const originalMetadata = display.showDifference ? await readPanelDamageMetadata(selected, theme) : undefined;
            await verify();
            const result = readStarRailPersonalDamage(temporary, equipmentMetadata,
              "scenario" in command ? command.scenario : undefined, equipmentRows, skillPreview,
              originalMetadata && { avatar: selected, metadata: originalMetadata });
            previewDamage = result.damage && display.showDifference ? { ...result, damage: {
              ...result.damage, trialTitleMode: display.longTitle,
            } } : result;
          }
          selected = { ...temporary, stats: formatPanelAttributeRows(equipmentRows) };
        }
      }

      const builtInPortraitOnly = selected ? await starRailUsesBuiltInPortrait(context) : false;
      if (type === "damage" && selected) {
        const metadata = previewDamage ? undefined : await readPanelDamageMetadata(selected, theme);
        const result = previewDamage ?? (metadata ? readStarRailPersonalDamage(selected, metadata, "scenario" in command ? command.scenario : undefined)
          : { reason: $t("panel.text_e603df242d"), scenarioCount: undefined });
        await verify();
        if (result.scenarioCount !== undefined) {
          return equipmentLabel
            ? $t("panel.text_6d527e8cf8", { "name": selected.name, "scenarioCount": result.scenarioCount })
            : $t("panel.text_4d0b4a563f", { "name": selected.name, "scenarioCount": result.scenarioCount, "value3": selected.name, "archiveSuffix": archiveSuffix });
        }
        if (!result.damage) return $t("panel.text_4509cf2edb", { "name": selected.name, "reason": result.reason });
        const damage = equipmentLabel ? { ...result.damage, buffs: [equipmentLabel, ...result.damage.buffs] } : result.damage;
        const card = await renderStarRailPersonalDamage(damage, theme.root, selected.id, context?.inlineImageByteLimit, theme.commaGroup, builtInPortraitOnly)
          .catch(() => undefined);
        await verify();
        if (card) return { type: "image" as const, file: card.png };
        return [equipmentLabel, ...panelDamageText(damage, theme.commaGroup)].filter(Boolean).join("\n");
      }
      let models;
      let relicScore: { readonly mark?: string; readonly markClass?: string; readonly incomplete?: number } | undefined;
      if (selected) {
        if (type === "relics") {
          const relics = await makePanelRelicCard(snapshot, selected, theme, signal, builtInPortraitOnly);
          await verify();
          if (!relics) return $t("panel.text_0f848475f4", { "name": selected.name, "value2": profileId === 1 ? "" : profileId });
          models = [relics];
          relicScore = relics.artisDetail;
        } else {
          const detail = await makePanelDetailCard(snapshot, selected, theme, signal,
            { equipmentLabel, skillPreview, previewDamage: previewDamage?.damage, localOnly: explicitUid, builtInPortraitOnly });
          models = [detail];
          relicScore = detail.artisDetail;
        }
      } else {
        models = await makePanelListCards(snapshot, theme, profileId, signal, updated, type === "reload" || publicLookup, qFace);
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
          if (type === "update") return $t("panel.text_456633c87c", { "uid": uid, "length": snapshot.avatars.length });
          if (selected) {
            if (type === "relics" && relicScore) return $t("panel.text_7d5d089c70", { "uid": uid, "name": selected.name, "mark": relicScore.mark, "markClass": relicScore.markClass });
            const visible = [selected.name, selected.level && `Lv.${selected.level}`, selected.rank !== undefined && $t("panel.text_c0985f1db5", { "rank": selected.rank }),
              selected.cone?.name, ...selected.relics.map(relic => relic.name)].filter(Boolean).join(" · ");
            const damage = previewDamage?.damage;
            return [`UID ${uid}`, equipmentLabel, visible, ...(damage ? panelDamageText(damage, theme.commaGroup) : [])].filter(Boolean).join("\n");
          }
          const label = snapshot.source === "miyoushe" || snapshot.source === "legacy"
            ? $t("panel.text_6ce5363a7d") : $t("panel.text_3b2f86a1cd", { "value1": showcaseProviderNames[snapshot.source] });
          return $t("panel.text_2dcd381edd", { "uid": uid, "label": label, "length": snapshot.avatars.length, "value4": snapshot.avatars.map(avatar => avatar.name).join("、") });
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
      if (images.length) return { type: "forward" as const, nodes: [$t("panel.text_8ed1a33fe9", { "uid": uid, "length": snapshot.avatars.length }), ...images] };
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ProfileError) {
        if (error.code === "changed") return $t("panel.text_7a535890ba");
        if (error.code === "missing" || error.code === "login-required") return $t("panel.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("panel.text_9d881700c6", { "profileId": profileId });
      }
      if (error instanceof ShowcaseError) return error.message;
      if (error instanceof GameRecordRequestError) return error.message;
      if (error instanceof HoyoRequestError) {
        if (error.code === "profile-changed") return $t("panel.text_7a535890ba");
        if (error.code === "refresh") return $t("panel.text_9275e26edc");
        if (error.code === "invalid-input") return $t("panel.text_acbd9db535");
        if (error.retcode === 10102) return $t("panel.text_5acf8a0b19");
      }
      if (type === "export") return $t("panel.text_b0e37846b0");
      if (type === "reload") return $t("panel.text_81c284a720");
      if (type === "refresh-traces") return $t("panel.text_ac0d28c4a2");
      return $t("panel.text_cf37ad09d6");
    }
  }
  return Object.assign(query, { rebuild, original: originals.reply });
}
