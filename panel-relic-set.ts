// Alias and slot semantics follow the fixed MIT ProfileChange.js and meta-sr/artifact/index.js.
import aliases from "./panel-relic-set-aliases.json";
import type { PanelAvatar } from "./panel-model.ts";

const setAliases: Readonly<Record<string, string>> = aliases;
const setNames = Object.keys(setAliases).sort((a, b) => b.length - a.length)
  .map(name => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
const setPattern = new RegExp(`^(${setNames})套?[24]?(?:\\+?(${setNames})套?[24]?)?(?:\\+?(${setNames})套?[24]?)?$`, "u");

export function readRelicSetNames(request: string) {
  const match = setPattern.exec(request.toLowerCase());
  return match?.slice(1).flatMap(name => name ? [setAliases[name]!] : []);
}

type SetPiece = { id: string; name: string };
export type PanelRelicSets = ReadonlyMap<string, { outer: boolean; pieces: ReadonlyMap<string, SetPiece> }>;

export function changePanelRelicSets(
  target: PanelAvatar, names: readonly string[], sets: PanelRelicSets,
): { avatar: PanelAvatar; label: string } | { error: string } {
  const outer: string[] = [];
  const planar: string[] = [];
  for (const name of names) {
    const set = sets.get(name);
    if (!set) return { error: `本地主题缺少「${name}」的遗器套装资料。` };
    (set.outer ? outer : planar).push(name);
  }
  if (outer.length > 2 || planar.length > 1) return { error: "可选择最多两套外圈遗器和一套位面饰品。" };

  let applied = false;
  const relics: PanelAvatar["relics"] = [];
  for (const part of target.relics) {
    const set = part.slot <= 2 ? outer[0] : part.slot <= 4 ? outer[1] ?? outer[0] : planar[0];
    if (!set) {
      relics.push(part);
      continue;
    }
    const piece = sets.get(set)?.pieces.get(`${part.slot}:${part.rarity}`);
    if (!piece) return { error: `「${set}」缺少该部位与星级的遗器资料。` };
    relics.push({ ...part, ...piece, image: "" });
    applied = true;
  }
  if (!applied) return { error: `「${target.name}」没有可替换的对应遗器部位。` };
  const label = `临时套装 · ${names.join("、")}`;
  return { avatar: { ...target, relics, stats: [] }, label };
}
