export type StarRailUigfPool = "1" | "2" | "11" | "12" | "21" | "22";

type WireRow = {
  readonly id: string;
  readonly gacha_id: string;
  readonly gacha_type: StarRailUigfPool;
  readonly item_id: string;
  readonly time: string;
  readonly name?: string;
  readonly item_type?: string;
  readonly rank_type?: "3" | "4" | "5";
  readonly count?: string;
};

export type StarRailUigfRow = WireRow & { readonly uid: string };

export interface StarRailUigfArchive {
  readonly uid: string;
  readonly timezone: number;
  readonly lang?: string;
  readonly records: readonly StarRailUigfRow[];
}

export interface StarRailUigfImportOptions {
  readonly uid: string;
  readonly legacyServerTime?: boolean;
  /** Option used by older callers when reading their saved exports. */
  readonly legacyMiaoServerTime?: boolean;
}

export interface StarRailUigfExportOptions {
  readonly uid: string;
  readonly version?: "v2" | "v4";
  readonly exportedAt: Date;
  readonly app: { readonly name: string; readonly version: string };
}

type ExportInfo = {
  readonly export_time: string;
  readonly export_timestamp: number;
  readonly export_app: string;
  readonly export_app_version: string;
};

export type StarRailUigfDocument =
  | { readonly info: ExportInfo & { readonly srgf_version: "v1.0"; readonly uid: string;
      readonly lang: string; readonly region_time_zone: number }; readonly list: readonly WireRow[] }
  | { readonly info: ExportInfo & { readonly version: "v4.1" };
      readonly hkrpg: readonly [{ readonly uid: string; readonly lang?: string; readonly timezone: number;
        readonly list: readonly WireRow[] }] };

const cnTimezone = 8;
const hourMs = 3_600_000;
const timePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;
const oldExporters = new Set(["Miao-Yunzai", "TRSS-Yunzai", "Yunzai-Bot"]);
const languages = new Set([
  "de-de", "en-us", "es-es", "fr-fr", "id-id", "it-it", "ja-jp", "ko-kr", "pt-pt", "ru-ru", "th-th",
  "tr-tr", "vi-vn", "zh-cn", "zh-tw",
]);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function identifier(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === "string" && /^\d{1,19}$/u.test(value)) return value.replace(/^0+/u, "") || undefined;
}

function checkUid(uid: string): void {
  if (typeof uid !== "string" || identifier(uid) !== uid) throw new TypeError("当前星铁档案 UID 无效。");
}

function checkTimezone(value: unknown, wholeHours = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -12 || value > 14 ||
      (wholeHours ? !Number.isInteger(value) : Math.abs(value * 60 - Math.round(value * 60)) > 1e-9)) {
    throw new TypeError("星铁抽卡文件的时区偏移无效。");
  }
  return value;
}

function formatWallTime(ms: number): string {
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) throw new TypeError("星铁抽卡文件的时间无效。");
  const iso = date.toISOString();
  if (iso.length !== 24) throw new TypeError("星铁抽卡文件的时间超出四位年份。");
  return iso.slice(0, 19).replace("T", " ");
}

function parseWallTime(value: unknown): { time: string; ms: number } {
  if (typeof value !== "string" || !timePattern.test(value)) throw new TypeError("星铁抽卡时间格式无效。");
  const ms = Date.parse(`${value.replace(" ", "T")}Z`);
  if (formatWallTime(ms) !== value) throw new TypeError("星铁抽卡时间无效。");
  return { time: value, ms };
}

/** Preserve each draw instant when comparing or merging archives in different time zones. */
export function convertStarRailUigfTimezone(archive: StarRailUigfArchive, timezone: number): StarRailUigfArchive {
  const fromMinutes = Math.round(checkTimezone(archive.timezone) * 60);
  const toMinutes = Math.round(checkTimezone(timezone) * 60);
  const delta = (toMinutes - fromMinutes) * 60_000;
  return { ...archive, timezone, records: archive.records.map((row) =>
    ({ ...row, time: formatWallTime(parseWallTime(row.time).ms + delta) })) };
}

