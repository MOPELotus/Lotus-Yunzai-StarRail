import { arkPublicUid } from "../../lib/ark-custom-rank.ts";
import { arkCustomRankGrade, createArkRankCommand } from "../../lib/ark-custom-rank-command.ts";
import { renderStarRailRelicRank, type RelicRankRow } from "./group-relic-rank-card.ts";
import { makePanelDetailCard, readPanelRankAvatar, readTheme } from "./panel-card.ts";
import { renderStarRailPanelDetail } from "./panel-detail-skia.ts";
import { object, readLegacyPanel, type PanelAvatar } from "./panel-model.ts";
import { resolveStarRailCharacter } from "./rank-statistics.ts";

export function readStarRailRankingPanel(value: unknown, uid: string, character: { id: number; name: string }) {
  const source = object(value);
  if (!source || arkPublicUid(source.uid) !== uid) return;
  const key = String(character.id);
  const avatars = source.avatars;
  const row = Array.isArray(avatars) ? avatars.map(object).find(entry => String(entry?.id) === key) : object(object(avatars)?.[key]);
  if (!row || String(row.id) !== key) return;
  // The ordinary legacy importer needs a numeric UID. The temporary view only displays the public value.
  const parserUid = "100000000";
  const snapshot = readLegacyPanel(parserUid, { uid: parserUid, _profile: source._profile, avatars: { [key]: { ...row, name: character.name } } });
  return { ...snapshot, uid };
}

export function createStarRailCustomRank(signal: AbortSignal) {
  return createArkRankCommand("sr", signal, {
    resolveCharacter: resolveStarRailCharacter,
    async renderRank(character, { title, metric, filters, count, rows }, context) {
      const theme = await readTheme();
      const views = await Promise.all(rows.map(async (row): Promise<RelicRankRow> => {
        const avatar: PanelAvatar = {
          id: String(character.id), name: character.name, rank: row.cons, level: row.level,
          element: "", path: "", face: "", splash: "", traces: [], stars: [], stats: [], relics: [],
          skills: Object.entries(row.talent).filter(([, level]) => level > 0).map(([key, level]) => ({ key, level, icon: "" })),
          cone: row.weaponId ? { id: String(row.weaponId), name: row.weaponName ?? "", image: "", description: "",
            rank: row.weaponRefinement, level: row.weaponLevel } : undefined,
        };
        const original = await readPanelRankAvatar(avatar, theme, row.sets);
        const score = row.score === undefined ? undefined : { score: row.score, grade: arkCustomRankGrade(row.score, "sr") };
        const presentation = { ...original, damage: row.damage === undefined ? undefined : { title, value: row.damage.toFixed(1) } };
        return {
          uid: row.uid, characterId: avatar.id, characterName: character.name, presentation, score: row.score ?? 0, grade: score?.grade ?? "",
          relicMark: score, metric: metric === "damage" ? "damage" : "mark",
        };
      }));
      const { png } = await renderStarRailRelicRank(character, views, "auto", context.inlineImageByteLimit, undefined,
        metric === "damage" ? "damage" : "mark", undefined, { filters, count });
      return { type: "image", file: png };
    },
    async renderPanel(character, uid, response, context) {
      const snapshot = readStarRailRankingPanel(response, uid, character);
      const avatar = snapshot?.avatars.find(row => row.id === String(character.id));
      if (!snapshot || !avatar || signal.aborted) return;
      const theme = await readTheme();
      const model = await makePanelDetailCard(snapshot, avatar, theme, signal, { localOnly: true, sourceLabel: "全服排行公开面板" });
      if (signal.aborted) return;
      const { png } = await renderStarRailPanelDetail(model, theme.root, "auto", context.inlineImageByteLimit);
      return { type: "image", file: png };
    },
  });
}
