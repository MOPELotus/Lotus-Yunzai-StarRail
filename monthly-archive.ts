import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { join } from "node:path";
import { normalizeStarRailMonthly, type StarRailMonthlySnapshot } from "@lotus-yunzai/hoyo-client";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { readMigrationSourceFile } from "../../lib/migration-files.ts";

export interface StarRailMonthlyIdentity {
  readonly qq: string;
  readonly accountId: string;
  readonly uid: string;
  readonly gameBiz: string;
  readonly region: string;
}

export interface StarRailArchivedMonth {
  readonly key: string;
  readonly snapshot: StarRailMonthlySnapshot;
  readonly finalized: boolean;
  readonly fetchedAt: number;
}

export function starRailMonthlyMonth(key: string) {
  return /^20\d{2}(?:0[1-9]|1[0-2])$/u.test(key) && key >= "202304";
}

function invalid(): never { throw new Error($t("monthly-archive.text_55f7bb8632")); }

function object(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid();
  return raw as Record<string, unknown>;
}

function identityValid({ qq, accountId, uid, gameBiz, region }: StarRailMonthlyIdentity) {
  return /^[1-9]\d{0,19}$/u.test(qq) && /^[1-9]\d{0,19}$/u.test(accountId) && /^[1-5]\d{8}$/u.test(uid) &&
    gameBiz === "hkrpg_cn" && region === (uid.startsWith("5") ? "prod_qd_cn" : "prod_gf_cn");
}

function wire({ monthly, today, yesterday, groups }: StarRailMonthlySnapshot, key: string) {
  return { data_month: key, month_data: { current_hcoin: monthly.hcoin, current_rails_pass: monthly.railsPass,
    group_by: groups.map(({ name, count, action }) => ({ action_name: name, num: count, action })) },
  day_data: { current_hcoin: today.hcoin, current_rails_pass: today.railsPass, last_hcoin: yesterday.hcoin, last_rails_pass: yesterday.railsPass } };
}

function readEntry(raw: unknown, identity: StarRailMonthlyIdentity) {
  const entry = object(raw);
  const { key, finalized, fetchedAt } = entry;
  if (typeof key !== "string" || !starRailMonthlyMonth(key) || typeof finalized !== "boolean" ||
      typeof fetchedAt !== "number" || !Number.isSafeInteger(fetchedAt) || fetchedAt < 1) invalid();
  const snapshot = normalizeStarRailMonthly(entry.data, identity, key);
  if (!snapshot) invalid();
  return { key, snapshot, finalized, fetchedAt };
}

function storeMonth(months: Map<string, StarRailArchivedMonth>, entry: StarRailArchivedMonth) {
  const previous = months.get(entry.key);
  if (previous && (previous.finalized !== entry.finalized ? previous.finalized : previous.fetchedAt > entry.fetchedAt)) return false;
  months.set(entry.key, entry);
  return true;
}

function readCurrent(raw: unknown, identity: StarRailMonthlyIdentity) {
  const months = new Map<string, StarRailArchivedMonth>();
  if (raw === null) return months;
  const saved = object(raw);
  if (saved.version !== 1 || !Array.isArray(saved.months) || Object.entries(identity).some(([key, value]) => saved[key] !== value)) invalid();
  for (const entry of saved.months) storeMonth(months, readEntry(entry, identity));
  return months;
}

function ordered(months: Map<string, StarRailArchivedMonth>) {
  return [...months.values()].sort((left, right) => left.key.localeCompare(right.key));
}

const maxBytes = 4 * 1024 * 1024;
export function createStarRailMonthlyArchive(directory: string, legacyDirectories: readonly string[], lockFile: AcquireRoleArchiveLock) {
  const files = createRoleJsonArchive(directory, lockFile, {
    subject: $t("monthly-archive.text_f2678d5992"), lockSuffix: "starrail-monthly", maxBytes, rejectNull: true,
  });
  return {
    async read(identity: StarRailMonthlyIdentity) {
      if (!identityValid(identity)) invalid();
      const months = new Map<string, StarRailArchivedMonth>();
      for (const legacy of legacyDirectories) {
        const historic = await readMigrationSourceFile(legacy, join(legacy, `${identity.uid}.json`), maxBytes);
        if (!historic) continue;
        const years = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(historic.bytes)));
        for (const [year, entries] of Object.entries(years)) {
          if (!/^20\d{2}$/u.test(year)) invalid();
          for (const [month, value] of Object.entries(object(entries))) {
            const key = year + month.padStart(2, "0");
            if (!starRailMonthlyMonth(key)) invalid();
            const row = object(value);
            if (row.isUpdate !== undefined && typeof row.isUpdate !== "boolean") invalid();
            const snapshot = normalizeStarRailMonthly(row, identity, key);
            if (snapshot) storeMonth(months, { key, finalized: row.isUpdate === true, fetchedAt: 0, snapshot });
          }
        }
      }
      for (const entry of readCurrent(await files.read(identity.qq, identity.uid), identity).values()) storeMonth(months, entry);
      return ordered(months);
    },

    async record(identity: StarRailMonthlyIdentity, entry: StarRailArchivedMonth, verify: () => Promise<void>) {
      if (!identityValid(identity)) invalid();
      const encode = ({ snapshot, key, ...meta }: StarRailArchivedMonth) => ({ ...meta, key, data: wire(snapshot, key) });
      const next = readEntry(encode(entry), identity);
      return files.update(identity, verify, raw => {
        const months = readCurrent(raw, identity);
        if (!storeMonth(months, next)) return { result: false };
        return { document: { version: 1, ...identity, months: ordered(months).map(encode) }, result: true };
      });
    },
  };
}
