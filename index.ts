import { fileURLToPath } from "node:url";
import { createProfileStore, MAX_PROFILE_ID, ProfileError } from "@lotus-yunzai/account";
import { createGachaUpdater } from "@lotus-yunzai/gacha/update";
import { createProfileHoyoClient, HoyoRequestError } from "@lotus-yunzai/hoyo-client";
import { buildStarRailGachaDetail, type StarRailGachaDetailPool } from "./gacha-detail.ts";
import { renderStarRailGachaDetail } from "./gacha-detail-card.ts";
import { readStarRailGachaItems, readStarRailRecordItems, starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { createStarRailGachaFiles, matchesStarRailGachaFiles, starRailLegacyArchiveTimezone, type StarRailGachaFileContext } from "./gacha-files.ts";
import { queryStarRailPoolInfo } from "./gacha-pool-info.ts";
import { createStarRailGachaRecordArchive, StarRailGachaArchiveError } from "./gacha-record-archive.ts";
import { buildStarRailRecordDetail } from "./gacha-record-detail.ts";
import { resolveStarRailRecordPool, starRailRecordDraws } from "./gacha-record-source.ts";
import { buildStarRailRecordSpecial, renderStarRailRecordSpecial } from "./gacha-record-special.ts";
import { buildStarRailRecordVersion } from "./gacha-record-version.ts";
import { renderStarRailGachaFailure, renderStarRailGachaResult } from "./gacha-result-card.ts";
import { readStarRailGachaSchedule, resolveStarRailDetailPool } from "./gacha-schedule.ts";
import { buildStarRailGachaSpecial, type StarRailGachaSpecialOptions } from "./gacha-special.ts";
import { renderStarRailGachaSpecial } from "./gacha-special-card.ts";
import { createStarRailGachaHistoryStore } from "./gacha-store.ts";
import { createStarRailGachaSync } from "./gacha-sync.ts";
import { buildStarRailGachaVersion, type StarRailGachaVersionOptions } from "./gacha-version.ts";
import { renderStarRailGachaVersion } from "./gacha-version-card.ts";

import { parseChallengeQuery } from "./challenge-model.ts";
import { queryStarRailChallenge } from "./challenge.ts";
import { createStarRailMonthlyQuery, starRailMonthlyCommand } from "./monthly-command.ts";
import { createStarRailLedgerQuery, matchStarRailLedger } from "./ledger-command.ts";
import { createStarRailOnlineQuery, starRailOnlineCommand } from "./online-command.ts";
import { createStarRailPanel, createStarRailPersonalPanelReader } from "./panel.ts";
import { createStarRailTeamDamageQuery } from "./team-damage-command.ts";
import { parseStarRailTeamDamage } from "./team-damage-model.ts";
import { parsePanelCommand } from "./panel-model.ts";
import { createStarRailGroupRelicRank, type StarRailGroupRankContext } from "./group-relic-rank.ts";
import { queryStarRailRankStats } from "./rank-statistics.ts";
import { createStarRailSimulation } from "./simulation/commands.ts";

const updateCommand = /^#星铁更新抽卡记录([1-9]\d{0,2})?$/u;
const helpCommand = /^#星铁(?:抽卡|记录)帮助$/u;
const recordPrefix = "#星铁逐抽";
const recordDefault = /^(?:记录|祈愿|分析|统计)(?:[1-9]\d{0,2})?$/u;
const poolCommand = /^#星铁(全部)?(抽卡|抽奖|角色|光锥|武器|常驻|up)池?(全部)?(记录|祈愿|分析|统计)([1-9]\d{0,2})?$/u;
const versionCommand = /^#星铁(版本|全部)(全部)?统计([1-9]\d{0,2})?$/u;
const specialCommand = /^#星铁(?:(全部)?(角色联动|光锥联动|武器联动|新手)池?(全部)?(记录|祈愿|分析|统计)|全部(?:记录|祈愿|分析))([1-9]\d{0,2})?$/u;
const detailPools = new Map<string, StarRailGachaDetailPool>([
  ["光锥", "GachaType_EquipmentUp"], ["武器", "GachaType_EquipmentUp"], ["常驻", "GachaType_Standard"],
]);
type VersionPool = NonNullable<StarRailGachaVersionOptions["type"]>;
const versionPools = new Map<string, VersionPool>([
  ["角色", "char"], ["光锥", "weapon"], ["武器", "weapon"], ["常驻", "normal"], ["全部", "all"],
]);
type SpecialPool = StarRailGachaSpecialOptions["pool"];
const specialPools = new Map<string, SpecialPool>([
  ["角色联动", "GachaType_CollabAvatarUp"], ["光锥联动", "GachaType_CollabEquipmentUp"],
  ["武器联动", "GachaType_CollabEquipmentUp"], ["新手", "GachaType_Newbie"],
]);
const historyRoot = fileURLToPath(new URL("../../data/starRailGachaJson/", import.meta.url));
const legacyHistoryRoots = ["Lotus-Plugin", "Lotus-ReFactor"].map(directory =>
  fileURLToPath(new URL(`../${directory}/data/starRailGachaJson/`, import.meta.url)));
const recordsRoot = fileURLToPath(new URL("../../data/starRailGachaRows/", import.meta.url));
const legacyRecordsRoot = fileURLToPath(new URL("../../data/srJson/", import.meta.url));
const help = [
  "星铁抽卡记录",
  "#登录列表 可查看档案，#同步角色 可同步星铁角色。",
  "*更新抽卡记录 可更新官方范围内的记录。",
  "*抽卡记录、*光锥记录、*常驻记录、*新手记录、*角色联动记录、*光锥联动记录 可查看指定卡池。",
  "*全部记录 可查看各池，*版本统计 可按活动卡池期次查看。",
  "私聊 *导入记录 可接收 UIGF / SRGF 文件，*导出记录 可发送本地逐抽档案。",
  "*逐抽记录、*逐抽版本统计、*逐抽全部记录 查看本地逐抽档案。",
  "末尾加档案编号可选档案，如 *抽卡记录2。单池可加「全部」查看各页，如 *角色全部记录2。",
].join("\n");

type GachaView = { readonly detail: StarRailGachaDetailPool } | { readonly version: VersionPool }
  | { readonly special: SpecialPool; readonly statistics: boolean };

function matchGachaQuery(message: string): { profileId: number; view: GachaView; all: boolean } | undefined {
  const special = specialCommand.exec(message);
  if (special) {
    return {
      profileId: Number(special[5] ?? 1),
      view: { special: specialPools.get(special[2] ?? "") ?? "all", statistics: special[4] === "统计" },
      all: !special[2] || !!(special[1] || special[3]),
    };
  }
  const version = versionCommand.exec(message);
  if (version && !(version[1] === "全部" && version[2])) {
    return { profileId: Number(version[3] ?? 1), view: { version: versionPools.get(version[1]!) ?? "up" }, all: !!version[2] };
  }
  const pool = poolCommand.exec(message);
  if (!pool) return;
  const name = pool[2]!;
  const view = pool[4] === "统计" ? { version: versionPools.get(name) ?? "up" }
    : { detail: detailPools.get(name) ?? "GachaType_AvatarUp" };
  return { profileId: Number(pool[5] ?? 1), view, all: !!(pool[1] || pool[3]) };
}

function matchGachaCommand(message: string) {
  const matched = updateCommand.exec(message);
  const recordArchive = message.startsWith(recordPrefix);
  const suffix = recordArchive ? message.slice(recordPrefix.length) : "";
  const queryMessage = recordArchive ? `#星铁${recordDefault.test(suffix) ? "抽卡" : ""}${suffix}` : message;
  const query = matched ? undefined : matchGachaQuery(queryMessage);
  if (!matched && !query) return;
  const profileId = query?.profileId ?? Number(matched?.[1] ?? 1);
  if (profileId <= MAX_PROFILE_ID) return { profileId, query, recordArchive };
}

export function createModule({ signal, lockFile, runtimeVersion }: {
  signal: AbortSignal;
  lockFile: Parameters<typeof createStarRailGachaHistoryStore>[1];
  runtimeVersion?: { readonly version?: string; readonly revision?: string };
}) {
  const profiles = createProfileStore(Bun.env.LOTUS_PROFILE_DIR || undefined);
  const client = createProfileHoyoClient(profiles);
  const groupRank = createStarRailGroupRelicRank(profiles, lockFile, signal);
  const panel = createStarRailPanel(profiles, client, lockFile, signal, groupRank);
  const teamDamage = createStarRailTeamDamageQuery(profiles, createStarRailPersonalPanelReader(lockFile), signal);
  const monthly = createStarRailMonthlyQuery(profiles, client, signal);
  const ledger = createStarRailLedgerQuery(profiles, client, signal);
  const online = createStarRailOnlineQuery(profiles, client, signal);
  const simulate = createStarRailSimulation({ lockFile, signal });
  const history = createStarRailGachaHistoryStore(historyRoot, lockFile, legacyHistoryRoots);
  const archive = createStarRailGachaRecordArchive({ directory: recordsRoot, legacyDirectory: legacyRecordsRoot }, lockFile);
  const hasDisplayHistory = async (qq: string, uid: string) =>
    (await history.read(qq, uid) ?? await history.readLegacy(qq, uid)) !== null;
  const gachaFiles = createStarRailGachaFiles(profiles, archive, signal, runtimeVersion?.version ?? runtimeVersion?.revision ?? "dev",
    hasDisplayHistory);
  const service = createStarRailGachaSync(profiles, client, history);
  const updateGacha = createGachaUpdater((qq, profileId) => service.sync(qq, profileId, { signal }));

  async function query(qq: string, { profileId, view, all }: NonNullable<ReturnType<typeof matchGachaQuery>>, recordArchive: boolean) {
    if (!recordArchive && "special" in view && view.statistics) return "联动池和新手池请使用对应的记录指令。";
    try {
      const role = await profiles.savedRole(qq, profileId, "sr");
      const { uid, nickname } = role;
      let snapshot = recordArchive ? null : await history.read(qq, uid);
      const raw = snapshot === null ? await archive.read({ qq, uid }, { legacyTimezone: starRailLegacyArchiveTimezone(role) }) : undefined;
      if (raw?.status === "unavailable") {
        if (recordArchive) {
          const summary = raw.reason === "mirror" ? "旧显示镜像" : await hasDisplayHistory(qq, uid) ? "显示用汇总记录" : "";
          return summary
            ? `UID:${uid} 本地只有${summary}，请通过 *导入记录${profileId === 1 ? "" : profileId} 导入真实逐抽文件。`
            : `UID:${uid} 本地暂无逐抽档案，可使用 *导入记录${profileId === 1 ? "" : profileId}。`;
        }
        snapshot = await history.readLegacy(qq, uid);
        if (snapshot === null) {
          return `[starrail] profile ${profileId} 暂无星铁抽卡记录，请先使用 *更新抽卡记录${profileId === 1 ? "" : profileId}。`;
        }
      }
      const themeDirectory = starRailGachaThemeDirectory();
      const rawArchive = raw?.status === "available" ? raw.archive : undefined;
      const [resolveItem, schedule, draws] = await Promise.all([
        rawArchive ? undefined : readStarRailGachaItems(themeDirectory),
        rawArchive || !("special" in view) ? readStarRailGachaSchedule(themeDirectory) : [],
        rawArchive && readStarRailRecordItems(themeDirectory).then((resolver) => starRailRecordDraws(rawArchive, resolver)),
      ]);
      const shared = { uid, face: { name: nickname || "开拓者" }, now: new Date() };
      const options = { ...shared, history: snapshot, resolveItem, face: { name: nickname || "旅行者" } };
      const resolvePool = resolveStarRailDetailPool(schedule);
      const resolveRecordPool = draws && resolveStarRailRecordPool(schedule);
      function buildPage(page?: number) {
        if (draws) {
          const records = { ...shared, draws, resolvePool: resolveRecordPool, page };
          if ("detail" in view) {
            const model = buildStarRailRecordDetail({ ...records, pool: view.detail });
            return model && { kind: "detail" as const, model: { ...model, recordArchive: true as const } };
          }
          if ("special" in view) {
            const model = buildStarRailRecordSpecial({ ...records, pool: view.special });
            return model && { kind: "record-special" as const, model };
          }
          const model = buildStarRailRecordVersion({ ...records, type: view.version, schedule });
          return model && { kind: "version" as const, model };
        }
        if ("detail" in view) {
          const model = buildStarRailGachaDetail({ ...options, pool: view.detail, resolvePool, page });
          return model && { kind: "detail" as const, model };
        }
        if ("special" in view) {
          const model = buildStarRailGachaSpecial({ ...options, pool: view.special, page });
          return model && { kind: "special" as const, model };
        }
        const model = buildStarRailGachaVersion({ ...options, type: view.version, schedule, page });
        return model && { kind: "version" as const, model };
      }
      const first = buildPage(all ? 1 : undefined);
      if (!first) return `UID:${uid} 本地暂无该卡池抽卡记录。`;
      try {
        const pages = [];
        const total = first.model.pageInfo?.total ?? 1;
        for (let page = 1; page <= total; page++) {
          if (signal.aborted) return;
          const result = page === 1 ? first : buildPage(page);
          if (!result) throw new Error("星铁抽卡记录缺少分页。");
          const render = result.kind === "record-special" ? renderStarRailRecordSpecial(result.model, { themeDirectory })
            : result.kind === "special" ? renderStarRailGachaSpecial(result.model, { themeDirectory })
            : result.kind === "detail" ? renderStarRailGachaDetail(result.model, { themeDirectory })
            : renderStarRailGachaVersion(result.model, { themeDirectory });
          const { png } = await render;
          pages.push({ type: "image" as const, file: png });
        }
        if (signal.aborted) return;
        const role = await profiles.savedRole(qq, profileId, "sr").catch(() => undefined);
        if (role?.uid !== uid) return "星铁档案角色已变化，请重新查询。";
        if (pages.length === 1) return pages[0];
        const title = first.kind === "version" ? `${first.model.poolName}统计，共${first.model.pageInfo!.count}期卡池`
          : first.kind === "detail" ? `${first.model.poolName}池抽卡记录，共${first.model.gacha.stat.fiveNum}条五星`
          : `${first.model.poolName === "全部" ? "全部卡池" : `${first.model.poolName}池`}抽卡记录，共${first.model.fiveNum}条五星`;
        return { type: "forward" as const, nodes: [`UID:${uid} ${title}，分${pages.length}张图`, ...pages] };
      } catch {
        if (!signal.aborted) return "星铁抽卡记录已读取，原版详情图暂时无法生成。";
      }
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ProfileError) {
        if (error.code === "missing") return `[starrail] 请先登录 profile ${profileId}。`;
        if (error.code === "role-missing") return `[starrail] profile ${profileId} 没有同步星铁 UID。`;
      }
      if (error instanceof StarRailGachaArchiveError) return error.message;
      return "星铁抽卡记录读取失败，请检查本地历史文件。";
    }
  }

  return {
    commands: {},
    async gachaUpdate(qq: string, profileId: number) {
      const result = await updateGacha(qq, profileId);
      return result && { uid: result.log.uid };
    },
    fallbackFeatures(context: StarRailGachaFileContext) {
      const message = context.normalizedMessage;
      if (starRailMonthlyCommand.test(message)) return ["[starrail] 星琼月收入"];
      if (matchStarRailLedger(message)) return ["[starrail] 个人资产流水"];
      if (starRailOnlineCommand.test(message)) return ["[starrail] 在线时长"];
      if (parseStarRailTeamDamage(message)) return ["[starrail] 队伍伤害"];
      if (parseChallengeQuery(message) || parsePanelCommand(message)) return [];
      return matchesStarRailGachaFiles(context) || helpCommand.test(message) || matchGachaCommand(message)
        ? ["[gacha] 抽卡记录"] : [];
    },
    async fallback(_message: string, context: StarRailGachaFileContext & StarRailGroupRankContext) {
      const month = starRailMonthlyCommand.exec(context.normalizedMessage);
      if (month) return monthly(context, Number(month[1] ?? 1));
      const historyPage = matchStarRailLedger(context.normalizedMessage);
      if (historyPage) return ledger(context, historyPage);
      const onlineMatch = starRailOnlineCommand.exec(context.normalizedMessage);
      if (onlineMatch) return online(context, Number(onlineMatch[1] ?? 1));
      const team = parseStarRailTeamDamage(context.normalizedMessage);
      if (team) return teamDamage(context, team);
      const challenge = parseChallengeQuery(context.normalizedMessage);
      if (challenge) {
        const userId = context.user_id;
        if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId < 1) {
          return "请从登录档案对应的 QQ 会话使用星铁挑战战绩。";
        }
        return queryStarRailChallenge(String(userId), challenge, profiles, client, signal);
      }
      const panelCommand = parsePanelCommand(context.normalizedMessage);
      if (panelCommand) {
        const userId = context.user_id;
        if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId < 1) {
          return "请从登录档案对应的 QQ 会话使用星铁面板。";
        }
        return panel(String(userId), panelCommand, context);
      }
      const relicRank = await groupRank.query(context.normalizedMessage, context);
      if (relicRank !== undefined) {
        return relicRank;
      }
      const poolInfo = await queryStarRailPoolInfo(context.normalizedMessage, signal);
      if (poolInfo !== undefined) return poolInfo;
      const rankStats = await queryStarRailRankStats(context.normalizedMessage, signal);
      if (rankStats !== undefined) return rankStats;
      const simulated = await simulate(context.normalizedMessage, context);
      if (simulated !== undefined) return simulated;
      const fileReply = await gachaFiles(context);
      if (fileReply !== undefined) return fileReply;
      if (helpCommand.test(context.normalizedMessage)) return help;
      const command = matchGachaCommand(context.normalizedMessage);
      if (!command) return;
      const { profileId, query: view, recordArchive } = command;
      const { user_id } = context;
      if (typeof user_id !== "number" || !Number.isSafeInteger(user_id) || user_id < 1) {
        return "请从登录档案对应的 QQ 会话使用星铁抽卡记录。";
      }
      const qq = String(user_id);
      if (view) return query(qq, view, recordArchive);
      try {
        const result = await updateGacha(qq, profileId, () =>
          context.reply(`[starrail] 正在为 profile ${profileId} 补齐官方范围内的星铁五星与垫抽记录。`));
        if (!result) return "该档案的星铁抽卡记录正在更新，请稍后再试。";
        try {
          const { png } = await renderStarRailGachaResult(result);
          return { type: "image" as const, file: png };
        } catch {
          return `[starrail] 星铁抽卡记录更新完成，新增 ${result.added} 条五星记录。`;
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ProfileError) {
          if (error.code === "missing" || error.code === "login-required") {
            return `[starrail] 请先登录 profile ${profileId}。`;
          }
          if (error.code === "role-missing") return `[starrail] profile ${profileId} 没有同步星铁 UID。`;
        }
        const reason = error instanceof HoyoRequestError && error.status === 429 ? "rate-limited"
          : (error instanceof ProfileError && error.code === "changed") ||
            (error instanceof HoyoRequestError && error.code === "profile-changed") ? "profile-changed" : "request-failed";
        try {
          const { png } = await renderStarRailGachaFailure({ qq, profileId, reason });
          return { type: "image" as const, file: png };
        } catch {
          return "[starrail] 星铁抽卡记录更新失败，请检查档案登录状态与星铁 UID。";
        }
      }
    },
  };
}
