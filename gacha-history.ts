import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { starRailGachaPools, type createHoyoClient, type StarRailGachaPool } from "@lotus-yunzai/hoyo-client";

type ObjectRecord = Record<string, unknown>;
export type StarRailGachaSnapshot = Awaited<ReturnType<ReturnType<typeof createHoyoClient>["fetchStarRailGacha"]>>;
type SnapshotPool = StarRailGachaSnapshot["pools"][number];
type HistoryPools = Record<StarRailGachaPool, StarRailGachaHistoryPool> & ObjectRecord;

export interface StarRailGachaHistoryPool {
  readonly name: string;
  readonly cards: SnapshotPool["cards"];
  readonly cardCounters: Readonly<Record<string, number>>;
  readonly fiveStars: readonly FiveStarHistory[];
  readonly totalDraws: number;
  readonly pity: number;
}

type FiveStarHistory = ObjectRecord & {
  readonly id: string;
  readonly uuid: string;
  readonly item: ObjectRecord | null;
  readonly is_up?: boolean;
  readonly got_item: unknown;
  readonly gacha_count: number;
};

const poolTypes = Object.keys(starRailGachaPools) as StarRailGachaPool[];

function isRecord(value: unknown): value is ObjectRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, message: string): ObjectRecord {
  if (!isRecord(value)) throw new TypeError(message);
  return value;
}

function list(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(message);
  return value;
}

function idText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  throw new TypeError($t("gacha-history.text_c43053ed72"));
}

function count(value: unknown): number {
  const number = typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0) {
    throw new TypeError($t("gacha-history.text_86a5e57d98"));
  }
  return number;
}

function normalizeFiveStar(value: unknown, isIncoming: boolean): FiveStarHistory {
  const row = record(value, $t("gacha-history.text_014955d722"));
  const { is_up, ...fields } = row;
  const id = idText(row.id);
  const uuid = idText(row.uuid);
  if (!id && !uuid) throw new TypeError($t("gacha-history.text_5e0e5e17d1"));
  const item = row.item == null && !isIncoming ? null : record(row.item, $t("gacha-history.text_a9d858a7cf"));
  return {
    ...fields, id, uuid, item, ...(typeof is_up === "boolean" ? { is_up } : {}), got_item: row.got_item ?? null,
    gacha_count: count(isIncoming ? row.gacha_count : row.gacha_count ?? 0),
  };
}

function compareNewest(left: FiveStarHistory, right: FiveStarHistory): number {
  const a = left.id || left.uuid;
  const b = right.id || right.uuid;
  if (/^\d+$/u.test(a) && /^\d+$/u.test(b) && a.length !== b.length) return b.length - a.length;
  return b.localeCompare(a, "en");
}

function mergeFiveStars(legacy: unknown, recent: readonly unknown[]) {
  const previous = list(legacy, $t("gacha-history.text_3683ef2240")).map((row) => normalizeFiveStar(row, false));
  const incoming = recent.map((row) => normalizeFiveStar(row, true));
  const byUuid = new Map<string, string>();
  for (const row of [...previous, ...incoming]) {
    if (!row.id || !row.uuid) continue;
    const mapped = byUuid.get(row.uuid);
    if (mapped !== undefined && mapped !== row.id) throw new Error($t("gacha-history.text_bbb72c798d"));
    byUuid.set(row.uuid, row.id);
  }

  const merged = new Map<string, FiveStarHistory>();
  function include(row: FiveStarHistory) {
    const id = row.id || byUuid.get(row.uuid) || "";
    const key = id ? `id:${id}` : `uuid:${row.uuid}`;
    const known = merged.get(key);
    merged.set(key, {
      ...known, ...row, id, uuid: row.uuid || known?.uuid || "",
      item: row.item ?? known?.item ?? null, got_item: row.got_item ?? known?.got_item ?? null,
    });
  }

  for (const row of previous) include(row);
  const originalCount = merged.size;
  for (const row of incoming) include(row);
  return { fiveStars: [...merged.values()].sort(compareNewest), added: merged.size - originalCount };
}

function updateCounters(counters: Map<string, number>, cards: readonly unknown[]) {
  for (const value of cards) {
    const card = record(value, $t("gacha-history.text_0260ad50b4"));
    const total = count(card.total_count);
    const id = idText(card.gacha_id);
    if (!id && total > 0) throw new TypeError($t("gacha-history.text_6d50b0ffa7"));
    if (id) counters.set(id, Math.max(counters.get(id) ?? 0, total));
  }
}

