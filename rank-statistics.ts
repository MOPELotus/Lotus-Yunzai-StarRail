import { characterAliasKey, readGameCharacterAliases } from "../../lib/game-character-aliases.ts";
import { fetchRankStats, rankPercentiles } from "../../lib/rank-statistics.ts";
import { renderDamageRankStatsCard } from "../../packages/skia/rank-stats-card.ts";
import characterNames from "./challenge-character-names.json";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { abbr, alias } from "./panel-theme/character-alias.ts";

const normalize = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[·・•\s]/gu, "");
const aliases: Readonly<Record<string, string>> = alias;
const shortNames: Readonly<Record<string, string>> = abbr;
const characters = Object.entries(characterNames).map(([id, name]) => ({ id: Number(id), name }));

const rankStatsName = (message: string) => /^(?:#(?:星铁)?|\*)([^#]{1,40}?)\s*排名统计$/u.exec(message)?.[1];

export function matchStarRailRankStats(message: string) {
  const requested = rankStatsName(message);
  if (requested) return findStarRailRankCharacter(requested);
}

export function findStarRailRankCharacter(name: string) {
  const key = normalize(name);
  if (!key) return;
  const exact = characters.filter(({ id, name }) => String(id) === key || normalize(name) === key);
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  const matches = characters.filter(({ name }) => [shortNames[name], ...(aliases[name] ?? "").split(",")]
    .some(entry => entry && normalize(entry) === key));
  if (matches.length === 1) return matches[0];
}

export async function queryStarRailRankStats(message: string, signal: AbortSignal) {
  const name = rankStatsName(message);
  if (!name || signal.aborted) return;
  const character = findStarRailRankCharacter(name) ??
    findStarRailRankCharacter((await readGameCharacterAliases("sr")).get(characterAliasKey(name)) ?? "");
  if (!character || signal.aborted) return;
  const result = await fetchRankStats(character.id, signal);
  if (signal.aborted) return;
  if ("message" in result) return result.message;
  try {
    const theme = starRailGachaThemeDirectory();
    const rankTheme = Bun.env.LOTUS_STAR_RAIL_RANK_THEME_DIR?.trim() || Bun.env.LOTUS_STAR_RAIL_ARK_THEME_DIR?.trim();
    const { png } = await renderDamageRankStatsCard("sr", character.name, result.stats, {
      footer: "Lotus-Yunzai · StarRail", themeDirectories: rankTheme ? [rankTheme, theme] : [theme],
    });
    if (!signal.aborted) return { type: "image" as const, file: png };
  } catch {
    if (!signal.aborted) {
      const { title, total, scores } = result.stats;
      return [`${character.name} · 排名趋势 · ${title} · ${total} 个样本`,
        ...scores.map((damage, index) => `TOP ${rankPercentiles[index]}% · ${damage}`)].join("\n");
    }
  }
}
