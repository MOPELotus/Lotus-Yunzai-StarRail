import { setTimeout } from "node:timers/promises";
import { MAX_PROFILE_ID, ProfileError, type createProfileStore, type ProfileRequestContext } from "@lotus-yunzai/account";
import { GameRecordRequestError, HoyoRequestError, type createProfileHoyoClient } from "@lotus-yunzai/hoyo-client";
import { previewRedeemIdentity } from "@lotus-yunzai/hoyo-client/redeem-submit";
import { renderStarRailMonthlyCard, renderStarRailMonthlyStatistics } from "./account-report-renderer.ts";
import { makeStarRailMonthlyCard, starRailMonthlyText } from "./monthly-card.ts";
import type { createStarRailMonthlyArchive, StarRailMonthlyIdentity } from "./monthly-archive.ts";
import { matchStarRailMonthly, starRailRecentPeriods, starRailStatisticsPeriod } from "./monthly-period.ts";
import { buildStarRailMonthlyStatistics, starRailStatisticsText } from "./monthly-statistics.ts";

type MonthlyInput = NonNullable<ReturnType<typeof matchStarRailMonthly>>;
type Profiles = Pick<ReturnType<typeof createProfileStore>,
  "requestSelectedContext" | "requestContexts" | "requestContext" | "listCheckinProfiles">;
type Client = Pick<ReturnType<typeof createProfileHoyoClient>, "fetchStarRailMonthly">;
type Archive = ReturnType<typeof createStarRailMonthlyArchive>;
type Period = ReturnType<typeof starRailRecentPeriods>[number];

interface MonthlyContext {
  readonly user_id?: number;
  readonly self_id?: number;
  readonly message_type?: string;
  readonly isDelegated?: boolean;
  readonly isMaster?: boolean;
  readonly isBotMaster?: (user: number) => boolean;
  readonly privateCredentialSignal?: AbortSignal;
  readonly inlineImageByteLimit?: number;
  readonly message?: string | readonly { readonly type: string; readonly qq?: unknown }[];
  readonly reply?: (message: string) => unknown;
}

const changed = "星铁档案已变更，请重新查询月收入。";
const shortcuts = (profileId: number) => {
  const profile = profileId === 1 ? "" : ` 档案${profileId}`;
  return `记录 *星琼${profile} · 统计 *星琼统计${profile}`;
};

function identity(source: ProfileRequestContext, qq: string): StarRailMonthlyIdentity | undefined {
  const { uid, region, gameBiz } = source.role;
  const accountId = source.account?.stuid || source.account?.ltuid;
  if (!accountId || previewRedeemIdentity(source) !== accountId || gameBiz !== "hkrpg_cn" || !/^[1-5]\d{8}$/u.test(uid) ||
      region !== (uid.startsWith("5") ? "prod_qd_cn" : "prod_gf_cn")) return;
  return { qq, accountId, uid, region, gameBiz };
}

function access(read: () => Promise<ProfileRequestContext>, store: Archive, client: Client,
  guard: () => void, signal: AbortSignal, time: number) {
  return (source: ProfileRequestContext, who: StarRailMonthlyIdentity) => {
    let revision = source.revision;
    async function verify() {
      guard();
      const active = await read().catch(() => undefined);
      const owned = active && identity(active, who.qq);
      if (!active || active.revision !== revision || !owned || owned.uid !== who.uid ||
          owned.accountId !== who.accountId || owned.region !== who.region || owned.gameBiz !== who.gameBiz) {
        throw new ProfileError("changed", changed);
      }
      guard();
      return active;
    }
    async function fetchMonth(period: Period, selectMonth: boolean) {
      const active = await verify();
      const live = await client.fetchStarRailMonthly(active, { signal, ...(selectMonth && { month: period.key }) });
      revision = live.revision;
      await verify();
      return live.snapshot;
    }
    async function save(period: Period, snapshot: NonNullable<Awaited<ReturnType<typeof fetchMonth>>>) {
      return store.record(who, { ...period, fetchedAt: time, snapshot }, async () => { await verify(); });
    }
    return { verify, fetchMonth, save };
  };
}

