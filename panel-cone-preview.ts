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
    return { error: `「${target.name}」缺少能确认光锥等级和稀有度的当前配装。` };
  }
  const rank = replacement.star === 5 && previousStar !== 5 ? 1 : previous.rank || 5;
  const cone = { id: replacement.id, name: replacement.name, level: previous.level, promote: previous.promote,
    rank, image: "", description: "" };
  return { avatar: { ...target, cone, stats: [] }, label: `临时光锥 · ${cone.name} · Lv.${cone.level} · 叠影${rank}阶` };
}
