import { id, isStarRailTalentUnlocks, object, recoverStarRailSkillLevel, safeArt, type PanelSnapshot } from "./panel-model.ts";

function scalarFields(value: unknown, names: readonly string[]) {
  const row = object(value);
  if (!row) return;
  return Object.fromEntries(names.flatMap(key => {
    const item = row[key];
    return typeof item === "string" || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item)) ? [[key, item]] : [];
  }));
}

function mapLegacyRelics(value: unknown) {
  const relics = object(value);
  if (!relics) return;
  return Object.fromEntries(Object.entries(relics).flatMap(([slot, value]) => {
    const row = object(value);
    if (!/^[1-6]$/u.test(slot) || !row || !id(row.id)) return [];
    return [[slot, { ...scalarFields(row, ["id", "level", "star", "mainId"]), attrIds: Array.isArray(row.attrIds)
      ? row.attrIds.filter(item => typeof item === "string" && /^\d{1,6},\d{1,3},-?\d{1,3}$/u.test(item)) : undefined }]];
  }));
}

function legacyDocument(snapshot: PanelSnapshot, raw: Record<string, unknown>, talentCons?: ReadonlyMap<string, Record<string, unknown>>) {
  let unresolved = 0;
  const storedAvatars = object(raw.avatars) ?? {};
  const avatars = Object.fromEntries(snapshot.avatars.map(avatar => {
    const row = object(storedAvatars[avatar.id]) ?? {};
    let talent = scalarFields(row.talent, ["a", "e", "q", "t", "z", "xe", "me", "mt"]);
    for (const skill of avatar.skills) {
      if (!skill.effective || !["a", "e", "q", "t"].includes(skill.key)) continue;
      const unlocks = talentCons?.get(avatar.id)?.[skill.key];
      const rank = avatar.rank;
      // Testing the inverse at rank zero rejects levels saturated by an active bonus.
      const original = rank !== undefined && (rank === 0 || isStarRailTalentUnlocks(unlocks))
        ? recoverStarRailSkillLevel(skill.key, skill.level, rank, 0, unlocks)
        : undefined;
      if (original === undefined) {
        unresolved++;
        continue;
      }
      (talent ??= {})[skill.key] = original;
    }
    return [avatar.id, {
      ...scalarFields(row, ["name", "id", "elem", "level", "promote", "cons", "_source", "_time", "_update", "_talent"]),
      talent,
      trees: Array.isArray(row.trees) ? row.trees.filter(tree => id(tree)) : undefined,
      weapon: scalarFields(row.weapon, ["id", "level", "promote", "affix"]),
      artis: mapLegacyRelics(row.artis), mysArtis: mapLegacyRelics(row.mysArtis),
    }];
  }));
  return { document: { uid: snapshot.uid, ...scalarFields(raw, ["_profile"]), avatars }, unresolved };
}

const avatarKeys = ["id", "name", "element", "path", "level", "rank", "rarity"];
const statKeys = ["key", "value", "base", "times"];

const publicArt = (value: unknown) => safeArt(value, false);

function managedDocument(snapshot: PanelSnapshot) {
  return {
    version: snapshot.version, uid: snapshot.uid, source: snapshot.source, updatedAt: snapshot.updatedAt,
    avatars: snapshot.avatars.map(avatar => ({
      ...scalarFields(avatar, avatarKeys), face: publicArt(avatar.face), splash: publicArt(avatar.splash),
      skills: avatar.skills.map(skill => ({ ...scalarFields(skill, ["key", "level", "original"]), icon: publicArt(skill?.icon) })),
      traces: avatar.traces.map(trace => ({ ...scalarFields(trace, ["id", "name", "active"]), icon: publicArt(trace?.icon) })),
      stars: avatar.stars.map(star => ({ ...scalarFields(star, ["active"]), image: publicArt(star?.image) })),
      stats: avatar.stats.map(stat => scalarFields(stat, statKeys)),
      cone: avatar.cone && { ...scalarFields(avatar.cone, ["id", "name", "rank", "level", "promote", "description"]), image: publicArt(avatar.cone.image) },
      relics: avatar.relics.map(relic => ({
        ...scalarFields(relic, ["id", "slot", "name", "level", "rarity"]), image: publicArt(relic.image),
        main: scalarFields(relic.main, statKeys), subs: relic.subs.map(stat => scalarFields(stat, statKeys)),
      })),
    })),
  };
}

export function panelExportFile(snapshot: PanelSnapshot, legacy?: Record<string, unknown>,
  talentCons?: ReadonlyMap<string, Record<string, unknown>>) {
  const { document, unresolved } = legacy ? legacyDocument(snapshot, legacy, talentCons) : { document: managedDocument(snapshot), unresolved: 0 };
  const format = legacy ? "旧 PlayerData 格式" : "Lotus-Yunzai 面板格式";
  const name = `${snapshot.uid}.json`;
  return { name, format, unresolved, bytes: Buffer.from(JSON.stringify(document, null, "\t") + "\n") };
}
