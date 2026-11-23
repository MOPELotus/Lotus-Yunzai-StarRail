import { gachaProbabilityFor, type GachaDisplaySettings } from "@lotus-yunzai/gacha/display-settings";
import { applyGachaGuarantees, gachaLuckFor } from "@lotus-yunzai/gacha";
import { detailPools, type StarRailGachaDetailModel, type StarRailGachaDetailPool } from "./gacha-detail.ts";
import type { StarRailRecordDraw } from "./gacha-record-source.ts";

type Gacha = StarRailGachaDetailModel["gacha"];
type FiveStar = Gacha["fiveLog"][number];

export interface StarRailRecordDetailOptions {
  readonly uid: string;
  readonly draws: readonly StarRailRecordDraw[];
  readonly face: StarRailGachaDetailModel["face"];
  readonly pool?: StarRailGachaDetailPool;
  readonly resolvePool?: (draw: StarRailRecordDraw) => { isUp?: boolean; isNewPool?: boolean } | undefined;
  readonly maxRows?: number;
  readonly display?: GachaDisplaySettings;
  readonly page?: number;
  readonly now?: Date;
}

const pityItem = 888;
const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" });

function dateAt(timestamp: number): string {
  return Number.isFinite(timestamp) ? dateFormat.format(timestamp).replace("/", "-") : "";
}

function newest(a: StarRailRecordDraw, b: StarRailRecordDraw): number {
  return b.at - a.at || b.id.length - a.id.length || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1);
}