function sourceAccount(input: unknown, { uid, legacyServerTime, legacyMiaoServerTime }: StarRailUigfImportOptions) {
  const useServerTime = legacyServerTime ?? legacyMiaoServerTime;
  if (!object(input) || !object(input.info)) throw new TypeError("星铁抽卡文件缺少有效的导出信息。");
  const info = input.info;
  const knownLegacy = typeof info.export_app === "string" && oldExporters.has(info.export_app);
  if (info.version !== undefined) {
    const version = info.version;
    if (version !== "v4.0" && version !== "v4.1" && version !== "v4.2") {
      throw new TypeError("星铁抽卡文件的 UIGF 版本无效。");
    }
    if (!Array.isArray(input.hkrpg)) throw new TypeError("UIGF 文件没有星铁账号列表。");
    const accounts = input.hkrpg.filter((account): account is Record<string, unknown> =>
      object(account) && identifier(account.uid) === uid);
    if (accounts.length !== 1) {
      throw new TypeError("UIGF 文件须恰好包含一个与当前档案 UID 匹配的星铁账号。");
    }
    const account = accounts[0]!;
    const oldWallTime = version === "v4.0" && useServerTime === true;
    const offset = checkTimezone(account.timezone, !oldWallTime);
    return { records: account.list, timezone: oldWallTime ? cnTimezone : offset, lang: text(account.lang),
      allowCollaboration: version !== "v4.0" || knownLegacy };
  }
  if (info.srgf_version !== "v1.0") throw new TypeError("星铁抽卡文件的 SRGF 版本或游戏类型无效。");
  if (identifier(info.uid) !== uid) throw new TypeError("SRGF 文件的 UID 与当前档案不一致。");
  const offset = checkTimezone(info.region_time_zone);
  return { records: input.list, timezone: useServerTime ? cnTimezone : offset, lang: text(info.lang),
    allowCollaboration: knownLegacy };
}

function poolType(value: unknown, allowCollaboration: boolean): StarRailUigfPool {
  const type = identifier(value);
  if (type === "21" || type === "22") {
    if (!allowCollaboration) throw new TypeError("该文件版本不支持星铁联动跃迁，请使用 UIGF v4.1 或更新版本。");
    return type;
  }
  if (type === "1" || type === "2" || type === "11" || type === "12") return type;
  throw new TypeError("星铁抽卡记录的卡池编号无效。");
}

function isLotusPlaceholder(value: unknown): boolean {
  if (!object(value)) return false;
  return /^lotus-/iu.test(text(value.id) ?? "") || text(value.name) === "占位记录" ||
    value.time === "1970-01-01 00:00:00";
}

function readRow(value: unknown, uid: string, allowCollaboration: boolean): StarRailUigfRow {
  if (!object(value)) throw new TypeError("星铁抽卡记录须为对象。");
  const name = text(value.name);
  const id = identifier(value.id);
  if (!id) throw new TypeError("星铁抽卡记录编号无效或精度不足。");
  if (value.uid !== undefined && identifier(value.uid) !== uid) {
    throw new TypeError("星铁抽卡记录的 UID 与当前档案不一致。");
  }
  const gacha_id = identifier(value.gacha_id);
  const item_id = identifier(value.item_id);
  if (!gacha_id || !item_id) throw new TypeError("星铁逐抽记录缺少有效的活动卡池编号或物品编号。");
  const gacha_type = poolType(value.gacha_type, allowCollaboration);
  if (value.uigf_gacha_type !== undefined && identifier(value.uigf_gacha_type) !== gacha_type) {
    throw new TypeError("星铁抽卡记录的标准卡池编号不一致。");
  }
  const { time } = parseWallTime(value.time);
  const item_type = text(value.item_type);
  const rank = identifier(value.rank_type);
  const rank_type = rank === "3" || rank === "4" || rank === "5" ? rank : undefined;
  const count = identifier(value.count);
  if (value.rank_type !== undefined && value.rank_type !== "" && !rank_type) {
    throw new TypeError("星铁抽卡记录的物品星级无效。");
  }
  if (value.count !== undefined && value.count !== "" && !count) throw new TypeError("星铁抽卡记录的物品数量无效。");
  return { uid, id, gacha_id, gacha_type, item_id, time, ...(name ? { name } : {}),
    ...(item_type ? { item_type } : {}), ...(rank_type ? { rank_type } : {}), ...(count ? { count } : {}) };
}

