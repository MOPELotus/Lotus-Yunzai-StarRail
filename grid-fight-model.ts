import { normalizeProfileRoleArtworkUrl } from "@lotus-yunzai/account";
import names from "./challenge-character-names.json";

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
    return { mode: "detail", index: Number(first ?? 1), profileId: Number(slot ?? 1) } as const;
  }
  const recentEntry = recent.exec(value);
  if (recentEntry) return { mode: "recent", profileId: Number(recentEntry[1] ?? 1) } as const;
  const entry = overview.exec(value);
  if (entry && (entry[1] || entry[2] === "货币战争")) {
    return { mode: "overview", profileId: Number(entry[3] ?? 1) } as const;
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
  damage: { entity: GridMember | Item | GridArt; kind: "role" | "trait" | "strategy" | undefined; amount: number; ratio: number; label: string }[];
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
  return { id: key(row.trait_id ?? row.augment_id ?? row.id), name: text(row.trait_name ?? row.name),
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
  const front = list(lineup.front_roles, 10).map(role => member(role, equipmentLimit));
  const back = list(lineup.back_roles, 10).map(role => member(role, equipmentLimit));
  const traits = list(lineup.trait_list, 24).map(item);
  const portals = list(lineup.portal_list, 12).map(item);
  const augments = list(lineup.augment_list, 24).map(item);
  const rolesById = new Map([...front, ...back].map(role => [role.id, role] as const));
  const traitsById = new Map(traits.map(trait => [trait.id, trait] as const));
  const augmentsById = new Map(augments.map(augment => [augment.id, augment] as const));
  const hits = list(lineup.damage_list, 80).flatMap(row => {
    const amount = num(row.damage, Number.MAX_SAFE_INTEGER);
    if (amount === undefined) return [];
    const id = key(row.id);
    const kind: Battle["damage"][number]["kind"] = row.damage_type === "DamageTypeRole" ? "role"
      : row.damage_type === "DamageTypeTrait" ? "trait" : row.damage_type === "DamageTypeAugment" ? "strategy" : undefined;
    const entity = id === undefined ? undefined : kind === "role" ? rolesById.get(id)
      : kind === "trait" ? traitsById.get(id) : kind === "strategy" ? augmentsById.get(id) : undefined;
    return [{ amount, kind, entity: entity ?? { name: "未知伤害来源" } }];
  });
  if (!recent) hits.sort((left, right) => right.amount - left.amount);
  hits.splice(5);
  const peak = hits[0]?.amount ?? 0;
  const damage = hits.map(hit => ({ ...hit, ratio: peak > 0 ? hit.amount / peak : 0,
    label: recent ? (Math.ceil(hit.amount) / 10_000).toFixed(2) + "万" : hit.amount >= 10_000 ? (hit.amount / 10_000).toFixed(1) + "万" : hit.amount.toFixed(0) }));
  const rawMode = raw.archive_type ?? brief.archive_type;
  const mode = rawMode === "ArchiveTypeHard" ? "超频博弈"
    : recent ? "标准博弈" : rawMode === "ArchiveTypePromotion" || brief.is_promotion === true ? "快速博弈"
    : rawMode === "ArchiveTypeNormal" || rawMode === "ArchiveTypeStandard" || brief.is_promotion === false ? "标准博弈" : undefined;
  const rank = /^GridFightArchiveRank(SSS|SS|S|A|B|C|D)$/u.exec(String(brief.archive_rank))?.[1];
  const unix = num(brief.archive_time_ts, 9_999_999_999);
  const time = text(brief.archive_time) ?? (unix ? new Date((unix + 8 * 3600) * 1000).toISOString().slice(0, 16).replace("T", " ") : undefined);
  return { division: division(brief.division), mode, rank, time, health: num(brief.remain_hp), coin: num(brief.total_coin),
    value: num(brief.lineup_coin), front, back, traits, portals, augments, damage };
}

export function makeGridFightCard(uid: string, brief: Row, source: readonly Row[], index?: number, recent = false): GridFightCard {
  const count = Math.min(gridFightHistoryMax, source.length);
  const row = source[(index ?? 1) - 1];
  const summary = recent ? source.slice(0, 2).flatMap((entry, position) => {
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
    header: [["晋升等级", season === undefined ? missing : recent ? `${season}级` : season],
      [recent ? "货币积分" : "本期积分", fraction(points, pointsMax)]] as const,
    progress: [
      ["数据银行", handbook === undefined ? missing : `${handbook}%`],
      ["羁绊链路", traits === undefined ? missing : `${traits}%`],
      ["预期收益", fraction(quest, questMax)],
    ] as const,
  };
}

function artLabels(items: readonly GridArt[]) {
  return items.length ? items.map(item => item.name ?? "未提供名称").join("、") : "暂无";
}

export function gridFightText(model: GridFightCard) {
  const { header, progress } = gridFightStats(model);
  const lines = [`货币战争${model.index ? " · 战绩回顾 " + model.index : ""} · UID ${model.uid}`,
    header.map(([title, value]) => `${title} ${value}`).join(" · "),
    `职级 ${model.division.level === undefined ? "" : "A" + model.division.level + " "}${model.division.name ?? missing}`];
  if (model.index === undefined && !model.recent) lines.push(progress.map(([title, value]) => `${title} ${value}`).join(" · "));
  const battles = model.recent ?? (model.battle ? [{ ordinal: model.index ?? 1, battle: model.battle }] : []);
  if (!battles.length) return [...lines, "暂无通关战绩"].join("\n");
  for (const { ordinal, battle: row } of battles) {
    if (model.recent) lines.push(`战绩 ${ordinal}`);
    lines.push([row.division.name, row.mode, row.rank, row.time].filter(Boolean).join(" · "),
      `小队生命值 ${row.health ?? missing} · 总经济 ${row.coin ?? missing} · 阵容价值 ${row.value ?? missing}`,
      `前台 ${artLabels(row.front)}`, `后台 ${artLabels(row.back)}`);
    if (model.index !== undefined || model.recent) lines.push(`羁绊 ${artLabels(row.traits)}`, `投资环境 ${artLabels(row.portals)}`, `投资策略 ${artLabels(row.augments)}`,
      ...row.damage.map(hit => `${hit.entity.name ?? "未提供名称"} ${hit.label}`));
  }
  if (model.historyCount > 0) lines.push(`可查询 ${model.historyCount} 条战绩，发送 *币战战报1 查看详情。`);
  return lines.filter(Boolean).join("\n");
}