export function createStarRailMonthlyQuery(profiles: Profiles, client: Client, lifecycle: AbortSignal, archive: Archive,
  { now = Date.now, render = renderStarRailMonthlyCard, renderStatistics = renderStarRailMonthlyStatistics,
    pace = (signal: AbortSignal) => setTimeout(500, undefined, { signal }) } = {}) {
  let running = false;

  return async function query(input: MonthlyInput, context: MonthlyContext) {
    const signal = context.privateCredentialSignal ? AbortSignal.any([lifecycle, context.privateCredentialSignal]) : lifecycle;
    if (signal.aborted) return [];
    const { user_id: user, self_id: self, message_type: scene, message } = context;
    if (context.isDelegated || (scene !== "private" && scene !== "group") || !user ||
        !Number.isSafeInteger(user) || user < 1 || user === self ||
        (Array.isArray(message) && message.some(part => part.type === "at" && String(part.qq) !== String(self)))) {
      return "请从本人 QQ 会话查询星铁月收入。";
    }
    const time = now();
    const recent = starRailRecentPeriods(time);
    const current = recent.at(-1);
    if (!current) return "暂无可查询的星铁月份。";
    const qq = String(user);

    if (input.type === "task") {
      const authorized = () => context.isBotMaster ? context.isBotMaster(user) : context.isMaster === true;
      if (!authorized()) return "仅当前机器人的主人可执行星琼任务。";
      if (running) return "星琼任务正在执行，请稍后重试。";
      const guard = () => {
        signal.throwIfAborted();
        if (!authorized() || starRailRecentPeriods(now()).at(-1)?.key !== current.key) {
          throw new DOMException("权限变化或已跨月。", "AbortError");
        }
      };
      let completed = 0, failed = 0, written = 0;
      const targets: { readonly qq: string; readonly account: ProfileRequestContext; readonly who: StarRailMonthlyIdentity; readonly profileId: number }[] = [];
      running = true;
      try {
        const seen = new Set<string>();
        for (const slot of await profiles.listCheckinProfiles()) {
          guard();
          if (!slot.loggedIn) continue;
          const roles = await profiles.requestContexts(slot.qq, slot.profileId, ["sr"]).catch(error => {
            if (error instanceof ProfileError) return [];
            throw error;
          });
          for (const account of roles) {
            const who = identity(account, slot.qq);
            const key = who && `${who.qq}/${who.accountId}/${who.uid}`;
            if (!who || !key || seen.has(key) || !account.device.id || !account.device.fp) continue;
            seen.add(key);
            targets.push({ qq: slot.qq, account, who, profileId: slot.profileId });
          }
        }
        guard();
        if (!targets.length) return "没有可归档的已登录国服星铁角色。";
        await context.reply?.(`开始保存 ${targets.length} 个星铁角色的开拓月历。`);
        for (const [index, target] of targets.entries()) {
          const { qq: targetQQ, account, who, profileId } = target;
          guard();
          try {
            const session = access(() => profiles.requestContext(targetQQ, profileId, "sr", who.uid),
              archive, client, guard, signal, time)(account, who);
            const saved = await archive.read(who);
            for (const period of recent) {
              if (period.finalized && saved.some(row => row.key === period.key && row.finalized)) continue;
              const snapshot = await session.fetchMonth(period, true);
              if (snapshot && await session.save(period, snapshot)) written++;
            }
            completed++;
          } catch (error) {
            guard();
            failed++;
            if (error instanceof GameRecordRequestError && (error.reason === "rate-limited" || error.reason === "risk")) break;
          }
          if (index + 1 < targets.length) await pace(signal);
        }
        guard();
        return `星琼任务结束。已完成 ${completed}/${targets.length} 个角色，${failed} 个未完成，保存 ${written} 个月。`;
      } catch {
        if (signal.aborted || !authorized()) return;
        return `星琼任务已停止。已完成 ${completed}/${targets.length} 个角色，保存 ${written} 个月。`;
      } finally {
        running = false;
      }
    }

    const { profileId } = input;
    if (profileId < 1 || profileId > MAX_PROFILE_ID) return `档案编号须为 1–${MAX_PROFILE_ID}。`;
    const period = input.type === "month" && input.month !== undefined
      ? recent.find(({ key }) => Number(key.slice(4)) === input.month) : current;
    if (!period) return "开拓月历仅支持查询最近三个月的数据。";
    const read = () => profiles.requestSelectedContext(qq, profileId, "sr");
    const guard = () => signal.throwIfAborted();
    try {
      const source = await read();
      const who = identity(source, qq);
      if (!who) return "请使用已登录并同步国服角色的星铁档案。";
      const session = access(read, archive, client, guard, signal, time)(source, who);
      if (input.type === "month" && !input.legacy) {
        const snapshot = await session.fetchMonth(period, false);
        if (!snapshot) return "暂无星铁月收入数据。";
        const returned = snapshot.month.replace(/-/gu, "").replace(/月$/u, "");
        if (returned === period.key || (returned.length <= 2 && Number(returned) === Number(period.key.slice(4)))) {
          try { await session.save(period, snapshot); } catch { await session.verify(); }
        }
        const result = await render(makeStarRailMonthlyCard(snapshot), { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
        await session.verify();
        return result ? { type: "image" as const, file: result.png } : starRailMonthlyText(snapshot);
      }

      const initial = await archive.read(who);
      await session.verify();
      let requested: Awaited<ReturnType<typeof session.fetchMonth>> = null;
      let notice: string | undefined;
      if (input.type === "month" || !input.selection) {
        const selected = input.type === "month" ? [period, ...recent.filter(candidate => candidate.key !== period.key)] : recent;
        for (const candidate of selected) {
          if (candidate.finalized && initial.some(row => row.key === candidate.key && row.finalized)) continue;
          try {
            const snapshot = await session.fetchMonth(candidate, true);
            if (snapshot) {
              if (candidate.key === period.key) requested = snapshot;
              await session.save(candidate, snapshot);
            }
          } catch (error) {
            if (error instanceof HoyoRequestError && error.code === "profile-changed") throw error;
            await session.verify();
            notice = error instanceof HoyoRequestError ? error.message : "星铁月历本次未能完整更新。";
            break;
          }
        }
      }
      const saved = input.type === "statistics" && input.selection ? initial : await archive.read(who);
      await session.verify();
      let line: string, image: Uint8Array | undefined;
      if (input.type === "month") {
        const snapshot = requested ?? saved.find(row => row.key === period.key)?.snapshot;
        if (!snapshot) return notice ?? "暂无该月的星铁月收入数据。";
        const rendered = await render(makeStarRailMonthlyCard(snapshot), { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
        image = rendered?.png;
        line = starRailMonthlyText(snapshot);
      } else {
        const selection = starRailStatisticsPeriod(time, input.selection);
        if (!selection) return "请指定星穹铁道上线至今年之间的年份。";
        const model = buildStarRailMonthlyStatistics(who.uid, saved, selection);
        if (!model) return notice ?? `${selection.label}暂无星琼统计存档。可先查询 *星琼。`;
        const rendered = await renderStatistics(model, { inlineImageByteLimit: context.inlineImageByteLimit }).catch(() => undefined);
        image = rendered?.png;
        line = starRailStatisticsText(model);
      }
      await session.verify();
      const tail = notice ? `${notice} 已显示可用数据。\n${shortcuts(profileId)}` : shortcuts(profileId);
      return [image ? { type: "image" as const, file: image } : line, tail] as const;
    } catch (error) {
      if (signal.aborted) return [];
      if (error instanceof ProfileError) {
        if (error.code === "missing" || error.code === "login-required") return `请先登录档案 ${profileId}。`;
        if (error.code === "role-missing") return `档案 ${profileId} 没有已同步的星铁角色。`;
        if (error.code === "changed") return changed;
      }
      if (error instanceof HoyoRequestError) return error.code === "profile-changed" ? changed : error.message;
      return "获取星铁月收入失败，请稍后重试。";
    }
  };
}