function include(rows: Map<string, StarRailUigfRow>, row: StarRailUigfRow) {
  const current = rows.get(row.id);
  if (!current) {
    rows.set(row.id, row);
    return;
  }
  if (current.gacha_type !== row.gacha_type || current.gacha_id !== row.gacha_id || current.item_id !== row.item_id ||
      current.time !== row.time || (current.count ?? "1") !== (row.count ?? "1") ||
      (current.rank_type && row.rank_type && current.rank_type !== row.rank_type)) {
    throw new TypeError("星铁抽卡文件存在编号相同但内容不同的记录。");
  }
  rows.set(row.id, { ...row, ...current });
}

function readRows(value: unknown, uid: string, allowCollaboration: boolean): StarRailUigfRow[] {
  if (!Array.isArray(value) || !value.length) throw new TypeError("当前星铁档案没有可转换的逐抽记录。");
  if (value.some(isLotusPlaceholder)) {
    throw new TypeError("该星铁文件包含显示占位记录，无法作为真实逐抽记录导入或导出。");
  }
  const rows = new Map<string, StarRailUigfRow>();
  for (const row of value) include(rows, readRow(row, uid, allowCollaboration));
  return [...rows.values()].sort((a, b) => a.id.length - b.id.length || (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
}

export function selectStarRailUigf(input: unknown, options: StarRailUigfImportOptions): StarRailUigfArchive {
  const { uid } = options;
  checkUid(uid);
  const { records, timezone, lang, allowCollaboration } = sourceAccount(input, options);
  return { uid, timezone, ...(lang ? { lang } : {}), records: readRows(records, uid, allowCollaboration) };
}

function validateArchive(input: unknown, uid: string, allowCollaboration: boolean): StarRailUigfArchive {
  checkUid(uid);
  if (!object(input) || input.uid !== uid) throw new TypeError("星铁逐抽档案的 UID 与当前角色不一致。");
  const timezone = checkTimezone(input.timezone);
  const lang = text(input.lang);
  if (input.lang !== undefined && !lang) throw new TypeError("星铁逐抽档案的语言信息无效。");
  return { uid, timezone, ...(lang ? { lang } : {}), records: readRows(input.records, uid, allowCollaboration) };
}

export function validateStarRailUigfArchive(input: unknown, uid: string): StarRailUigfArchive {
  return validateArchive(input, uid, true);
}

export function exportStarRailUigf(archive: StarRailUigfArchive, options: StarRailUigfExportOptions): StarRailUigfDocument {
  const { uid, version = "v4", exportedAt, app } = options;
  const { timezone, lang, records } = validateArchive(archive, uid, version !== "v2");
  if (version === "v4") checkTimezone(timezone, true);
  const list = records.map(({ uid: _uid, ...record }) => record);
  const timestamp = exportedAt.getTime();
  const info: ExportInfo = { export_time: formatWallTime(timestamp + Math.round(timezone * 60) * 60_000),
    export_timestamp: Math.floor(timestamp / 1000), export_app: app.name, export_app_version: app.version };
  if (version === "v2") {
    if (!lang) throw new TypeError("SRGF 导出须有账号语言信息，请使用 UIGF v4 导出。");
    return { info: { ...info, uid, lang, region_time_zone: timezone, srgf_version: "v1.0" }, list };
  }
  if (lang && !languages.has(lang)) throw new TypeError("UIGF v4 无法表示该星铁档案的语言。");
  return { info: { ...info, version: "v4.1" }, hkrpg: [{ uid, timezone, ...(lang ? { lang } : {}), list }] };
}
