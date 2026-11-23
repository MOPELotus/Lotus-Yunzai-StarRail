import { readFile } from "node:fs/promises";
import { MAX_PROFILE_ID, type createProfileStore } from "@lotus-yunzai/account";
import type { CommandReply, MessageFallbackContext } from "../../lib/commands.ts";
import { isStarRailPanelPhoto, readStarRailPanelPhoto, type StarRailPanelPhoto } from "./panel-card.ts";
import { matchesStarRailTraceOwner, starRailTraceOwner, type StarRailTraceOwner } from "./panel-trace-refresh.ts";

const lifetime = 3600;
const capacity = 1024;
const configRoot = new URL("../../", import.meta.url);
const legacySettings = ["plugins/StarRail-plugin/config/PanelSetting.yaml", "backup/plugins/StarRail-plugin/config/PanelSetting.yaml"];
type Context = Partial<Pick<MessageFallbackContext, "self_id" | "user_id" | "group_id" | "isDelegated" |
  "reply_id" | "message" | "lookupReply" | "privateCredentialSignal" | "groupOriginalSignal" | "inlineImageByteLimit" | "isBotMaster">> & {
    readonly adapter?: string;
    readonly message_type?: string;
  };
type Binding = StarRailTraceOwner & { readonly profileId: number };
type Receipt = { readonly binding: Binding; readonly photo: StarRailPanelPhoto; readonly expiresAt: number };
type Storage = { get(key: string): Promise<unknown>; set(key: string, value: string, seconds: number): Promise<unknown> };

export function starRailOriginalCommand(message: string) {
  if (/^(?:\*|#星铁)原图$/u.test(message)) return "explicit";
  if (/^#?原图$/u.test(message)) return "shared";
}

function positive(value: number | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function key(context: Context, id: string | number | undefined) {
  const { adapter = "onebot", self_id: bot, user_id: user, message_type: chat, group_id: group } = context;
  if (context.isDelegated || !positive(bot) || !positive(user) || (adapter !== "onebot" && adapter !== "milky") ||
      (chat !== "group" && chat !== "private")) return;
  const peer = chat === "group" ? group : user;
  const number = typeof id === "string" && /^-?(?:0|[1-9]\d{0,15})$/u.test(id) ? Number(id) : id;
  if (!positive(peer) || typeof number !== "number" || !Number.isSafeInteger(number) ||
      (adapter === "onebot" ? number === 0 || number < -2_147_483_648 || number > 2_147_483_647 : number < 0)) return;
  return `lotus-yunzai:starrail-panel-original:${adapter}:${bot}:${chat}:${peer}:${user}:${number}`;
}

function validReceipt(receipt: Partial<Receipt> | undefined, now: number) {
  return receipt?.binding && positive(receipt.binding.profileId) && receipt.binding.profileId <= MAX_PROFILE_ID &&
    typeof receipt.expiresAt === "number" && receipt.expiresAt > now && receipt.expiresAt <= now + lifetime * 1000 &&
    isStarRailPanelPhoto(receipt.photo);
}

async function settings(root: URL) {
  for (const path of legacySettings) {
    try {
      const config = Bun.YAML.parse(await readFile(new URL(path, root), "utf8")) as
        { originalPic?: unknown; backCalloriginalPic?: unknown; backCalloriginalPicTime?: unknown } | undefined;
      const value = config?.backCalloriginalPicTime;
      const time = typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 120 ? value : 30;
      return { enabled: config?.originalPic !== false, seconds: config?.backCalloriginalPic === false ? 0 : time };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") break;
    }
  }
  return { enabled: true, seconds: 30 };
}

export function createStarRailPanelOriginals(profiles: Pick<ReturnType<typeof createProfileStore>, "requestContext" | "savedRole">,
  lifecycle: AbortSignal, { root = configRoot, now = Date.now, readPicture = readStarRailPanelPhoto, storage }: {
    readonly root?: URL;
    readonly now?: () => number;
    readonly readPicture?: (photo: StarRailPanelPhoto, signal: AbortSignal) => Promise<Uint8Array | undefined>;
    readonly storage?: Storage;
  } = {}) {
  const recent = new Map<string, Receipt>();

  function remember(location: string, receipt: Receipt) {
    recent.delete(location);
    recent.set(location, receipt);
    if (recent.size > capacity) recent.delete(recent.keys().next().value!);
  }

  async function receive(location: string) {
    const cached = recent.get(location);
    if (cached && validReceipt(cached, now())) return cached;
    recent.delete(location);
    try {
      const raw = await storage?.get(location);
      if (typeof raw !== "string" || Buffer.byteLength(raw) > 2048) return;
      const receipt = JSON.parse(raw) as Receipt | undefined;
      if (receipt && validReceipt(receipt, now())) {
        remember(location, receipt);
        return receipt;
      }
    } catch {}
  }

  return {
    async delivered(context: Context, confirmed: number, binding: Binding, photo: StarRailPanelPhoto) {
      const location = key(context, confirmed);
      if (!location || lifecycle.aborted || String(context.user_id) !== binding.qq || !isStarRailPanelPhoto(photo)) return;
      const receipt = { binding, photo, expiresAt: now() + lifetime * 1000 };
      remember(location, receipt);
      await storage?.set(location, JSON.stringify(receipt), lifetime).catch(() => undefined);
    },
    async reply(context: Context): Promise<CommandReply | undefined> {
      const session = context.message_type === "group" ? context.groupOriginalSignal : context.privateCredentialSignal;
      if (!session || session.aborted || lifecycle.aborted || !context.lookupReply) return;
      const active = AbortSignal.any([lifecycle, session]);
      const location = key(context, context.reply_id);
      const references = Array.isArray(context.message) ? context.message.filter(part => part.type === "reply") : [];
      if (!location || references.length !== 1 || String(references[0]?.id) !== String(context.reply_id)) return;
      try {
        const receipt = await receive(location);
        if (!receipt || active.aborted || receipt.binding.qq !== String(context.user_id)) return;
        const quote = await context.lookupReply();
        if (!quote || quote.user_id !== context.self_id || quote.message.filter(part => part.type === "image").length !== 1) return;
        const config = await settings(root);
        if (!config.enabled && context.isBotMaster?.(context.user_id!) !== true) return "星铁原图功能已关闭。";
        const { binding } = receipt;
        async function stillOwned() {
          active.throwIfAborted();
          const role = await profiles.savedRole(binding.qq, binding.profileId, "sr");
          const account = await profiles.requestContext(binding.qq, binding.profileId, "sr");
          const owner = starRailTraceOwner(account, role);
          return !active.aborted && owner && matchesStarRailTraceOwner(owner, binding);
        }
        if (!await stillOwned()) return;
        const file = await readPicture(receipt.photo, active);
        if (!file || !await stillOwned()) return;
        if (context.inlineImageByteLimit !== undefined && file.byteLength > context.inlineImageByteLimit) return "星铁面板原图超过当前会话的图片大小上限。";
        const message = { type: "image", file } as const;
        return config.seconds ? { type: "recallable", message, seconds: config.seconds } : message;
      } catch { return; }
    },
  };
}
