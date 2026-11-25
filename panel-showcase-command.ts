import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { saveStarRailShowcaseServer } from "../../lib/panel-game-settings.ts";
import type { MessageFallbackContext } from "../../lib/commands.ts";
import { readShowcaseServer } from "./panel-showcase-config.ts";
import { showcaseProviderNames, showcaseServerCode } from "./panel-showcase.ts";

const apiListCommand = /^(?:\*|#星铁)\s*API列表$/iu;
const apiChangeCommand = /^(?:\*|#星铁)\s*(?:设置|切换)面板\s*(?:(API|来源)\s*(.*)|([0-9]+))?$/iu;
const providers = new Map([["mihomo", "0"], ["avocado", "3"], ["enka", "4"], ["enkahsr", "4"]]);
const usage = $t("panel-showcase-command.text_c9cad52751");

export function matchStarRailShowcaseSettings(message: string) {
  if (apiListCommand.test(message)) return { action: "list" } as const;
  const match = apiChangeCommand.exec(message);
  if (match) return { action: "change", selector: match[1] === "来源", argument: (match[2] ?? match[3] ?? "").trim() } as const;
}

type SettingsCommand = NonNullable<ReturnType<typeof matchStarRailShowcaseSettings>>;
type Context = Partial<Pick<MessageFallbackContext, "canManagePackages" | "group_id" | "groupActivitySignal" | "isDelegated" |
  "privateCredentialSignal" | "self_id" | "user_id">> & { readonly message_type?: string };

function sourceSummary(selection: string) {
  return [$t("panel-showcase-command.text_f021b69823"), $t("panel-showcase-command.text_d526ff7388"), $t("panel-showcase-command.text_970d688dd6")].map((label, index) => {
    const code = selection[index] ?? selection[0]!;
    const provider = showcaseServerCode(code);
    return `${label}：${provider ? showcaseProviderNames[provider] : $t("panel-showcase-command.text_d41d334973")}`;
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
  if (!authorized() || !connection) return $t("panel-showcase-command.text_8540a9a432");
  const signal = AbortSignal.any([lifecycle, connection]);
  const overridden = () => !!Bun.env.LOTUS_STAR_RAIL_SHOWCASE_SERVER?.trim();
  try {
    if (command.action === "list") {
      const selected = await readShowcaseServer(root);
      if (!authorized()) return [];
      return $t("panel-showcase-command.text_924712b1f1", { "value1": sourceSummary(selected), "value2": overridden() ? $t("panel-showcase-command.text_2c773bbe27") : usage });
    }
    if (overridden()) return $t("panel-showcase-command.text_ac26d95ecd");
    const value = command.selector && /^[0234]{1,3}$/u.test(command.argument) ? command.argument :
      providers.get(command.argument.toLowerCase());
    if (!value) {
      if (!command.selector && /^[1-9]\d*$/u.test(command.argument)) {
        return $t("panel-showcase-command.text_cd9ab40147", { "usage": usage });
      }
      return usage;
    }
    await saveStarRailShowcaseServer(root, value, signal, authorized);
    return authorized() ? $t("panel-showcase-command.text_0899ad51c1", { "value1": sourceSummary(value) }) : [];
  } catch {
    return authorized() ? $t("panel-showcase-command.text_e33963106f") : [];
  }
}
