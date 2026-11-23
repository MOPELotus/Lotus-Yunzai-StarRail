import type { AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { CommandReply } from "../../../lib/commands.ts";
import { parseWarpAdministration, runWarpAdministration } from "./admin.ts";
import characterNames from "../challenge-character-names.json";
import { emptyPity, simulateWarps, type WarpPull } from "./draw.ts";
import { createWarpPoolSource, customWarpPool, type WarpKind } from "./pools.ts";
import { renderWarpCard, renderWarpReincarnation } from "./card.ts";
import { createWarpSettingsStore, readWarpAllowance } from "./settings.ts";
import { createWarpArchive, integer, readWarpAccount, warpDay, warpRetentionDays, warpStateDirectory, warpWeek } from "./store.ts";

const ticketCommand = /^#星铁(?:我的|领取|查询|查看)(?:星轨专|星轨通|星轨|专属|普通|专|通)?票?$/u;
const oneBotForwardLimit = 96 * 1024 * 1024;
const help = /^#星铁模拟(?:抽卡|跃迁)(?:帮助)?$/u;
const reincarnation = /^#星铁转生$/u;
const drawCommand = /^#星铁(?<before>角色池?|光锥池?|武器池?|常驻池?)?(?<size>单抽|(?:[一二三四五六七八九]?十|百|10)[连抽卡奖]|抽[卡奖])(?<after>角色池?|光锥池?|武器池?|常驻池?)?(?:池?(?<slot>[1-4]))?$/u;

export function parseWarpCommand(message: string) {
  const { before, after, size, slot } = drawCommand.exec(message)?.groups ?? {};
  if (!size || (before && after)) return;
  const label = before ?? after ?? "";
  const kind: WarpKind = label.startsWith("常驻") ? "standard" : /^(?:光锥|武器)/u.test(label) ? "cone" : "character";
  if (kind === "standard" && slot) return;
  const multiple = "一二三四五六七八九".indexOf(size[0]!) + 1;
  const count = size === "单抽" ? 1 : size.startsWith("百") ? 100 : (multiple || 1) * 10;
  return { kind, slot: Number(slot ?? 1), count };
}

export function matchesWarpCommand(message: string) {
  return help.test(message) || ticketCommand.test(message) || reincarnation.test(message) ||
    parseWarpCommand(message) !== undefined || parseWarpAdministration(message) !== undefined;
}

interface WarpContext {
  readonly adapter?: "milky";
  readonly forward?: unknown;
  readonly user_id?: number;
  readonly group_id?: number;
  readonly isMaster?: boolean;
  readonly isBotMaster?: (user: number) => boolean;
  readonly isDelegated?: boolean;
  readonly sender?: Readonly<Record<string, unknown>>;
  readonly inlineImageByteLimit?: number;
}

type Reply = string | { readonly type: "image"; readonly file: Uint8Array };
type WarpResult = { readonly text: string; readonly recall?: true } | { readonly pulls: readonly WarpPull[]; readonly pity: number };
const characters = [...new Set(Object.values(characterNames))];
const aeons = [
  ["阿基维利", "开拓"], ["纳努克", "毁灭"], ["岚", "巡猎"], ["博识尊", "智识"], ["希佩", "同谐"], ["IX", "虚无"],
  ["克里珀", "存护"], ["药师", "丰饶"], ["阿哈", "欢愉"], ["伊德莉拉", "纯美"], ["塔伊兹育罗斯", "繁育"],
  ["奥博洛斯", "贪饕"], ["迷思", "神秘"], ["互", "均衡"], ["末王", "终末"], ["龙", "不朽"], ["太一", "秩序"], ["浮黎", "记忆"],
] as const;

function format(pull: WarpPull) {
  return `${pull.order}. ${pull.rarity}★ ${pull.name}${pull.featured ? " UP" : ""}${pull.pity ? `（第 ${pull.pity} 抽）` : ""}`;
}

function recallResult(message: Reply, seconds: number): CommandReply {
  return seconds ? { type: "recallable", message, seconds } : message;
}

export function createStarRailSimulation({
  lockFile, signal, directory = warpStateDirectory(),
  poolSource = createWarpPoolSource(), now = Date.now, random = Math.random, render = renderWarpCard,
  renderReincarnation = renderWarpReincarnation,
}: {
  readonly lockFile: AcquireRoleArchiveLock;
  readonly signal: AbortSignal;
  readonly directory?: string;
  readonly poolSource?: ReturnType<typeof createWarpPoolSource>;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly render?: typeof renderWarpCard;
  readonly renderReincarnation?: typeof renderWarpReincarnation;
}) {
  const archive = createWarpArchive(directory, lockFile);
  const settings = createWarpSettingsStore(lockFile, directory);

  return async (message: string, context: WarpContext): Promise<CommandReply | undefined> => {
    if (signal.aborted) return;
    if (help.test(message)) return [
      "星铁模拟跃迁",
      "*单抽、*十连、*百连 可模拟角色活动跃迁，末尾可加卡池编号。",
      "*十连光锥、*十连常驻 可切换池；用 *我的星轨票 查询余量，每天北京时间 04:00 补满。用 *转生 抽取角色或星神。",
      "模拟使用近似概率，与游戏内跃迁记录分开。",
    ].join("\n");
    const draw = parseWarpCommand(message);
    const administration = parseWarpAdministration(message);
    const relife = reincarnation.test(message);
    if (!draw && !administration && !relife && !ticketCommand.test(message)) return;
    if (!integer(context.user_id) || context.user_id === 0) return "请在 QQ 会话使用星铁模拟跃迁。";
    const user = context.user_id;
    const qq = String(user);
    const group = integer(context.group_id) && context.group_id > 0 ? String(context.group_id) : undefined;
    const conversationKey = group ?? "private";
    const isOwner = () => context.isMaster === true && !context.isDelegated && (!context.isBotMaster || context.isBotMaster(user));
    const time = now();
    const day = warpDay(time);
    try {
      if (administration) {
        if (!isOwner()) return "只有主人可以管理星铁模拟跃迁。";
        return await runWarpAdministration(administration, { settings, group, random, verifyOwner: async () => {
          signal.throwIfAborted();
          if (!isOwner()) throw new RangeError("当前会话的主人权限已变更。");
        } });
      }
      const rules = await settings.read();
      signal.throwIfAborted();
      if (relife) {
        const outcome = await archive.update<{ remainingMinutes: number } | { name: string; path?: string }>(
          { qq, uid: "1" }, async () => signal.throwIfAborted(), raw => {
          const account = readWarpAccount(raw);
          if (!isOwner() && (account.reincarnatedUntil ?? 0) > time) {
            return { result: { remainingMinutes: Math.ceil((account.reincarnatedUntil! - time) / 60_000) } };
          }
          account.reincarnatedUntil = time + rules.reincarnationMinutes * 60_000;
          const asAeon = random() < 0.5;
          const choice = random();
          const [name, path] = asAeon ? aeons[Math.floor(choice * aeons.length)]! : [characters[Math.floor(choice * characters.length)]!];
          return { document: account, result: { name, path } } as const;
        });
        if ("remainingMinutes" in outcome) return `转生冷却中，还需等待 ${outcome.remainingMinutes} 分钟。`;
        const { name, path } = outcome;
        const sender = context.sender?.card || context.sender?.nickname;
        const nickname = typeof sender === "string" && sender.trim() ? [...sender.trim()].slice(0, 32).join("") : "开拓者";
        const title = `${nickname}，恭喜你转生成了 ${name}${path ? ` · ${path}` : ""}。`;
        try {
          const { png } = await renderReincarnation({ name, path, nickname, qq, allegiance: path && "星神",
            inlineImageByteLimit: context.inlineImageByteLimit });
          if (!signal.aborted) return { type: "image", file: png };
        } catch {
          if (!signal.aborted) return title;
        }
        return;
      }
      if (!rules.enabled) return "星铁模拟跃迁功能已关闭。";
      if (draw && draw.count > 10 && !rules.multiple) return "星铁模拟跃迁未开启多连抽。";
      const allowance = readWarpAllowance(rules, group);
      const customNames = draw?.kind === "cone" ? rules.poolNames.coneFive : rules.poolNames.characterFive;
      const manual = draw && draw.kind !== "standard" && !rules.automaticPools && customNames?.[draw.slot - 1];
      const source = draw && await poolSource(draw.kind, draw.slot, time).catch(error => {
        if (!manual) throw error;
      });
      const pool = draw && customWarpPool(draw.kind, draw.slot, source, rules);
      if (draw && !pool) return "该编号当前没有已确认的活动跃迁卡池，可用 *十连常驻。";
      const result = await archive.update<WarpResult>({ qq, uid: "1" }, async () => signal.throwIfAborted(), (raw) => {
        const account = readWarpAccount(raw);
        const issued = account.balance.day !== day || (account.balance.expiresAt !== undefined && time >= account.balance.expiresAt);
        if (issued) account.balance = { day, special: allowance.special, regular: allowance.regular };
        const balance = account.balance;
        if (!draw || !pool) {
          const result = { text: `今日你还有 ${balance.special} 张星轨专票和 ${balance.regular} 张星轨通票。` };
          return issued ? { document: account, result } : { result };
        }
        const ticket = pool.kind === "standard" ? "regular" : "special";
        if (balance[ticket] < draw.count) {
          const conversation = account.conversations[conversationKey];
          const today = conversation?.today?.day === day ? conversation.today : undefined;
          const week = conversation?.week?.id === warpWeek(time) ? conversation.week.five : 0;
          const recent = today?.five ? `今日模拟五星 ${today.five >= 8 ? `${today.five} 个` : today.samples.map(item => `${item.name}（${item.pity} 抽）`).join("、")}`
            : `今日已累计 ${(pool.kind === "cone" ? today?.cone : today?.standardAndCharacter) ?? 0} 抽无五星`;
          const result = { text: `你的${ticket === "regular" ? "通票" : "专票"}不足。需要 ${draw.count} 张，你还有 ${balance[ticket]} 张。\n${recent}${week >= 2 ? ` · 本周 ${week} 个五星` : ""}`,
            recall: true as const };
          return issued ? { document: account, result } : { result };
        }
        balance[ticket] = isOwner() ? Math.min(Number.MAX_SAFE_INTEGER, balance[ticket] + draw.count) : balance[ticket] - draw.count;
        delete balance.expiresAt;
        for (const [key, conversation] of Object.entries(account.conversations)) {
          const expired = conversation.expiresAt === undefined ? day - conversation.lastDay >= warpRetentionDays : time >= conversation.expiresAt;
          if (expired) delete account.conversations[key];
        }
        const conversation = account.conversations[conversationKey] ?? {
          lastDay: day, pity: { character: emptyPity(), cone: emptyPity(), standard: emptyPity() },
        };
        conversation.lastDay = day;
        delete conversation.expiresAt;
        account.conversations[conversationKey] = conversation;
        const weekId = warpWeek(time);
        if (conversation.week?.id !== weekId) conversation.week = { id: weekId, five: 0 };
        if (conversation.today?.day !== day) conversation.today = { day, standardAndCharacter: 0, cone: 0, five: 0, samples: [] };
        const metric = pool.kind === "cone" ? "cone" : "standardAndCharacter";
        const today = conversation.today;
        today[metric] = Math.min(Number.MAX_SAFE_INTEGER, today[metric] + draw.count);
        const pity = conversation.pity[pool.kind];
        const pulls = simulateWarps(pool, pity, draw.count, random, rules.rates, conversation.week, rules.weeklyBonus);
        for (const pull of pulls) {
          if (pull.rarity !== 5) continue;
          today.five = Math.min(Number.MAX_SAFE_INTEGER, today.five + 1);
          if (today.samples.length < 7) today.samples.push({ name: pull.name, pity: pull.pity! });
        }
        return { document: account, result: { pulls, pity: pity.fiveMisses } };
      });
      if ("text" in result) return recallResult(result.text, result.recall ? allowance.recallSeconds : 0);
      if (!pool || signal.aborted) return;
      const five = result.pulls.filter(item => item.rarity === 5).length;
      const four = result.pulls.filter(item => item.rarity === 4).length;
      const count = result.pulls.length;
      const shouldRetain = count === 10 ? five >= 1 || four >= 4 : count > 10 && (five >= 2 || four >= 25);
      const recallSeconds = shouldRetain ? 0 : allowance.recallSeconds;
      const intro = `${pool.title} · 模拟 ${count} 抽 · ${five} 个五星 · ${four} 个四星 · 当前垫 ${result.pity} 抽`;
      const nodes: Reply[] = [intro];
      for (let start = 0; start < result.pulls.length; start += 10) {
        if (signal.aborted) return;
        const pulls = result.pulls.slice(start, start + 10);
        try {
          const image = await render({ title: pool.title, pity: result.pity, pulls, page: start / 10 + 1,
            pages: Math.ceil(result.pulls.length / 10), inlineImageByteLimit: context.inlineImageByteLimit });
          nodes.push({ type: "image", file: image.png });
        } catch {
          nodes.push(pulls.map(format).join("\n"));
        }
      }
      if (signal.aborted) return;
      if (nodes.length === 2) return recallResult(typeof nodes[1] === "string" ? `${intro}\n${nodes[1]}` : nodes[1]!, recallSeconds);
      const recall = recallSeconds ? { recallSeconds } : {};
      if (typeof context.forward === "function" && context.adapter !== "milky") {
        // Reverse WebSocket RPC carries each image as base64. The gateway accepted 96 MiB in the transport probe.
        const bytes = nodes.map(node => 1024 + (typeof node === "string"
          ? Buffer.byteLength(node) : 4 * Math.ceil(node.file.byteLength / 3)));
        if (bytes.reduce((total, size) => total + size, 0) > oneBotForwardLimit) {
          const batchSize = Math.max(1, Math.floor(oneBotForwardLimit / Math.max(...bytes)));
          return { type: "forward", nodes, batchSize, ...recall };
        }
      }
      return { type: "forward", nodes, ...recall };
    } catch (error) {
      if (administration && error instanceof RangeError && !signal.aborted) return error.message;
      if (!signal.aborted) return "星铁模拟跃迁暂时无法完成，请检查活动卡池配置与模拟存档。";
    }
  };
}
