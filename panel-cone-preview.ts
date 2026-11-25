import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
// Named cone defaults follow ProfileChange.js and the fixed weapon metadata.
import type { PanelAvatar } from "./panel-model.ts";
import aliases from "./panel-cone-aliases.json";

const coneAliases: Readonly<Record<string, string>> = aliases;

export function readNamedCone(request: string) {
  const name = request.toLowerCase();
  return Object.hasOwn(coneAliases, name) ? coneAliases[name] : undefined;
}

export function changePanelNamedCone(
  target: PanelAvatar, replacement: { id: string; name: string; star: number }, previousStar: number | undefined,
): { avatar: PanelAvatar; label: string } | { error: string } {
  const previous = target.cone;
  if (!previous?.level || previousStar === undefined) {
    return { error: $t("panel-cone-preview.text_7ad1feebb7", { "name": target.name }) };
  }
  const rank = replacement.star === 5 && previousStar !== 5 ? 1 : previous.rank || 5;
  const cone = { id: replacement.id, name: replacement.name, level: previous.level, promote: previous.promote,
    rank, image: "", description: "" };
  return { avatar: { ...target, cone, stats: [] }, label: $t("panel-cone-preview.text_a2cbefb82f", { "name": cone.name, "level": cone.level, "rank": rank }) };
}
