import { array, canonicalStarRailPanelCharacter, id, object, readOfficialPanelSkill, starRailLegacySkillLevel, whole,
  type PanelSnapshot } from "./panel-model.ts";

const coreKeys = ["a", "e", "q", "t"] as const;
type CoreKey = typeof coreKeys[number];
interface Entry {
  readonly rank: number;
  readonly at: number;
  readonly levels: Record<CoreKey, number>;
}
export type ConfirmedTraces = Record<string, Entry>;

function confirmedLevels(rows: Record<string, unknown>) {
  const levels = coreKeys.map(key => whole(rows[key], 15));
  if (!levels.every((level, index): level is number => level !== undefined && level > 0 &&
      starRailLegacySkillLevel(coreKeys[index]!, level, 0, undefined) === level)) return;
  return Object.fromEntries(coreKeys.map((key, index) => [key, levels[index]!])) as Entry["levels"];
}

export function confirmedStarRailTraces(snapshot: PanelSnapshot, upstream: readonly Record<string, unknown>[], at: number): ConfirmedTraces {
  const archived = new Map(snapshot.avatars.map(avatar => [avatar.id, avatar.rank]));
  const results: ConfirmedTraces = {};
  const seen = new Set<string>();
  for (const row of upstream) {
    const original = id(row.id);
    if (!original) continue;
    const skills = array(row.skills);
    const avatarId = canonicalStarRailPanelCharacter(original, skills.some(row => id(row.point_id).startsWith(`1${original}`)));
    if (seen.has(avatarId)) {
      delete results[avatarId];
      continue;
    }
    seen.add(avatarId);
    const rank = whole(row.rank, 6);
    if (rank === undefined || archived.get(avatarId) !== rank) continue;
    const observed: Record<string, number> = {};
    let duplicate = false;
    for (const row of skills) {
      const skill = readOfficialPanelSkill(row);
      if (!skill || !coreKeys.some(key => key === skill.key)) continue;
      if (Object.hasOwn(observed, skill.key)) duplicate = true;
      observed[skill.key] = skill.level;
    }
    const levels = duplicate ? undefined : confirmedLevels(observed);
    if (levels) results[avatarId] = { rank, at, levels };
  }
  return results;
}

export function readStarRailTraceArchive(uid: string, raw: unknown): ConfirmedTraces {
  if (raw === null) return {};
  const stored = object(raw), records = object(stored?.records);
  if (stored?.version !== 1 || stored.uid !== uid || !records || Object.keys(records).length > 256) throw new Error("星铁行迹档案无效。");
  return Object.fromEntries(Object.entries(records).map(([key, value]) => {
    const row = object(value), rank = whole(row?.rank, 6), at = whole(row?.at, Number.MAX_SAFE_INTEGER);
    const levels = confirmedLevels(object(row?.levels) ?? {});
    if (id(key) !== key || rank === undefined || at === undefined || !levels) throw new Error("星铁行迹档案无效。");
    return [key, { rank, at, levels }];
  }));
}

export function applyStarRailTraces(snapshot: PanelSnapshot, records: ConfirmedTraces): PanelSnapshot {
  const updatedAt = snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : 0;
  return { ...snapshot, avatars: snapshot.avatars.map(avatar => {
    const entry = records[avatar.id];
    if (!entry || entry.rank !== avatar.rank || entry.at <= updatedAt) return avatar;
    const known = new Map(avatar.skills.map(skill => [skill.key, skill]));
    for (const key of coreKeys) known.set(key, { key, level: entry.levels[key], icon: known.get(key)?.icon ?? "", effective: true });
    return { ...avatar, skills: [...known.values()] };
  }) };
}
