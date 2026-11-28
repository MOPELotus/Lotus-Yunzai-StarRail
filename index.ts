import { splitGachaPoolPages } from "../../lib/gacha-pool-pages.ts";
import { fileURLToPath as panelCacheFilePath } from "node:url";
import { createGroupPanelCacheRefresh, type PanelCacheRuntime } from "../../lib/group-panel-cache.ts";
import { createStarRailOfficialGroupPanels, createStarRailCachedGroupPanels } from "./group-rank-official.ts";
import { panelQueryUser } from "../../lib/panel-query-target.ts";
import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { readGachaDisplaySettings } from "../../lib/gacha-display-settings.ts";
import { matchPanelTransferCommand, type PanelTransferAccess } from "../../lib/panel-transfer-command.ts";
import type { LegacyPanelRecoveryOffer } from "../../lib/legacy-panel-recovery-flow.ts";
import { createStarRailPanelTransfer } from "./panel-transfer.ts";
import { matchArkRankCommand } from "../../lib/ark-custom-rank-command.ts";
import { createStarRailCustomRank } from "./custom-rank.ts";
import { matchPublicDamageRank } from "../../lib/rank-statistics.ts";
import { gachaImageReply } from "../../lib/gacha-image-reply.ts";
import type { MessageEvent } from "../../lib/messages.ts";
import { isStarRailGachaLinkMessage, starRailLinkEntry } from "../../lib/private-access.ts";
import { createGameCharacterAliasCommands, matchGameCharacterAliasCommand } from "../../lib/game-character-aliases.ts";
import { fileURLToPath } from "node:url";
import { gameCommandProfileId, createProfileStore, MAX_PROFILE_ID, ProfileError } from "@lotus-yunzai/account";
import { createGachaUpdater } from "@lotus-yunzai/gacha/update";
import { gachaPortraitCharacter, readGachaPlayerArt } from "@lotus-yunzai/gacha/player-art";
import { createStarRailPanelArchive, panelDiscardedAt } from "./panel-discard.ts";
import { readLegacyPlayerPortrait } from "../../lib/own-role-legacy-artwork.ts";
import { object } from "./panel-model.ts";
import { createProfileHoyoClient, GameRecordRequestError, HoyoRequestError } from "@lotus-yunzai/hoyo-client";
import { buildStarRailGachaDetail, type StarRailGachaDetailPool } from "./gacha-detail.ts";
import { renderStarRailGachaDetail } from "./gacha-detail-card.ts";
import { readStarRailGachaCatalog, readStarRailGachaItems, readStarRailRecordItems, starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { createStarRailGachaFiles, matchesStarRailGachaFiles, normalizeStarRailGachaCommand, starRailLegacyArchiveTimezone, type StarRailGachaFileContext } from "./gacha-files.ts";
import { queryStarRailPoolInfo } from "./gacha-pool-info.ts";
import { createStarRailGachaRecordArchive, StarRailGachaArchiveError } from "./gacha-record-archive.ts";
import { buildStarRailRecordDetail } from "./gacha-record-detail.ts";
import { resolveStarRailRecordPool, starRailRecordDraws } from "./gacha-record-source.ts";
import { buildStarRailRecordSpecial, renderStarRailRecordSpecial } from "./gacha-record-special.ts";
import { buildStarRailRecordVersion } from "./gacha-record-version.ts";
import { renderStarRailGachaFailure, renderStarRailGachaResult, starRailGachaFailureText } from "./gacha-result-card.ts";
import { readStarRailGachaSchedule, resolveStarRailDetailPool } from "./gacha-schedule.ts";
import { buildStarRailGachaSpecial, type StarRailGachaSpecialOptions } from "./gacha-special.ts";
import { renderStarRailGachaSpecial } from "./gacha-special-card.ts";
import { createStarRailGachaHistoryStore } from "./gacha-store.ts";
import { createStarRailGachaLinkCommand } from "./gacha-link-command.ts";
import { createStarRailGachaSync, StarRailGachaUpdateBusy } from "./gacha-sync.ts";
import { buildStarRailGachaVersion, type StarRailGachaVersionOptions } from "./gacha-version.ts";
import { renderStarRailGachaVersion } from "./gacha-version-card.ts";

import { parseChallengeQuery } from "./challenge-model.ts";
import { queryStarRailChallenge } from "./challenge.ts";
import { createStarRailGridFightQuery } from "./grid-fight-command.ts";
import { parseStarRailGridFight } from "./grid-fight-model.ts";
import { createStarRailMonthlyQuery } from "./monthly-command.ts";
import { matchStarRailMonthly } from "./monthly-period.ts";
import { createStarRailMonthlyArchive } from "./monthly-archive.ts";
import { createStarRailLedgerQuery, matchStarRailLedger } from "./ledger-command.ts";
import { createStarRailOnlineQuery, starRailOnlineCommand } from "./online-command.ts";
import { createStarRailPanel, createStarRailPersonalPanelReader } from "./panel.ts";
import { starRailOriginalCommand } from "./panel-original.ts";
import { matchStarRailShowcaseSettings, runStarRailShowcaseSettings } from "./panel-showcase-command.ts";
import { createStarRailTeamDamageQuery } from "./team-damage-command.ts";
import { parseStarRailTeamDamage } from "./team-damage-model.ts";
import { parsePanelCommand } from "./panel-model.ts";
import { createStarRailRosterQuery } from "./personal-roster-command.ts";
import { createStarRailPersonalRecordQuery, matchStarRailPersonalRecord } from "./personal-record.ts";
import { parseStarRailPersonalRoster } from "./personal-roster-model.ts";
import { createStarRailGroupRelicRank, parseStarRailRelicRank, resolveStarRailRelicRank, type StarRailGroupRankContext } from "./group-relic-rank.ts";
import { queryStarRailRankStats, resolveStarRailCharacter } from "./rank-statistics.ts";
import { createStarRailSimulation, matchesWarpCommand } from "./simulation/commands.ts";
import { createStarRailRogueQuery } from "./rogue-command.ts";
import { parseStarRailRogue } from "./rogue-model.ts";

import { createStarRailGrowthQuery, matchStarRailGrowth } from "./growth/command.ts";

const updateCommand = /^#星铁更新(?:抽卡|跃迁)(?:记录)?([1-9]\d{0,2})?$/u;
const helpCommand = /^#星铁(?:抽卡|记录)帮助$/u;
const recordPrefix = "#星铁逐抽";
const recordDefault = /^(?:记录|祈愿|分析|统计)(?:[1-9]\d{0,2})?$/u;
const poolCommand = /^#星铁(全部)?(抽卡|抽奖|角色|光锥|武器|常驻|up)池?(全部)?(记录|祈愿|分析|统计)([1-9]\d{0,2})?$/u;
const versionCommand = /^#星铁(版本|全部)(全部)?统计([1-9]\d{0,2})?$/u;
const legacyRecordCommand = /^#星铁(角色联动|光锥联动|武器联动|角色|光锥|武器|常驻|新手|联动)?(?:跃迁|抽卡)?(记录|分析|统计)([1-9]\d{0,2})?$/u;
const specialCommand = /^#星铁(?:(全部)?(角色联动|光锥联动|武器联动|联动角色|联动光锥|联动武器|联动|新手)池?(全部)?(记录|祈愿|分析|统计)|全部(?:记录|祈愿|分析))([1-9]\d{0,2})?$/u;
const detailPools = new Map<string, StarRailGachaDetailPool>([
  ["光锥", "GachaType_EquipmentUp"], ["武器", "GachaType_EquipmentUp"], ["常驻", "GachaType_Standard"],
]);
type VersionPool = NonNullable<StarRailGachaVersionOptions["type"]>;
const versionPools = new Map<string, VersionPool>([
  ["角色", "char"], ["光锥", "weapon"], ["武器", "weapon"], ["常驻", "normal"], ["全部", "all"],
]);
type SpecialPool = StarRailGachaSpecialOptions["pool"];
const specialPools = new Map<string, SpecialPool>([
  ["角色联动", "GachaType_CollabAvatarUp"], ["联动角色", "GachaType_CollabAvatarUp"], ["光锥联动", "GachaType_CollabEquipmentUp"], ["联动光锥", "GachaType_CollabEquipmentUp"], ["联动武器", "GachaType_CollabEquipmentUp"],
  ["武器联动", "GachaType_CollabEquipmentUp"], ["新手", "GachaType_Newbie"],
]);
const historyRoot = fileURLToPath(new URL("../../data/starRailGachaJson/", import.meta.url));
const legacyHistoryRoots = ["Lotus-Plugin", "Lotus-ReFactor"].flatMap(directory => [
  `../${directory}/data/starRailGachaJson/`,
  `../../data/legacy-game-history/${directory}/starRailGachaJson/`,
].map(path => fileURLToPath(new URL(path, import.meta.url))));
const recordsRoot = fileURLToPath(new URL("../../data/starRailGachaRows/", import.meta.url));
const legacyRecordsRoot = fileURLToPath(new URL("../../data/srJson/", import.meta.url));
const help = [
  $t("index.text_a5195432b4"),
  $t("index.text_60f47bfb7a"),
  $t("index.text_4faa61b59e"),
  $t("index.text_0091326249"),
  $t("index.text_6b9d5478c4"),
  $t("index.text_ae09639572"),
  $t("index.text_7bb7cdc628"),
  $t("index.text_c6f8bed3e1"),
  $t("index.text_1629f8ef03"),
].join("\n");

type GachaView = { readonly detail: StarRailGachaDetailPool } | { readonly version: VersionPool }
  | { readonly special: SpecialPool; readonly statistics: boolean; readonly onlyCollab?: boolean };

function matchGachaQuery(message: string): { profileId: number; view: GachaView; all: boolean } | undefined {
  const special = specialCommand.exec(message);
  if (special) {
    return {
      profileId: gameCommandProfileId("sr", special[5]),
      view: { special: specialPools.get(special[2] ?? "") ?? "all", statistics: special[4] === "统计", ...(special[2] === "联动" ? { onlyCollab: true } : {}) },
      all: !special[2] || special[2] === "联动" || !!(special[1] || special[3]),
    };
  }
  const version = versionCommand.exec(message);
  if (version && !(version[1] === "全部" && version[2])) {
    return { profileId: gameCommandProfileId("sr", version[3]), view: { version: versionPools.get(version[1]!) ?? "up" }, all: !!version[2] };
  }
  const pool = poolCommand.exec(message);
  if (!pool) return;
  const name = pool[2]!;
  if ((name === "抽卡" || name === "抽奖") && pool[4] !== "统计") return { profileId: gameCommandProfileId("sr", pool[5]), view: { special: "all", statistics: false }, all: true };
  const view = pool[4] === "统计" ? { version: versionPools.get(name) ?? "up" }
    : { detail: detailPools.get(name) ?? "GachaType_AvatarUp" };
  return { profileId: gameCommandProfileId("sr", pool[5]), view, all: !!(pool[1] || pool[3]) };
}

function legacyGachaQuery(message: string): ReturnType<typeof matchGachaQuery> {
  const match = legacyRecordCommand.exec(message);
  if (!match) return;
  // Old 统计 fell through to the local overview even when a pool name preceded it.
  const name = match[2] === "统计" ? "" : match[1] ?? "";
  const special = name === "联动" ? "GachaType_CollabAvatarUp" : specialPools.get(name);
  const view: GachaView = special || !name
    ? name === "联动" ? { special: "all", statistics: false, onlyCollab: true } : { special: special ?? "all", statistics: false }
    : { detail: detailPools.get(name) ?? "GachaType_AvatarUp" };
  return { profileId: gameCommandProfileId("sr", match[3]), view, all: !name || name === "联动" };
}

function matchGachaCommand(input: string) {
  const message = normalizeStarRailGachaCommand(input);
  const matched = updateCommand.exec(message);
  const recordArchive = message.startsWith(recordPrefix);
  const suffix = recordArchive ? message.slice(recordPrefix.length) : "";
  const queryMessage = recordArchive ? `#星铁${recordDefault.test(suffix) ? $t("index.text_02d44306fd") : ""}${suffix}` : message;
  const query = matched ? undefined : matchGachaQuery(queryMessage);
  const legacy = matched || query ? undefined : legacyGachaQuery(message);
  const view = query ?? legacy;
  if (!matched && !view) return;
  const profileId = view?.profileId ?? gameCommandProfileId("sr", matched?.[1]);
  if (profileId <= MAX_PROFILE_ID) return { profileId, query: view, recordArchive: recordArchive || !!legacy };
}

export function createModule({ signal, lockFile, runtimeVersion, roleQFace = true, panelCacheRuntime }: {
  signal: AbortSignal;
  lockFile: Parameters<typeof createStarRailGachaHistoryStore>[1];
  runtimeVersion?: { readonly version?: string; readonly revision?: string };
  roleQFace?: boolean;
  panelCacheRuntime?: PanelCacheRuntime;
}) {
  const profiles = createProfileStore(Bun.env.LOTUS_PROFILE_DIR || undefined);
  const characterAliases = createGameCharacterAliasCommands(lockFile, signal);
  const publicRank = createStarRailCustomRank(signal);
  const client = createProfileHoyoClient(profiles);
  const groupRank = createStarRailGroupRelicRank(profiles, lockFile, signal, { official: createStarRailCachedGroupPanels(profiles, client, lockFile) });
  const groupRankMatches = new WeakMap<StarRailGachaFileContext, Awaited<ReturnType<typeof resolveStarRailRelicRank>>>();
  const panel = createStarRailPanel(profiles, client, lockFile, signal, groupRank, undefined, undefined, undefined, { qFace: roleQFace });
  const panelArchive = createStarRailPanelArchive(lockFile);
  const transferPanel = createStarRailPanelTransfer(profiles, lockFile, signal);
  const roster = createStarRailRosterQuery(profiles, client, signal, { qFace: roleQFace });
  const personalRecord = createStarRailPersonalRecordQuery(profiles, client, signal);
  const gridFight = createStarRailGridFightQuery(profiles, client, signal);
  const growth = createStarRailGrowthQuery(profiles, client, signal);
  const rogue = createStarRailRogueQuery(profiles, client, signal);
  const teamDamage = createStarRailTeamDamageQuery(profiles, createStarRailPersonalPanelReader(lockFile), signal);
  const monthlyArchive = createStarRailMonthlyArchive(
    fileURLToPath(new URL("../../data/starrail/monthly/", import.meta.url)),
    ["../../backup/legacy-data/SR_NoteData/", "../../data/SR_NoteData/"].map(path => fileURLToPath(new URL(path, import.meta.url))),
    lockFile);
  const monthly = createStarRailMonthlyQuery(profiles, client, signal, monthlyArchive);
  const ledger = createStarRailLedgerQuery(profiles, client, signal);
  const online = createStarRailOnlineQuery(profiles, client, signal);
  const simulate = createStarRailSimulation({ lockFile, signal, async readIndependentLegacy(key) {
    signal.throwIfAborted();
    const reply = await globalThis.redis?.multi().get(key).addCommand(["PEXPIRETIME", key]).exec();
    signal.throwIfAborted();
    if (!reply || reply[0] === null || reply[1] === -2) return;
    const [raw, expiresAt] = reply;
    if (typeof raw !== "string" || typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
      throw new TypeError($t("index.text_7ed61dbdcb"));
    }
    return { raw, expiresAt };
  } });
  const history = createStarRailGachaHistoryStore(historyRoot, lockFile, legacyHistoryRoots);
  const archive = createStarRailGachaRecordArchive({ directory: recordsRoot, legacyDirectory: legacyRecordsRoot }, lockFile);
  const hasDisplayHistory = async (qq: string, uid: string) =>
    (await history.read(qq, uid) ?? await history.readLegacy(qq, uid)) !== null;
  const gachaFiles = createStarRailGachaFiles(profiles, archive, signal, runtimeVersion?.version ?? runtimeVersion?.revision ?? "dev",
    hasDisplayHistory);
  const gachaLink = createStarRailGachaLinkCommand(profiles, archive, signal);
  const service = createStarRailGachaSync(profiles, client, history);
  const updateGacha = createGachaUpdater((qq, profileId, workflow?: AbortSignal) =>
    service.sync(qq, profileId, { signal: workflow ? AbortSignal.any([signal, workflow]) : signal }));

  async function query(qq: string, { profileId, view, all }: NonNullable<ReturnType<typeof matchGachaQuery>>, recordArchive: boolean, context: Pick<MessageEvent, "inlineImageByteLimit" | "forward">) {
    if (!recordArchive && "special" in view && view.statistics) return $t("index.text_9a649c9544");
    try {
      const role = await profiles.savedRole(qq, profileId, "sr");
      const { uid, nickname } = role;
      let snapshot = recordArchive ? null : await history.read(qq, uid);
      const raw = snapshot === null ? await archive.read({ qq, uid }, { legacyTimezone: starRailLegacyArchiveTimezone(role) }) : undefined;
      if (raw?.status === "unavailable") {
        if (recordArchive) {
          const summary = raw.reason === "mirror" ? $t("index.text_fc8b7031ff") : await hasDisplayHistory(qq, uid) ? $t("index.text_e96a0b780b") : "";
          return summary
            ? $t("index.text_9772199f71", { "uid": uid, "summary": summary, "value3": profileId === 1 ? "" : profileId })
            : $t("index.text_d8c3917605", { "uid": uid, "value2": profileId === 1 ? "" : profileId });
        }
        snapshot = await history.readLegacy(qq, uid);
        if (snapshot === null) {
          return $t("index.text_2ceb44ae2c", { "profileId": profileId, "value2": profileId === 1 ? "" : profileId });
        }
      }
      const themeDirectory = starRailGachaThemeDirectory();
      const rawArchive = raw?.status === "available" ? raw.archive : undefined;
      const [catalog, panelData] = await Promise.all([
        readStarRailGachaCatalog(themeDirectory),
        panelArchive.read(qq, uid).catch(() => undefined),
      ]);
      const saved = object(panelData);
      const chosen = String(saved?.uid) === uid ? saved?.rosterFace ?? saved?.face : undefined;
      const character = gachaPortraitCharacter(catalog.characters.values(), chosen) ??
        (panelData !== undefined && !panelDiscardedAt(panelData)
          ? gachaPortraitCharacter(catalog.characters.values(), (await readLegacyPlayerPortrait("sr", uid, signal).catch(() => undefined))?.face)
          : undefined);
      const [{ face, avatar }, resolveItem, schedule, draws] = await Promise.all([
        readGachaPlayerArt(themeDirectory, "sr", nickname || $t("index.text_865ee04ffd"), character, role.avatar, signal, roleQFace),
        rawArchive ? undefined : readStarRailGachaItems(themeDirectory, catalog),
        rawArchive || !("special" in view) ? readStarRailGachaSchedule(themeDirectory) : [],
        rawArchive && readStarRailRecordItems(themeDirectory, catalog).then((resolver) => starRailRecordDraws(rawArchive, resolver)),
      ]);
      const shared = { uid, face, now: new Date() };
      const options = { ...shared, history: snapshot, resolveItem, face: nickname ? face : { ...face, name: $t("index.text_4bf6868aa0") } };
      const resolvePool = resolveStarRailDetailPool(schedule);
      const resolveRecordPool = draws && resolveStarRailRecordPool(schedule);
      const display = !("special" in view) ? await readGachaDisplaySettings(new URL("../../", import.meta.url)) : undefined;
      function buildPage(page?: number) {
        if (draws) {
          const records = { ...shared, draws, resolvePool: resolveRecordPool, page };
          if ("detail" in view) {
            const model = buildStarRailRecordDetail({ ...records, pool: view.detail, display });
            return model && { kind: "detail" as const, model: { ...model, recordArchive: true as const } };
          }
          if ("special" in view) {
            const model = buildStarRailRecordSpecial({ ...records, pool: view.special, maxRows: Number.MAX_SAFE_INTEGER });
            return model && { kind: "record-special" as const, model };
          }
          const model = buildStarRailRecordVersion({ ...records, type: view.version, maxRows: display?.versionRows, schedule });
          return model && { kind: "version" as const, model };
        }
        if ("detail" in view) {
          const model = buildStarRailGachaDetail({ ...options, pool: view.detail, display, resolvePool, page });
          return model && { kind: "detail" as const, model };
        }
        if ("special" in view) {
          const model = buildStarRailGachaSpecial({ ...options, pool: view.special, maxRows: Number.MAX_SAFE_INTEGER });
          return model && { kind: "special" as const, model };
        }
        const model = buildStarRailGachaVersion({ ...options, type: view.version, maxRows: display?.versionRows, schedule, page });
        return model && { kind: "version" as const, model };
      }
      const initial = buildPage(all ? 1 : undefined);
      if (!initial) return $t("index.text_ff6d96492f", { "uid": uid });
      type Page = NonNullable<ReturnType<typeof buildPage>>;
      const planned: Page[] = [];
      for (let page = 1; page <= (all ? ("pageInfo" in initial.model ? initial.model.pageInfo?.total ?? 1 : 1) : 1); page++) {
        let result = page === 1 ? initial : buildPage(page);
        if (!result) continue;
        if ("special" in view && view.onlyCollab && (result.kind === "special" || result.kind === "record-special")) {
          const pools = result.model.pools.filter(pool => pool.type === 21 || pool.type === 22);
          result = { ...result, model: { ...result.model, pools } } as typeof result;
        }
        if (result.kind === "special") {
          for (const model of splitGachaPoolPages(result.model, "pools", "fiveLog")) planned.push({ ...result, model });
        } else if (result.kind === "record-special") {
          for (const model of splitGachaPoolPages(result.model, "pools", "fiveLog")) planned.push({ ...result, model });
        } else planned.push(result);
      }
      if (!planned.length) return $t("index.text_ff6d96492f", { uid });
      const first = planned[0]!;
      try {
        const total = planned.length;
        const title = first.kind === "version" ? $t("index.text_acbebaddd8", { "poolName": first.model.poolName, "count": first.model.pageInfo?.count })
          : first.kind === "detail" ? $t("index.text_2eefd98a1a", { "poolName": first.model.poolName, "fiveNum": first.model.gacha.stat.fiveNum })
          : $t("index.text_30a67bb7fc", { "value1": first.model.poolName === "全部" ? $t("index.text_5017bac5a2") : $t("index.text_d17cfde3c6", { "poolName": first.model.poolName }), "fiveNum": first.model.fiveNum });
        return await gachaImageReply({
          total, title: $t("index.text_f87fdb63c4", { "uid": uid, "title": title, "total": total }), signal,
          forward: context.forward,
          async verifyRole() { return (await profiles.savedRole(qq, profileId, "sr").catch(() => undefined))?.uid === uid; },
          changedRoleMessage: $t("index.text_0026c8033d"),
          render(page, scale) {
            const result = planned[page - 1];
            if (!result) throw new Error($t("index.text_7750ce8a1f"));
            const options = { themeDirectory, scale, avatar, qFace: roleQFace };
            return result.kind === "record-special" ? renderStarRailRecordSpecial(result.model, options)
              : result.kind === "special" ? renderStarRailGachaSpecial(result.model, options)
              : result.kind === "detail" ? renderStarRailGachaDetail(result.model, options)
              : renderStarRailGachaVersion(result.model, options);
          },
        });
      } catch {
        if (!signal.aborted) return $t("index.text_98defd792a");
      }
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ProfileError) {
        if (error.code === "missing") return $t("index.text_76720712c8", { "profileId": profileId });
        if (error.code === "role-missing") return $t("index.text_9d881700c6", { "profileId": profileId });
      }
      if (error instanceof StarRailGachaArchiveError) return error.message;
      return $t("index.text_127ecc1fee");
    }
  }

  const cacheSignal = panelCacheRuntime ? AbortSignal.any([signal, panelCacheRuntime.disconnect]) : signal;
  const refreshPanelCache = createGroupPanelCacheRefresh(profiles, createStarRailOfficialGroupPanels(profiles, client, lockFile),
    lockFile, cacheSignal, panelCacheFilePath(new URL("../../data/starrail-panel-refresh/", import.meta.url)),
    async () => undefined);
  const stopPanelCache = panelCacheRuntime?.register("sr", refreshPanelCache);

  return {
    commands: {},
    async dispose() { await stopPanelCache?.(); },
    panelRebuild: panel.rebuild,
    async gachaUpdate(qq: string, profileId: number, notify?: () => unknown, _isDelegated?: boolean, workflow?: AbortSignal) {
      try {
        const result = await updateGacha(qq, profileId, notify, workflow);
        return result && { uid: result.log.uid };
      } catch (error) {
        if (error instanceof StarRailGachaUpdateBusy) return undefined;
        throw error;
      }
    },
    async fallbackFeatures(context: StarRailGachaFileContext) {
      const message = context.normalizedMessage;
      if (matchPanelTransferCommand(message)?.game === "sr") return [$t("index.text_75c12439eb")];
      const customRankCommand = matchArkRankCommand(message);
      if (customRankCommand && (!customRankCommand.game || customRankCommand.game === "sr")) return [$t("index.text_75c12439eb")];
      if (matchStarRailShowcaseSettings(message)) return [$t("index.text_75c12439eb")];
      if (starRailLinkEntry.test(message) || isStarRailGachaLinkMessage(message)) return [$t("index.text_5f636b7036")];
      if (matchesWarpCommand(message)) return [$t("index.text_7fe95f7b2a")];
      if (matchGameCharacterAliasCommand(message)?.game === "sr") return [$t("index.text_80d2e191e6")];
      if (matchStarRailMonthly(message)) return [$t("index.text_7ed92097f3")];
      if (matchStarRailLedger(message)) return [$t("index.text_c0370c0de7")];
      if (matchStarRailPersonalRecord(message)) return [];
      if (starRailOnlineCommand.test(message)) return [$t("index.text_2c17f3e357")];
      if (parseStarRailTeamDamage(message)) return [$t("index.text_f3dedd9220")];
      if (parseStarRailGridFight(message)) return [$t("index.text_4357158e81")];
      if (matchStarRailGrowth(message)) return [$t("index.text_7701d9f818")];
      if (parseStarRailRogue(message)) return [$t("index.text_f3ec7dfdd7")];
      if (matchPublicDamageRank(message, "sr")) return [$t("index.text_75c12439eb")];
      const panelCommand = parsePanelCommand(message);
      if (panelCommand?.type === "discard" || panelCommand?.type === "extreme") return [$t("index.text_75c12439eb")];
      const rank = await resolveStarRailRelicRank(message);
      if (rank) {
        groupRankMatches.set(context, rank);
        return [$t("index.text_75c12439eb")];
      }
      if (parseChallengeQuery(message) || parseStarRailPersonalRoster(message) || (panelCommand && panelCommand.type !== "detail")) return [];
      if (!panelCommand && (matchesStarRailGachaFiles(context) || helpCommand.test(message) || matchGachaCommand(message))) return [$t("index.text_5f636b7036")];
      return [];
    },
    async fallback(_message: string, context: StarRailGachaFileContext & StarRailGroupRankContext &
      Partial<Pick<MessageEvent, "forward" | "privateCredentialSignal" | "reply_id" | "lookupReply" | "message">> & {
      readonly at?: string | number;
      readonly isNapCat?: (signal: AbortSignal) => Promise<boolean>;
      readonly adapter?: "milky";
      readonly inlineImageByteLimit?: number;
      readonly isBotMaster?: (userId: number) => boolean;
      readonly groupOriginalSignal?: AbortSignal;
      readonly canManagePackages?: true;
      readonly isDelegated?: boolean;
      readonly panelTransfer?: PanelTransferAccess;
      readonly offerLegacyPanelRecovery?: LegacyPanelRecoveryOffer;
      readonly reply?: (message: string | { readonly type: "image"; readonly file: Uint8Array }, quote?: boolean,
        options?: Parameters<MessageEvent["reply"]>[2]) => unknown;
    }) {
      const transfer = matchPanelTransferCommand(context.normalizedMessage);
      if (transfer?.game === "sr") return transferPanel(transfer, context);
      const customRankCommand = matchArkRankCommand(context.normalizedMessage);
      if (customRankCommand) return publicRank(customRankCommand, context);
      const sources = matchStarRailShowcaseSettings(context.normalizedMessage);
      if (sources) return runStarRailShowcaseSettings(sources, context, signal);
      const original = starRailOriginalCommand(context.normalizedMessage);
      if (original) return await panel.original(context) ?? (original === "explicit" ? $t("index.text_22f0fa691a") : undefined);
      const linked = await gachaLink(context);
      if (linked !== undefined) return linked;
      if (matchesWarpCommand(context.normalizedMessage)) return simulate(context.normalizedMessage, context);
      const aliases = matchGameCharacterAliasCommand(context.normalizedMessage);
      if (aliases?.game === "sr") return characterAliases(aliases, context);
      const month = matchStarRailMonthly(context.normalizedMessage);
      if (month) return monthly(month, context);
      const historyPage = matchStarRailLedger(context.normalizedMessage);
      if (historyPage) return ledger(context, historyPage);
      const onlineMatch = starRailOnlineCommand.exec(context.normalizedMessage);
      if (onlineMatch) return online(context, gameCommandProfileId("sr", onlineMatch[1]));
      const team = parseStarRailTeamDamage(context.normalizedMessage);
      if (team) return teamDamage(context, team);
      const gridFightCommand = parseStarRailGridFight(context.normalizedMessage);
      if (gridFightCommand) return gridFight(context, gridFightCommand);
      const growthCommand = matchStarRailGrowth(context.normalizedMessage);
      if (growthCommand) return growth(context, growthCommand);
      const rogueCommand = parseStarRailRogue(context.normalizedMessage);
      if (rogueCommand) return rogue(context, rogueCommand);
      const challenge = parseChallengeQuery(context.normalizedMessage);
      if (challenge) {
        const userId = context.user_id;
        if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId < 1) {
          return $t("index.text_30e59aeb81");
        }
        return queryStarRailChallenge(String(userId), challenge, profiles, client, signal, context.isNapCat,
          context.adapter === "milky" ? context.inlineImageByteLimit : undefined, !!context.forward);
      }
      const personalRecordCommand = matchStarRailPersonalRecord(context.normalizedMessage);
      if (personalRecordCommand) return personalRecord(context, personalRecordCommand);
      const rosterCommand = parseStarRailPersonalRoster(context.normalizedMessage);
      if (rosterCommand) return roster(context, rosterCommand);
      const resolvedRank = groupRankMatches.get(context) ?? parseStarRailRelicRank(context.normalizedMessage);
      const relicRank = await groupRank.query(resolvedRank, context);
      if (relicRank !== undefined) return relicRank;
      const panelCommand = parsePanelCommand(context.normalizedMessage);
      if (panelCommand && (panelCommand.type !== "showcase" || !panelCommand.name || await resolveStarRailCharacter(panelCommand.name))) {
        const userId = ["list", "detail", "damage", "relics", "relic-list", "practice"].includes(panelCommand.type)
          ? panelQueryUser(context) : context.user_id;
        if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId < 1) {
          return $t("index.text_ebb89ab276");
        }
        return panel(String(userId), panelCommand, context);
      }
      const command = matchGachaCommand(context.normalizedMessage);
      if (!command) {
        const poolInfo = await queryStarRailPoolInfo(context.normalizedMessage, signal);
        if (poolInfo !== undefined) return poolInfo;
      }
      const rankStats = await queryStarRailRankStats(context.normalizedMessage, signal);
      if (rankStats !== undefined) return rankStats;
      const fileReply = await gachaFiles(context);
      if (fileReply !== undefined) return fileReply;
      if (helpCommand.test(context.normalizedMessage)) return help;
      if (!command) return;
      const { profileId, query: view, recordArchive } = command;
      const { user_id } = context;
      if (typeof user_id !== "number" || !Number.isSafeInteger(user_id) || user_id < 1) {
        return $t("index.text_044e9e1792");
      }
      const qq = String(user_id);
      if (view) return query(qq, view, recordArchive, context);
      try {
        const result = await updateGacha(qq, profileId, () =>
          context.reply($t("index.text_984739da33", { "profileId": profileId })));
        if (!result) return $t("index.text_2862a02274");
        try {
          const { png } = await renderStarRailGachaResult(result);
          return { type: "image" as const, file: png };
        } catch {
          return $t("index.text_268e82a103", { "added": result.added });
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof StarRailGachaUpdateBusy) return error.message;
        if (error instanceof ProfileError) {
          if (error.code === "missing" || error.code === "login-required") {
            return $t("index.text_76720712c8", { "profileId": profileId });
          }
          if (error.code === "role-missing") return $t("index.text_9d881700c6", { "profileId": profileId });
        }
        const limited = error instanceof GameRecordRequestError && error.reason === "rate-limited";
        const reason = limited ? "rate-limited"
          : (error instanceof ProfileError && error.code === "changed") ||
            (error instanceof HoyoRequestError && error.code === "profile-changed") ? "profile-changed"
          : error instanceof HoyoRequestError && error.code === "transport" ? "network-failed"
          : error instanceof HoyoRequestError && error.status !== undefined && error.status >= 500 && error.status <= 599
            ? "service-unavailable" : "request-failed";
        try {
          const { png } = await renderStarRailGachaFailure({ qq, profileId, reason });
          return { type: "image" as const, file: png };
        } catch {
          return starRailGachaFailureText(reason);
        }
      }
    },
  };
}
