import { join } from "node:path";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { integer, warpStateDirectory } from "./store.ts";

export interface IndependentWarpSettings {
  readonly enabled: boolean;
  readonly group: boolean;
  readonly private: boolean;
  readonly dailyTenPulls: number;
  readonly disabledGroups: readonly string[];
  readonly recallSeconds: number;
}

export function defaultIndependentWarpSettings(): IndependentWarpSettings {
  return { enabled: false, group: true, private: true, dailyTenPulls: 1, disabledGroups: [], recallSeconds: 110 };
}

function record(input: unknown): Record<string, unknown> | undefined {
  return input && typeof input === "object" && Object.getPrototypeOf(input) === Object.prototype
    ? input as Record<string, unknown> : undefined;
}

function canonicalGroup(value: unknown) {
  const text = typeof value === "number" || typeof value === "string" ? String(value) : "";
  return /^[1-9]\d*$/u.test(text) && integer(Number(text)) ? text : undefined;
}

export function parseIndependentWarpSettings(input: unknown): IndependentWarpSettings {
  const data = record(input);
  if (typeof data?.enabled !== "boolean" || typeof data.group !== "boolean" || typeof data.private !== "boolean" || !integer(data.dailyTenPulls) ||
      !integer(data.recallSeconds, 2_147_483) || !Array.isArray(data.disabledGroups) ||
      !data.disabledGroups.every(value => typeof value === "string" && canonicalGroup(value) === value) ||
      new Set(data.disabledGroups).size !== data.disabledGroups.length) {
    throw new TypeError("独立星铁旧模拟跃迁配置无效。");
  }
  return { enabled: data.enabled, group: data.group, private: data.private, dailyTenPulls: data.dailyTenPulls,
    recallSeconds: data.recallSeconds, disabledGroups: data.disabledGroups };
}

export function convertIndependentWarpSettings(defaults: unknown, overrides: unknown): IndependentWarpSettings {
  const base = record(defaults), local = record(overrides);
  if ((defaults !== undefined && !base) || (overrides !== undefined && !local)) {
    throw new TypeError("独立星铁旧模拟跃迁 YAML 无效。");
  }
  // The former loader replaced nested blocks as a whole when the operator supplied them.
  const merged = { limit: { group: true, private: true, count: 1 }, recall: { enable: true, time: 110 },
    disable_group: [], ...base, ...local };
  const limit = record(merged.limit), recall = record(merged.recall);
  const disabled = merged.disable_group ?? [];
  if (!limit || !recall || !Array.isArray(disabled) || !disabled.every(value => canonicalGroup(value)) ||
      (limit.group !== undefined && typeof limit.group !== "boolean") ||
      (limit.private !== undefined && typeof limit.private !== "boolean") ||
      (recall.enable !== undefined && typeof recall.enable !== "boolean") ||
      (recall.time !== undefined && !integer(recall.time, 2_147_483)) ||
      (limit.count !== undefined && !integer(limit.count))) {
    throw new TypeError("独立星铁旧模拟跃迁 YAML 无效。");
  }
  return parseIndependentWarpSettings({
    enabled: true, group: limit.group === true, private: limit.private === true, dailyTenPulls: limit.count ?? 0,
    recallSeconds: recall.enable === true ? recall.time || 110 : 0,
    disabledGroups: [...new Set(disabled.map(canonicalGroup))],
  });
}

export function createIndependentWarpSettingsStore(lock: AcquireRoleArchiveLock, directory = warpStateDirectory()) {
  const archive = createRoleJsonArchive(join(directory, "independent-settings"), lock, {
    subject: "独立星铁模拟跃迁设置", lockSuffix: "independent-warp-settings", maxBytes: 512 * 1024, rejectNull: true,
  });
  const id = { qq: "1", uid: "1" };
  const decode = (input: unknown) => input === null ? defaultIndependentWarpSettings() : parseIndependentWarpSettings(input);
  return {
    async read() { return decode(await archive.read(id.qq, id.uid)); },
    async update(change: (previous: IndependentWarpSettings) => IndependentWarpSettings, verify: () => Promise<void>) {
      return archive.update(id, verify, input => {
        const document = parseIndependentWarpSettings(change(decode(input)));
        return { document, result: document };
      });
    },
  };
}
