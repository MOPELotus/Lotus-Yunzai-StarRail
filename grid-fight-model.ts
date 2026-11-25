import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { gameCommandProfileId, normalizeProfileRoleArtworkUrl } from "@lotus-yunzai/account";
import names from "./challenge-character-names.json";
import type { GridFightRecentCount } from "./grid-fight-config.ts";

const recent = /^#*货币战争(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;
const overview = /^([#*＊]?(?:星穹铁道|星铁|星轨|崩铁|铁道|sr)|[#*＊])?\s*(货币战争|货币|币战)(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;
const detail = /^([#*＊]?(?:星穹铁道|星铁|星轨|崩铁|铁道|sr)|[#*＊])?\s*(货币战争|货币|币战)(?:战绩|回顾|战报|记录)\s*(?:(\d{1,2})(?=\s|档案|$))?(?:\s*(?:档案\s*)?(\d{1,3}))?$/u;

export function parseStarRailGridFight(message: string) {
  const value = message.trim();
  const match = detail.exec(value);
  if (match && (match[1] || match[2] === "货币战争")) {
    // A second bare number is the profile. A leading archive marker selects
    // profile only. A single bare number is always the game record number.
    const first = match[3], slot = match[4];
    if (!first && slot && !/档案/u.test(value)) return;
    return { mode: "detail", index: Number(first ?? 1), profileId: gameCommandProfileId("sr", slot) } as const;
  }
  const recentEntry = recent.exec(value);
  if (recentEntry) return { mode: "recent", profileId: gameCommandProfileId("sr", recentEntry[1]) } as const;
  const entry = overview.exec(value);
  if (entry && (entry[1] || entry[2] === "货币战争")) {
    return { mode: "overview", profileId: gameCommandProfileId("sr", entry[3]) } as const;
  }
}

export type GridFightQuery = NonNullable<ReturnType<typeof parseStarRailGridFight>>;
export const gridFightHistoryMax = 10;

type Row = Record<string, unknown>;
export type GridArt = { name?: string; icon?: string };
type Item = GridArt & { id?: string; quality?: number; count?: number };
export type GridMember = GridArt & { id?: string; rarity?: number; stars?: number; trial: boolean; equipment: GridArt[] };
type Division = { level?: number; icon?: string; background?: string; name?: string };
type Battle = {
  division: Division; mode?: string; rank?: string; time?: string;
  health?: number; coin?: number; value?: number; front: GridMember[]; back: GridMember[];
  traits: Item[]; portals: Item[]; augments: Item[];
  damage: { entity: GridMember | Item | GridArt; kind: "role" | "trait" | "strategy" | "environment" | undefined; amount: number; ratio: number; label: string }[];
};
export type GridFightCard = {
  uid: string; season?: number; points?: number; pointsMax?: number;
  handbook?: number; traits?: number; quest?: number; questMax?: number;
  division: Division; battle?: Battle; recent?: readonly { ordinal: number; battle: Battle }[]; index?: number; historyCount: number;
};

function object(value: unknown): Row | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Row;
}

function list(value: unknown, max: number): Row[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, max).flatMap<Row>(row => object(row) ?? []);
}

function text(value: unknown, length = 48) {
  if (typeof value === "string") return value.replace(/[\p{Cc}\p{Cf}]/gu, " ").trim().slice(0, length) || undefined;
}

function num(value: unknown, max = 999_999_999) {
  const n = typeof value === "string" && /^\d{1,15}(?:\.\d{1,6})?$/u.test(value) ? Number(value) : value;
  if (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max) return n;
}

function key(value: unknown) {
  const n = num(value);
  if (n !== undefined && Number.isInteger(n) && n > 0) return String(n);
}

const icons = normalizeProfileRoleArtworkUrl;
const characters: Readonly<Record<string, string>> = names;

function division(raw: unknown): Division {
  const row = object(raw);
  const rank = num(row?.level, 99);
  return { level: rank !== undefined && Number.isInteger(rank) && rank > 0 ? rank - 1 : undefined,
    name: text(row?.name_with_num ?? row?.name), icon: icons(row?.icon), background: icons(row?.icon_with_bg) };
}

function item(row: Row): Item {
  return { id: key(row.trait_id ?? row.augment_id ?? row.portal_id ?? row.id), name: text(row.trait_name ?? row.name),
    icon: icons(row.icon), quality: num(row.quality, 9), count: num(row.trait_count, 99) };
}

function member(row: Row, equipmentLimit: number): GridMember {
  const id = key(row.role_id ?? row.avatar_id);
  const avatarId = key(row.avatar_id ?? row.avatar_role_id) ?? id;
  const rarity = num(row.rarity, 9), stars = num(row.star, 9);
  return { id, name: text(row.name ?? row.role_name ?? row.name_mi18n) ?? (avatarId ? characters[avatarId] : undefined), icon: icons(row.icon),
    rarity: Number.isInteger(rarity) ? rarity : undefined, stars: Number.isInteger(stars) ? stars : undefined,
    trial: row.is_trial === true, equipment: list(row.equip_list, equipmentLimit).map(item) };
}

function battle(raw: Row, recent = false): Battle | undefined {
  const brief = object(raw.brief);
  const lineup = object(raw.lineup);
  if (!brief || !lineup) return;
  const equipmentLimit = recent ? 9 : 3;
  const frontSources = list(lineup.front_roles, 10), backSources = list(lineup.back_roles, 10);
  const front = frontSources.map(role => member(role, equipmentLimit));
  const back = backSources.map(role => member(role, equipmentLimit));
  const traits = list(lineup.trait_list, 24).map(item);
  const portals = list(lineup.portal_list, 12).map(item);
  const augments = list(lineup.augment_list, 24).map(item);
  const rolesById = new Map([...front, ...back].map(role => [role.id, role] as const));
  const roles = [...front, ...back];
  [...frontSources, ...backSources].forEach((role, index) => {
    const avatarId = key(role.avatar_id);
    if (avatarId !== undefined && !rolesById.has(avatarId)) rolesById.set(avatarId, roles[index]!);
  });
  const portalsById = new Map(portals.map(portal => [portal.id, portal] as const));
  const traitsById = new Map(traits.map(trait => [trait.id, trait] as const));
  const augmentsById = new Map(augments.map(augment => [augment.id, augment] as const));
  const hits = list(lineup.damage_list, 80).flatMap(row => {
    const amount = num(row.damage, Number.MAX_SAFE_INTEGER);
    if (amount === undefined) return [];
    const id = key(row.id);
    const kind: Battle["damage"][number]["kind"] = row.damage_type === "DamageTypeRole" ? "role"
      : row.damage_type === "DamageTypeTrait" ? "trait" : row.damage_type === "DamageTypeAugment" ? "strategy"
      : row.damage_type === "DamageTypePortal" ? "environment" : undefined;
    const entity = id === undefined ? undefined : kind === "role" ? rolesById.get(id)
      : kind === "trait" ? traitsById.get(id) : kind === "strategy" ? augmentsById.get(id)
        : kind === "environment" ? portalsById.get(id) : undefined;
    return [{ amount, kind, entity: entity ?? { name: $t("grid-fight-model.text_061d060aeb") } }];
  });
  if (!recent) hits.sort((left, right) => right.amount - left.amount);
  hits.splice(5);
  const peak = hits[0]?.amount ?? 0;
  const damage = hits.map(hit => ({ ...hit, ratio: peak > 0 ? hit.amount / peak : 0,
    label: recent ? (Math.ceil(hit.amount) / 10_000).toFixed(2) + $t("grid-fight-model.text_fc227df4fc") : hit.amount >= 100_000_000 ? (hit.amount / 100_000_000).toFixed(1) + $t("grid-fight-model.text_395ae225e5") : hit.amount >= 10_000 ? (hit.amount / 10_000).toFixed(1) + $t("grid-fight-model.text_fc227df4fc") : hit.amount.toFixed(0) }));
  const rawMode = raw.archive_type ?? brief.archive_type;
  const mode = rawMode === "ArchiveTypeHard" ? $t("grid-fight-model.text_59b38837be")
    : recent ? $t("grid-fight-model.text_9db25688df") : rawMode === "ArchiveTypePromotion" || brief.is_promotion === true ? $t("grid-fight-model.text_8fbde77ef2")
    : rawMode === "ArchiveTypeNormal" || rawMode === "ArchiveTypeStandard" || brief.is_promotion === false ? $t("grid-fight-model.text_9db25688df") : undefined;
  const rank = /^GridFightArchiveRank(SSS|SS|S|A|B|C|D)$/u.exec(String(brief.archive_rank))?.[1];
  const unix = num(brief.archive_time_ts, 9_999_999_999);
  const time = text(brief.archive_time) ?? (unix ? new Date((unix + 8 * 3600) * 1000).toISOString().slice(0, 16).replace("T", " ") : undefined);
  return { division: division(brief.division), mode, rank, time, health: num(brief.remain_hp), coin: num(brief.total_coin),
    value: num(brief.lineup_coin), front, back, traits, portals, augments, damage };
}

export function makeGridFightCard(uid: string, brief: Row, source: readonly Row[], index?: number, recent?: GridFightRecentCount): GridFightCard {
  const count = Math.min(gridFightHistoryMax, source.length);
  const row = source[(index ?? 1) - 1];
  const summary = recent ? source.slice(0, recent).flatMap((entry, position) => {
    const details = battle(entry, true);
    return details ? [{ ordinal: position + 1, battle: details }] : [];
  }) : undefined;
  return { uid, season: num(brief.season_level), points: num(brief.weekly_score_cur), pointsMax: num(brief.weekly_score_max),
    handbook: num(brief.handbook_progress, 100), traits: num(brief.trait_progress, 100),
    quest: num(brief.quest_cur), questMax: num(brief.quest_max), division: division(brief.division),
    battle: !recent && row ? battle(row) : undefined, recent: summary, index, historyCount: count };
}

const missing = "—";
const fraction = (value: number | undefined, max: number | undefined) => value !== undefined || max !== undefined
  ? `${value ?? missing}/${max ?? missing}` : missing;
export function gridFightStats({ season, points, pointsMax, handbook, traits, quest, questMax, recent }: GridFightCard) {
  return {
    header: [[$t("grid-fight-model.text_fb9da3b31b"), season === undefined ? missing : recent ? $t("grid-fight-model.text_a39dde7482", { "season": season }) : season],
      [recent ? $t("grid-fight-model.text_1c8734b3d5") : $t("grid-fight-model.text_8f338755a1"), fraction(points, pointsMax)]] as const,
    progress: [
      [$t("grid-fight-model.text_b361025bae"), handbook === undefined ? missing : `${handbook}%`],
      [$t("grid-fight-model.text_eb8de802c1"), traits === undefined ? missing : `${traits}%`],
      [$t("grid-fight-model.text_abfb61ed0b"), fraction(quest, questMax)],
    ] as const,
  };
}

function artLabels(items: readonly (GridArt | GridMember)[], withEquipment = false) {
  return items.length ? items.map(item => {
    const name = item.name ?? $t("grid-fight-model.text_3e12cc8126");
    if (withEquipment && "equipment" in item && item.equipment.length) {
      return `${name}（${item.equipment.map(equip => equip.name ?? $t("grid-fight-model.text_3e12cc8126")).join("、")}）`;
    }
    return name;
  }).join("、") : $t("grid-fight-model.text_b336a174cd");
}

export function gridFightText(model: GridFightCard) {
  const { header, progress } = gridFightStats(model);
  const lines = [$t("grid-fight-model.text_af17925f23", { "value1": model.index ? $t("grid-fight-model.text_e2b9a28a51") + model.index : "", "uid": model.uid }),
    header.map(([title, value]) => `${title} ${value}`).join(" · "),
    $t("grid-fight-model.text_ea7e47e37a", { "value1": model.division.level === undefined ? "" : "A" + model.division.level + " ", "value2": model.division.name ?? missing })];
  if (model.index === undefined && !model.recent) lines.push(progress.map(([title, value]) => `${title} ${value}`).join(" · "));
  const battles = model.recent ?? (model.battle ? [{ ordinal: model.index ?? 1, battle: model.battle }] : []);
  if (!battles.length) return [...lines, $t("grid-fight-model.text_fca5cfacde")].join("\n");
  for (const { ordinal, battle: row } of battles) {
    if (model.recent) lines.push($t("grid-fight-model.text_910e05b6d0", { "ordinal": ordinal }));
    lines.push([row.division.name, row.mode, row.rank, row.time].filter(Boolean).join(" · "),
      $t("grid-fight-model.text_f2cd4ae167", { "value1": row.health ?? missing, "value2": row.coin ?? missing, "value3": row.value ?? missing }),
      $t("grid-fight-model.text_f1b240541f", { "value1": artLabels(row.front, !!model.recent) }), $t("grid-fight-model.text_f986abe894", { "value1": artLabels(row.back, !!model.recent) }));
    if (model.index !== undefined || model.recent) lines.push($t("grid-fight-model.text_372183d526", { "value1": artLabels(row.traits) }), $t("grid-fight-model.text_05cebdcca8", { "value1": artLabels(row.portals) }), $t("grid-fight-model.text_633ee35f35", { "value1": artLabels(row.augments) }),
      ...row.damage.map(hit => `${hit.entity.name ?? $t("grid-fight-model.text_3e12cc8126")} ${hit.label}`));
  }
  if (model.historyCount > 0) lines.push($t("grid-fight-model.text_f0f06f53e4", { "historyCount": model.historyCount }));
  return lines.filter(Boolean).join("\n");
}