function mergePool(previous: ObjectRecord, latest: SnapshotPool) {
  const counters = new Map<string, number>();
  if (previous.cardCounters == null) {
    updateCounters(counters, list(previous.cards ?? [], $t("gacha-history.text_6a11627b78")));
  } else {
    const saved = record(previous.cardCounters, $t("gacha-history.text_5dddcd723d"));
    for (const [id, total] of Object.entries(saved)) {
      if (!id.trim()) throw new TypeError($t("gacha-history.text_bfb20e936b"));
      counters.set(id, count(total));
    }
  }

  const knownByCard = count([...counters.values()].reduce((sum, value) => sum + value, 0));
  const historicalTotal = count(previous.totalDraws ?? knownByCard);
  const cards = latest.cards;
  updateCounters(counters, cards);
  const updatedByCard = count([...counters.values()].reduce((sum, value) => sum + value, 0));
  const totalDraws = count(Math.max(historicalTotal, knownByCard) + (updatedByCard - knownByCard));
  const { fiveStars, added } = mergeFiveStars(previous.fiveStars ?? [], latest.fiveStars);
  const pity = count(latest.pity ?? previous.pity ?? 0);
  const pool: StarRailGachaHistoryPool = {
    ...previous, name: starRailGachaPools[latest.type], cards,
    cardCounters: Object.fromEntries(counters), fiveStars, totalDraws, pity,
  };
  return { pool, added };
}

function snapshotPools(latest: StarRailGachaSnapshot) {
  const pools = new Map<StarRailGachaPool, SnapshotPool>();
  if (!Array.isArray(latest.pools) || latest.pools.length !== poolTypes.length) {
    throw new TypeError($t("gacha-history.text_46e19f9bea"));
  }
  for (const pool of latest.pools) {
    if (!isRecord(pool) || !Object.hasOwn(starRailGachaPools, pool.type) || pools.has(pool.type) ||
        !Array.isArray(pool.cards) || !Array.isArray(pool.fiveStars) ||
        (pool.pity !== null && (!Number.isSafeInteger(pool.pity) || pool.pity < 0))) {
      throw new TypeError($t("gacha-history.text_25cb527d02"));
    }
    pools.set(pool.type, pool);
  }
  return pools;
}

export function mergeStarRailGachaHistory(
  oldLog: unknown,
  latest: StarRailGachaSnapshot,
  { qq, profileId }: { readonly qq: string; readonly profileId: number },
  updatedAt: Date,
) {
  if (!/^[1-9]\d*$/u.test(qq) || !/^[1-9]\d*$/u.test(latest.uid) ||
      (latest.region !== "prod_gf_cn" && latest.region !== "prod_qd_cn") ||
      !Number.isInteger(profileId) || profileId < 1 || profileId > 255) {
    throw new TypeError($t("gacha-history.text_211ebe0eaf"));
  }
  const previous = oldLog == null ? {} : record(oldLog, $t("gacha-history.text_6cf035ebde"));
  if ((previous.version != null && idText(previous.version) !== "1") ||
      (previous.qq != null && idText(previous.qq) !== qq) ||
      (previous.uid != null && idText(previous.uid) !== latest.uid) ||
      (previous.region != null && previous.region !== latest.region)) {
    throw new Error($t("gacha-history.text_cd91f607d2"));
  }

  const pools = snapshotPools(latest);
  const previousPools = record(previous.pools ?? {}, $t("gacha-history.text_0175828bc9"));
  const merged = poolTypes.map((type) => ({
    type, ...mergePool(record(previousPools[type] ?? {}, $t("gacha-history.text_e3fc8ec3e5")), pools.get(type)!),
  }));
  const updatedPools = Object.fromEntries(merged.map(({ type, pool }) => [type, pool])) as
    Record<StarRailGachaPool, StarRailGachaHistoryPool>;
  const combinedPools: HistoryPools = { ...previousPools, ...updatedPools };
  const log = {
    ...previous, version: 1, qq, uid: latest.uid, region: latest.region, profileId,
    source: "mihoyo_star_rail_gacha_miniapp", updatedAt: updatedAt.toISOString(), brief: latest.brief,
    pools: combinedPools,
  };
  const summary = merged.map(({ type, pool, added }) => ({
    type, name: pool.name, added, total: pool.fiveStars.length, totalDraws: pool.totalDraws, pity: pool.pity,
  }));
  return {
    log, added: summary.reduce((sum, pool) => sum + pool.added, 0),
    total: summary.reduce((sum, pool) => sum + pool.total, 0), pools: summary,
  };
}