export function buildStarRailRecordDetail({
  uid, draws, face, pool = "GachaType_AvatarUp", resolvePool, display, maxRows = display?.detailRows ?? 30, page, now = new Date(),
}: StarRailRecordDetailOptions): StarRailGachaDetailModel | undefined {
  if (!/^[1-9]\d*$/u.test(uid)) throw new TypeError("星铁抽卡显示 UID 无效。");
  if (!Number.isSafeInteger(maxRows) || maxRows < 0 || (page !== undefined && (!Number.isSafeInteger(page) || page < 1))) {
    throw new RangeError("星铁抽卡显示分页参数无效。");
  }
  const model = detailPools[pool];
  if (!model) throw new TypeError("星铁抽卡卡池没有对应的详情模板。");
  const selected = draws.filter((draw) => draw.pool === String(model.legacy)).sort(newest);
  const allNum = selected.length;
  if (!allNum) return;

  const items: Gacha["items"] = Object.create(null);
  const five: { row: FiveStar; index: number; unclassifiedBefore: number }[] = [];
  let firstFour: number | undefined;
  let lastFour = 0;
  let fourNum = 0;
  let weaponFourNum = 0;
  let unclassified = 0;

  for (const [index, draw] of selected.entries()) {
    const { rank, item } = draw;
    if (rank === undefined) {
      unclassified++;
      continue;
    }
    const knownItem = items[item.id];
    const id = item.id === String(pityItem) || (knownItem && knownItem.star !== rank) ? `item:${item.id}:${rank}` : item.id;
    const info = items[id] ??= { name: item.name, abbr: item.abbr, img: item.img,
      star: rank, count: 0, ...(item.kind ? { type: item.kind } : {}) };
    info.count!++;

    if (rank === 4) {
      firstFour ??= index;
      lastFour = index;
      fourNum++;
      if (item.kind === "weapon") weaponFourNum++;
    }
    if (rank === 5) {
      const version = resolvePool?.(draw);
      const isUp = model.upRate ? version?.isUp : undefined;
      const row: FiveStar = {
        id, date: dateAt(draw.at), count: 0, ...(isUp === undefined ? {} : { isUp }),
        isNewPool: version?.isNewPool ?? false,
      };
      five.push({ row, index, unclassifiedBefore: unclassified });
    }
  }

  const fiveLog = five.map(({ row, index, unclassifiedBefore }, offset): FiveStar => {
    const next = five[offset + 1];
    if ((next?.unclassifiedBefore ?? unclassified) !== unclassifiedBefore) return { ...row, countKnown: false };
    if (next) return { ...row, count: next.index - index };
    return { ...row, count: allNum - index, countAtLeast: true };
  });
  const fiveNum = five.length;
  // Without every rarity, the true current pity and effective draw averages cannot be determined.
  const pity = unclassified ? 0 : five[0]?.index ?? allNum;
  const noFourNum = unclassified ? 0 : firstFour ?? allNum;
  const closedFive = fiveLog.slice(0, -1);
  const fiveUsed = closedFive.reduce((total, row) => total + row.count, 0);
  const wai = fiveLog.filter(({ isUp }) => isUp === false).length;
  const reliableUp = !unclassified && model.upRate && fiveLog.every(({ isUp }) => isUp !== undefined);
  const upIndexes = reliableUp ? fiveLog.flatMap(({ isUp }, index) => isUp ? [index] : []) : [];
  const upNum = Math.max(0, upIndexes.length - 1);
  // The first recorded UP anchors the cost of later UP draws. Its own cost is outside the archive.
  const upUsed = upNum ? fiveLog.slice(upIndexes[0], upIndexes.at(-1)).reduce((total, row) => total + row.count, 0) : 0;
  const isvalidNum = upNum ? (upUsed / upNum).toFixed(2) : 0;
  const upYs = Number(isvalidNum) * 160;
  const initialUp = fiveLog.at(-1)?.isUp;
  const state = applyGachaGuarantees(!unclassified && model.upRate ? closedFive : [], initialUp === undefined ? null : !initialUp);
  const luck = unclassified ? undefined
    : gachaLuckFor(
      gachaProbabilityFor("sr", model.legacy, model, display), closedFive.length, fiveUsed, upNum, upUsed,
      state, closedFive.some(({ isNewPool }) => isNewPool), display?.luck,
    );

  const stat: Gacha["stat"] = {
    allNum, noFiveNum: pity, noFourNum, fiveNum, fourNum,
    fiveAvg: !unclassified && closedFive.length ? (fiveUsed / closedFive.length).toFixed(2) : 0,
    fourAvg: !unclassified && fourNum > 1 ? ((lastFour - noFourNum) / (fourNum - 1)).toFixed(2) : 0,
    wai, isvalidNum, weaponNum: 0, weaponFourNum,
    upYs: !upNum ? "" : upYs >= 10_000 ? `${(upYs / 10_000).toFixed(2)}w` : upYs.toFixed(0),
  };
  let maxFour: Gacha["maxFour"] = { name: "无", count: 0 };
  for (const item of Object.values(items)) {
    if (item.star === 4 && item.count !== undefined && item.count > maxFour.count) {
      maxFour = { ...item, count: item.count };
    }
  }

  const pages = maxRows ? Math.max(1, Math.ceil(fiveNum / maxRows)) : 1;
  if (page !== undefined && page > pages) throw new RangeError("星铁抽卡显示页码超出范围。");
  const from = maxRows ? ((page ?? 1) - 1) * maxRows : 0;
  const to = maxRows ? Math.min(fiveNum, from + maxRows) : fiveNum;
  const pageInfo = page !== undefined && pages > 1 ? { page, total: pages, from: from + 1, to, count: fiveNum } : undefined;
  const firstPagePity: FiveStar[] = [];
  if (!from && pity) {
    items[pityItem] = { name: "已抽", abbr: "已抽", star: 5, img: "gacha/imgs/no-avatar.webp" };
    firstPagePity.push({ id: pityItem, date: dateAt(now.valueOf()), isUp: true, count: pity,
      ...(!fiveNum ? { countAtLeast: true } : {}) });
  }
  return { uid, face, poolName: model.name, pageInfo, gacha: {
    stat, items, maxFour, ...(luck ? { luck } : {}), noWaiRate: state.noWaiRate,
    fiveLog: [...firstPagePity, ...fiveLog.slice(from, to)],
    ...(page === undefined && to < fiveNum ? { shownNum: to, hiddenNum: fiveNum - to } : {}),
    ...(unclassified ? { unclassified } : {}),
  } };
}
