import { createTranslator as createTextTranslator } from "../../../packages/i18n/index.ts";
import messageCatalog from "../i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { setTimeout as pause } from "node:timers/promises";
import type { AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import type { CommandReply } from "../../../lib/commands.ts";
import type { ReplyOptions } from "../../../lib/messages.ts";
import { parseWarpAdministration, runWarpAdministration } from "./admin.ts";
import { pickWarpIdentity, readWarpAvatar, readWarpIdentityCatalog } from "./reincarnation.ts";
import { emptyPity, simulateWarps, type WarpPull } from "./draw.ts";
import { createWarpPoolSource, customWarpPool, isCollaborationWarp, personalWarpPool, type WarpKind } from "./pools.ts";
import { createPersonalWarpPoolReader } from "./personal-pools.ts";
import { renderWarpCard, renderWarpReincarnation } from "./card.ts";
import { createWarpSettingsStore, defaultWarpSettings, readWarpAllowance, type WarpAllowance } from "./settings.ts";
import { createIndependentWarpSettingsStore } from "./independent-settings.ts";
import { createIndependentWarpDraw, type ReadIndependentWarpKey } from "./independent-state.ts";
import { createWarpArchive, integer, lockWarpReincarnation, readWarpAccount, warpDay, warpRetentionDays, warpStateDirectory, warpWeek, type WarpConversation } from "./store.ts";

const ticketCommand = /^#星铁(?:我的|领取|查询|查看)(?:星轨专|星轨通|星轨|专属|普通|专|通)?票?$/u;
const oneBotForwardLimit = 96 * 1024 * 1024;
const help = /^#星铁模拟(?:抽卡|跃迁)(?:帮助)?$/u;
const reincarnation = /^#星铁转生$/u;
const poolLabel = $t("simulation.commands.text_1784c3c039");
const independentDraw = /^#星铁(?:抽卡|十连)(?:角色|光锥|常驻|联动角色|联动光锥|联动)?$/u;
const drawCommand = new RegExp(
  `^#星铁(?<before>${poolLabel})?(?<size>单抽|(?:[一二三四五六七八九]?十|百|10)[连抽卡奖]|抽[卡奖])(?<after>${poolLabel})?(?:池?(?<slot>[1-4]))?$`, "u",
);

export function parseWarpCommand(message: string) {
  const { before, after, size, slot } = drawCommand.exec(message)?.groups ?? {};
  if (!size || (before && after)) return;
  const label = before ?? after ?? "";
  const cone = /光锥|武器/u.test(label);
  const kind: WarpKind = label.includes("联动") ? (cone ? "collaboration-cone" : "collaboration-character")
    : label.startsWith("常驻") ? "standard" : cone ? "cone" : "character";
  if ((kind === "standard" || isCollaborationWarp(kind)) && slot) return;
  const multiple = $t("simulation.commands.text_206a7b4bd9").indexOf(size[0]!) + 1;
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
  readonly reply?: (message: Reply, quote?: boolean, options?: ReplyOptions) => unknown;
  readonly user_id?: number;
  readonly group_id?: number;
  readonly isMaster?: boolean;
  readonly isBotMaster?: (user: number) => boolean;
  readonly isDelegated?: boolean;
  readonly sender?: Readonly<Record<string, unknown>>;
  readonly inlineImageByteLimit?: number;
}

type Reply = string | { readonly type: "image"; readonly file: Uint8Array };
type WarpResult = ({ readonly text: string; readonly summary?: string } |
  { readonly pulls: readonly WarpPull[]; readonly pity: number }) & { readonly issued?: WarpAllowance };
function format(pull: WarpPull) {
  return `${pull.order}. ${pull.rarity}★ ${pull.name}${pull.featured ? " UP" : ""}${pull.pity ? $t("simulation.commands.text_f5b84e0a3b", { "pity": pull.pity }) : ""}`;
}

function recallResult(message: Reply, seconds: number): CommandReply {
  return seconds ? { type: "recallable", message, seconds } : message;
}

export function createStarRailSimulation({
  lockFile, signal, directory = warpStateDirectory(),
  poolSource = createWarpPoolSource(), now = Date.now, random = Math.random, render = renderWarpCard,
  renderReincarnation = renderWarpReincarnation,
  readIdentityCatalog = readWarpIdentityCatalog, loadAvatar = readWarpAvatar, readIndependentLegacy,
}: {
  readonly lockFile: AcquireRoleArchiveLock;
  readonly signal: AbortSignal;
  readonly directory?: string;
  readonly poolSource?: ReturnType<typeof createWarpPoolSource>;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly render?: typeof renderWarpCard;
  readonly renderReincarnation?: typeof renderWarpReincarnation;
  readonly readIdentityCatalog?: typeof readWarpIdentityCatalog;
  readonly loadAvatar?: typeof readWarpAvatar;
  readonly readIndependentLegacy?: ReadIndependentWarpKey;
}) {
  const archive = createWarpArchive(directory, lockFile);
  const settings = createWarpSettingsStore(lockFile, directory);
  const independentSettings = createIndependentWarpSettingsStore(lockFile, directory);
  const drawIndependent = createIndependentWarpDraw(lockFile, directory, readIndependentLegacy, signal);
  const readPersonalPool = createPersonalWarpPoolReader(directory, lockFile);

  return async (message: string, context: WarpContext): Promise<CommandReply | undefined> => {
    if (signal.aborted) return;
    if (help.test(message)) return [
      $t("simulation.commands.text_739afb8575"),
      $t("simulation.commands.text_d7bae78bff"),
      $t("simulation.commands.text_645cd02395"),
      $t("simulation.commands.text_eb8455783a"),
      $t("simulation.commands.text_5f6c2e793d"),
    ].join("\n");
    const draw = parseWarpCommand(message);
    const administration = parseWarpAdministration(message);
    const relife = reincarnation.test(message);
    if (!draw && !administration && !relife && !ticketCommand.test(message)) return;
    if (draw && context.isDelegated) return $t("simulation.commands.text_a3c23d995a");
    if (!integer(context.user_id) || context.user_id === 0) return $t("simulation.commands.text_0a66420010");
    const user = context.user_id;
    const qq = String(user);
    const group = integer(context.group_id) && context.group_id > 0 ? String(context.group_id) : undefined;
    const conversationKey = group ?? "private";
    const isOwner = () => context.isMaster === true && !context.isDelegated && (!context.isBotMaster || context.isBotMaster(user));
    const time = now();
    const day = warpDay(time);
    try {
      if (administration) {
        if (!isOwner()) return $t("simulation.commands.text_90db1fee7c");
        return await runWarpAdministration(administration, { settings, group, random, verifyOwner: async () => {
          signal.throwIfAborted();
          if (!isOwner()) throw new RangeError($t("simulation.commands.text_c09e0c00a9"));
        } });
      }
      const compatibility = independentDraw.test(message) ? await independentSettings.read() : undefined;
      const independent = compatibility?.enabled ? compatibility : undefined;
      const rules = independent ? defaultWarpSettings() : await settings.read();
      signal.throwIfAborted();
      if (relife) {
        if (context.isDelegated) return $t("simulation.commands.text_05627312ed");
        const gate = await lockWarpReincarnation(directory, qq, lockFile);
        try {
          signal.throwIfAborted();
          const account = readWarpAccount(await archive.read(qq, "1"));
          const remaining = (account.reincarnatedUntil ?? 0) - now();
          if (!isOwner() && remaining > 0) {
            return $t("simulation.commands.text_6489501219", { "value1": Math.ceil(remaining / 60_000) });
          }
          const identityCatalog = await readIdentityCatalog();
          const { name, path, allegiance, description } = pickWarpIdentity(identityCatalog, random);
          const sender = context.sender?.nickname;
          const nickname = (typeof sender === "string"
            ? [...sender.replace(/\p{Cc}/gu, "").trim()].slice(0, 32).join("") : "") || $t("simulation.commands.text_865ee04ffd");
          let png: Uint8Array;
          try {
            const avatar = await loadAvatar(qq, signal);
            signal.throwIfAborted();
            ({ png } = await renderReincarnation({ name, path, nickname, qq, allegiance, description, avatar,
              colors: identityCatalog.colors, inlineImageByteLimit: context.inlineImageByteLimit }));
            if (!png.length) throw new Error($t("simulation.commands.text_43ffe857d2"));
          } catch {
            if (signal.aborted) return;
            const title = $t("simulation.commands.text_9a19896b7b", { "nickname": nickname, "name": name, "value3": path ? ` · ${path}` : "" });
            return description ? $t("simulation.commands.text_104559d799", { "title": title, "description": description }) : title;
          }
          signal.throwIfAborted();
          const until = now() + rules.reincarnationMinutes * 60_000;
          await archive.update({ qq, uid: "1" }, async () => signal.throwIfAborted(), raw => {
            const current = readWarpAccount(raw);
            current.reincarnatedUntil = until;
            return { document: current, result: undefined };
          });
          if (!signal.aborted) return { type: "image", file: png };
          return;
        } finally {
          gate.close();
        }
      }
      if (independent) {
        if (group && independent.disabledGroups.includes(group)) return $t("simulation.commands.text_f1a56d05d0");
        if (!(group ? independent.group : independent.private)) return;
      } else if (!rules.enabled) return $t("simulation.commands.text_79ba205298");
      if (draw && draw.count > 10 && !rules.multiple) return $t("simulation.commands.text_75ac8d7e86");
      const allowance = readWarpAllowance(rules, group);
      if (independent) allowance.recallSeconds = independent.recallSeconds;
      const customNames = draw?.kind === "cone" ? rules.poolNames.coneFive : rules.poolNames.characterFive;
      const collaboration = draw && isCollaborationWarp(draw.kind) ? draw.kind : undefined;
      const manual = !independent && draw && !collaboration && draw.kind !== "standard" && !rules.automaticPools && customNames?.[draw.slot - 1];
      const personal = !independent && draw && (draw.kind === "character" || draw.kind === "cone") && draw.slot <= 2
        ? personalWarpPool(draw.kind, draw.slot, await readPersonalPool(qq, time)) : undefined;
      const source = draw && !personal ? await poolSource(draw.kind, draw.slot, time).catch(error => {
        if (!manual) throw error;
        return undefined;
      }) : undefined;
      const pool = personal ?? (draw && (independent ? source : customWarpPool(draw.kind, draw.slot, source, rules)));
      if (draw && !pool) return collaboration ? $t("simulation.commands.text_d1ed574ed7") : $t("simulation.commands.text_80d0d003b9");
      const result: WarpResult = independent && pool
        ? await drawIndependent({ qq, group, time, now, pool, isOwner, rules: independent, random })
        : await archive.update<WarpResult>({ qq, uid: "1" }, async () => signal.throwIfAborted(), (raw) => {
        const account = readWarpAccount(raw);
        const issued = account.balance.day !== day || (account.balance.expiresAt !== undefined && time >= account.balance.expiresAt);
        if (issued) account.balance = { day, special: allowance.special, regular: allowance.regular };
        const balance = account.balance;
        if (!draw || !pool) {
          const result = { text: $t("simulation.commands.text_e97c5c3c2a", { "special": balance.special, "regular": balance.regular }),
            issued: issued ? allowance : undefined };
          return issued ? { document: account, result } : { result };
        }
        const ticket = pool.kind === "standard" ? "regular" : "special";
        if (balance[ticket] < draw.count) {
          const conversation = account.conversations[conversationKey];
          const today = conversation?.today?.day === day ? conversation.today : undefined;
          const week = !collaboration && conversation?.week?.id === warpWeek(time) ? conversation.week.five : 0;
          const collaborationToday = collaboration ? today?.collaboration?.[collaboration] : undefined;
          const summary = collaboration ? collaborationToday : today;
          const total = collaboration ? collaborationToday?.draws : pool.kind === "cone" ? today?.cone : today?.standardAndCharacter;
          const recent = summary?.five ? $t("simulation.commands.text_afd4475561", { "value1": summary.five >= 8 ? $t("simulation.commands.text_6366d63a0b", { "five": summary.five }) : summary.samples.map(item => $t("simulation.commands.text_155b5f569f", { "name": item.name, "pity": item.pity })).join("、") })
            : $t("simulation.commands.text_0db238d073", { "value1": total ?? 0 });
          const result = {
            text: $t("simulation.commands.text_af4db76fc4", { "value1": ticket === "regular" ? $t("simulation.commands.text_84ea96c30c") : $t("simulation.commands.text_ef93976688"), "count": draw.count, "value3": balance[ticket] }),
            summary: draw.count > 1 ? `${recent}${week >= 2 ? $t("simulation.commands.text_7af3a650d0", { "week": week }) : ""}` : undefined,
            issued: issued ? allowance : undefined,
          };
          return issued ? { document: account, result } : { result };
        }
        balance[ticket] = isOwner() ? Math.min(Number.MAX_SAFE_INTEGER, balance[ticket] + draw.count) : balance[ticket] - draw.count;
        delete balance.expiresAt;
        for (const [key, conversation] of Object.entries(account.conversations)) {
          const expired = conversation.expiresAt === undefined ? day - conversation.lastDay >= warpRetentionDays : time >= conversation.expiresAt;
          if (expired) delete account.conversations[key];
        }
        const conversation: WarpConversation = account.conversations[conversationKey] ?? {
          lastDay: day, pity: { character: emptyPity(), cone: emptyPity(), standard: emptyPity() },
        };
        conversation.lastDay = day;
        delete conversation.expiresAt;
        account.conversations[conversationKey] = conversation;
        const weekId = warpWeek(time);
        if (!collaboration && conversation.week?.id !== weekId) conversation.week = { id: weekId, five: 0 };
        if (conversation.today?.day !== day) conversation.today = { day, standardAndCharacter: 0, cone: 0, five: 0, samples: [] };
        const today = conversation.today;
        const collaborationToday = collaboration
          ? ((today.collaboration ??= {})[collaboration] ??= { draws: 0, five: 0, samples: [] }) : undefined;
        if (collaborationToday) {
          collaborationToday.draws = Math.min(Number.MAX_SAFE_INTEGER, collaborationToday.draws + draw.count);
        } else {
          const metric = pool.kind === "cone" ? "cone" : "standardAndCharacter";
          today[metric] = Math.min(Number.MAX_SAFE_INTEGER, today[metric] + draw.count);
        }
        const pity = conversation.pity[pool.kind] ??= emptyPity();
        const pulls = simulateWarps(pool, pity, draw.count, random, rules.rates, collaboration ? undefined : conversation.week, rules.weeklyBonus);
        const summary = collaborationToday ?? today;
        for (const pull of pulls) {
          if (pull.rarity !== 5) continue;
          summary.five = Math.min(Number.MAX_SAFE_INTEGER, summary.five + 1);
          if (summary.samples.length < 7) summary.samples.push({ name: pull.name, pity: pull.pity! });
        }
        return { document: account, result: { pulls, pity: pity.fiveMisses, issued: issued ? allowance : undefined } };
      });
      if (signal.aborted) return;
      if (result.issued && context.reply) {
        await context.reply($t("simulation.commands.text_7d33c08deb", { "special": result.issued.special, "regular": result.issued.regular }));
        if (signal.aborted) return;
      }
      if ("text" in result) {
        if (!result.summary) return result.text;
        if (!context.reply) return recallResult(`${result.text}\n${result.summary}`, allowance.recallSeconds);
        await context.reply(result.text);
        if (signal.aborted) return;
        return recallResult(result.summary, allowance.recallSeconds);
      }
      if (!pool || signal.aborted) return;
      const five = result.pulls.filter(item => item.rarity === 5).length;
      const four = result.pulls.filter(item => item.rarity === 4).length;
      const count = result.pulls.length;
      const shouldRetain = independent ? five >= 1
        : count === 10 ? five >= 1 || four >= 4 : count > 10 && (five >= 2 || four >= 25);
      const recallSeconds = shouldRetain ? 0 : allowance.recallSeconds;
      const intro = $t("simulation.commands.text_f032fa644e", { "title": pool.title, "count": count, "five": five, "four": four, "pity": result.pity });
      const sourceName = context.sender?.nickname;
      const nickname = typeof sourceName === "string" ? [...sourceName.replace(/\p{Cc}/gu, "").trim()].slice(0, 32).join("") : "";
      const nodes: Reply[] = [intro];
      for (let start = 0; start < result.pulls.length; start += 10) {
        if (signal.aborted) return;
        const pulls = result.pulls.slice(start, start + 10);
        try {
          const image = await render({ title: pool.title, nickname: nickname || $t("simulation.commands.text_865ee04ffd"), pity: result.pity, pulls, page: start / 10 + 1,
            pages: Math.ceil(result.pulls.length / 10), inlineImageByteLimit: context.inlineImageByteLimit });
          nodes.push({ type: "image", file: image.png });
        } catch {
          nodes.push(pulls.map(format).join("\n"));
        }
      }
      if (signal.aborted) return;
      if (nodes.length === 2) return recallResult(typeof nodes[1] === "string" ? `${intro}\n${nodes[1]}` : nodes[1]!, recallSeconds);
      if (context.reply && (!group || nodes.length <= 4)) {
        const options = recallSeconds ? { recallMsg: recallSeconds, recallOriginal: false } as const : undefined;
        for (const [index, node] of nodes.slice(1).entries()) {
          if (index > 0) await pause(500, undefined, { signal });
          if (signal.aborted) return;
          if (options) await context.reply(node, false, options);
          else await context.reply(node);
        }
        return [];
      }
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
      if (!signal.aborted) return $t("simulation.commands.text_b23a6f1701");
    }
  };
}
