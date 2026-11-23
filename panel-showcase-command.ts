import { saveStarRailShowcaseServer } from "../../lib/panel-game-settings.ts";
import type { MessageFallbackContext } from "../../lib/commands.ts";
import { readShowcaseServer } from "./panel-showcase-config.ts";
import { showcaseProviderNames, showcaseServerCode } from "./panel-showcase.ts";

const apiListCommand = /^(?:\*|#星铁)\s*API列表$/iu;
const apiChangeCommand = /^(?:\*|#星铁)\s*(?:设置|切换)面板\s*(?:(API|来源)\s*(.*)|([0-9]+))?$/iu;
const providers = new Map([["mihomo", "0"], ["avocado", "3"], ["enka", "4"], ["enkahsr", "4"]]);
const usage = "可发送 *切换面板API Mihomo、Avocado 或 EnkaHSR，或发送 *切换面板来源 034 按官服、渠道服、国际服分别设置。";

export function matchStarRailShowcaseSettings(message: string) {
  if (apiListCommand.test(message)) return { action: "list" } as const;
  const match = apiChangeCommand.exec(message);
  if (match) return { action: "change", selector: match[1] === "来源", argument: (match[2] ?? match[3] ?? "").trim() } as const;
}

type SettingsCommand = NonNullable<ReturnType<typeof matchStarRailShowcaseSettings>>;
type Context = Partial<Pick<MessageFallbackContext, "canManagePackages" | "group_id" | "groupActivitySignal" | "isDelegated" |
  "privateCredentialSignal" | "self_id" | "user_id">> & { readonly message_type?: string };

function sourceSummary(selection: string) {
  return ["官服", "渠道服", "国际服"].map((label, index) => {
    const code = selection[index] ?? selection[0]!;
    const provider = showcaseServerCode(code);
    return `${label}：${provider ? showcaseProviderNames[provider] : "旧私有 Token 服务（请重新设置）"}`;
  }).join("\n");
}

function positiveId(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export async function runStarRailShowcaseSettings(command: SettingsCommand, context: Context, lifecycle: AbortSignal,
  root = new URL("../../", import.meta.url)) {
  const connection = context.message_type === "group" && positiveId(context.group_id) ? context.groupActivitySignal :
    context.message_type === "private" ? context.privateCredentialSignal : undefined;
  const authorized = () => context.canManagePackages === true && !context.isDelegated && positiveId(context.self_id) &&
    positiveId(context.user_id) && !lifecycle.aborted && connection?.aborted === false;
  if (!authorized() || !connection) return "仅限机器人主人在已连接的会话查看或切换星铁面板 API。";
  const signal = AbortSignal.any([lifecycle, connection]);
  const overridden = () => !!Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER?.trim();
  try {
    if (command.action === "list") {
      const selected = await readShowcaseServer(root);
      if (!authorized()) return [];
      return `星铁公开面板 API\n0 或 2：Mihomo\n3：Avocado\n4：EnkaHSR\n\n当前来源\n${sourceSummary(selected)}\n\n${overridden() ? "来源由部署环境变量指定。" : usage}`;
    }
    if (overridden()) return "星铁公开面板来源由部署环境变量指定，请在部署配置中修改。";
    const value = command.selector && /^[0234]{1,3}$/u.test(command.argument) ? command.argument :
      providers.get(command.argument.toLowerCase());
    if (!value) {
      if (!command.selector && /^[1-9]\d*$/u.test(command.argument)) {
        return `旧 API 编号对应旧插件各自配置的地址，已停用。${usage}`;
      }
      return usage;
    }
    await saveStarRailShowcaseServer(root, value, signal, authorized);
    return authorized() ? `已保存星铁公开面板来源。\n${sourceSummary(value)}` : [];
  } catch {
    return authorized() ? "星铁公开面板来源配置读取或保存失败，请检查管理面板的展柜设置。" : [];
  }
}
