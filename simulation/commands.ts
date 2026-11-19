import { fileURLToPath } from "node:url";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { emptyPity, simulateWarps, type WarpPity, type WarpPull } from "./draw.ts";
import { createWarpPoolSource, type WarpKind } from "./pools.ts";
import { renderWarpCard } from "./card.ts";

const stateDirectory = fileURLToPath(new URL("../../../data/starrail/simulation/", import.meta.url));
const states = ["character", "cone", "standard"] as const;
const oneDay = 86_400_000;
const privateOrGroup = /^(?:private|[1-9]\d*)$/u;
const ticketCommand = /^#星铁(?:我的|领取|查询|查看)(?:星轨专|星轨通|星轨|专属|普通|专|通)?票?$/u;
const help = /^#星铁模拟(?:抽卡|跃迁)(?:帮助)?$/u;
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

interface Balance {
  day: number;
  special: number;
  regular: number;
}
interface Conversation {
  lastDay: number;
  readonly pity: Record<WarpKind, WarpPity>;
}
interface Account {
  readonly version: 1;
  balance: Balance;
  readonly conversations: Record<string, Conversation>;
}

function integer(value: unknown, upper = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= upper;
}

function readAccount(data: unknown): Account {
  if (data === null) return { version: 1, balance: { day: 0, special: 0, regular: 0 }, conversations: {} };
  if (typeof data !== "object") throw new TypeError("模拟跃迁存档格式无效。");
  const { version, balance, conversations } = data as Partial<Account>;
  if (version !== 1 || !balance || !integer(balance.day) || !integer(balance.special) || !integer(balance.regular) ||
      !conversations || typeof conversations !== "object" || Array.isArray(conversations)) throw new TypeError("模拟跃迁存档格式无效。");
  for (const [key, state] of Object.entries(conversations)) {
    if (!privateOrGroup.test(key) || !state || !integer(state.lastDay) || !state.pity || states.some((kind) => {
      const p = state.pity[kind];
      return !p || !integer(p.fiveMisses, kind === "cone" ? 79 : 89) || !integer(p.fourOrBetterMisses, 9) ||
        typeof p.nextFiveFeatured !== "boolean" || typeof p.nextFourFeatured !== "boolean";
    })) throw new TypeError("模拟跃迁保底格式无效。");
  }
  return { version, balance, conversations };
}

interface WarpContext {
  readonly user_id?: number;
  readonly group_id?: number;
  readonly isMaster?: boolean;
}

type Reply = string | { readonly type: "image"; readonly file: Uint8Array };
type WarpReply = Reply | { readonly type: "forward"; readonly nodes: readonly Reply[] };
type WarpResult = { readonly text: string } | { readonly pulls: readonly WarpPull[]; readonly pity: number };

function format(pull: WarpPull) {
  return `${pull.order}. ${pull.rarity}★ ${pull.name}${pull.featured ? " UP" : ""}${pull.pity ? `（第 ${pull.pity} 抽）` : ""}`;
}

export function createStarRailSimulation({
  lockFile, signal, directory = Bun.env.LOTUS_STAR_RAIL_WARP_STATE_DIR?.trim() || stateDirectory,
  poolSource = createWarpPoolSource(), now = Date.now, random = Math.random, render = renderWarpCard,
}: {
  readonly lockFile: AcquireRoleArchiveLock;
  readonly signal: AbortSignal;
  readonly directory?: string;
  readonly poolSource?: ReturnType<typeof createWarpPoolSource>;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly render?: typeof renderWarpCard;
}) {
  const archive = createRoleJsonArchive(directory, lockFile, {
    subject: "星铁模拟跃迁", lockSuffix: "warp-lock", maxBytes: 1024 * 1024, rejectNull: true,
  });

  return async (message: string, context: WarpContext): Promise<WarpReply | undefined> => {
    if (signal.aborted) return;
    if (help.test(message)) return [
      "星铁模拟跃迁",
      "*单抽、*十连、*百连 可模拟角色活动跃迁，末尾可加卡池编号。",
      "*十连光锥、*十连常驻 可切换池；用 *我的星轨票 查询余量，每天北京时间 04:00 补满。",
      "模拟使用近似概率，与游戏内跃迁记录分开。",
    ].join("\n");
    const draw = parseWarpCommand(message);
    if (!draw && !ticketCommand.test(message)) return;
    if (!integer(context.user_id) || context.user_id === 0) return "请在 QQ 会话使用星铁模拟跃迁。";
    const qq = String(context.user_id);
    const group = integer(context.group_id) && context.group_id > 0 ? String(context.group_id) : "private";
    const time = now();
    const day = Math.floor((time + 14_400_000) / oneDay);
    try {
      const pool = draw && await poolSource(draw.kind, draw.slot, time);
      if (draw && !pool) return "该编号当前没有已确认的活动跃迁卡池，可用 *十连常驻。";
      const result = await archive.update<WarpResult>({ qq, uid: "1" }, async () => signal.throwIfAborted(), (raw) => {
        const account = readAccount(raw);
        const issued = account.balance.day !== day;
        if (issued) account.balance = { day, special: 100, regular: 10 };
        const balance = account.balance;
        if (!draw || !pool) {
          const result = { text: `今日你还有 ${balance.special} 张星轨专票和 ${balance.regular} 张星轨通票。` };
          return issued ? { document: account, result } : { result };
        }
        const ticket = pool.kind === "standard" ? "regular" : "special";
        if (balance[ticket] < draw.count) {
          const result = { text: `你的${ticket === "regular" ? "通票" : "专票"}不足。需要 ${draw.count} 张，你还有 ${balance[ticket]} 张。` };
          return issued ? { document: account, result } : { result };
        }
        balance[ticket] = context.isMaster ? Math.min(Number.MAX_SAFE_INTEGER, balance[ticket] + draw.count) : balance[ticket] - draw.count;
        for (const [key, conversation] of Object.entries(account.conversations)) {
          if (day - conversation.lastDay >= 14) delete account.conversations[key];
        }
        const conversation = account.conversations[group] ?? {
          lastDay: day, pity: { character: emptyPity(), cone: emptyPity(), standard: emptyPity() },
        };
        conversation.lastDay = day;
        account.conversations[group] = conversation;
        const pity = conversation.pity[pool.kind];
        const pulls = simulateWarps(pool, pity, draw.count, random);
        return { document: account, result: { pulls, pity: pity.fiveMisses } };
      });
      if ("text" in result) return result.text;
      if (!pool || signal.aborted) return;
      const intro = `${pool.title} · 模拟 ${result.pulls.length} 抽 · 当前垫 ${result.pity} 抽`;
      const nodes: Reply[] = [intro];
      for (let start = 0; start < result.pulls.length; start += 10) {
        if (signal.aborted) return;
        const pulls = result.pulls.slice(start, start + 10);
        try {
          const image = await render({ title: pool.title, pity: result.pity, pulls, page: start / 10 + 1,
            pages: Math.ceil(result.pulls.length / 10) });
          nodes.push({ type: "image", file: image.png });
        } catch {
          nodes.push(pulls.map(format).join("\n"));
        }
      }
      if (signal.aborted) return;
      if (nodes.length === 2) return typeof nodes[1] === "string" ? `${intro}\n${nodes[1]}` : nodes[1];
      return { type: "forward", nodes };
    } catch {
      if (!signal.aborted) return "星铁模拟跃迁暂时无法完成，请检查活动卡池配置与模拟存档。";
    }
  };
}
