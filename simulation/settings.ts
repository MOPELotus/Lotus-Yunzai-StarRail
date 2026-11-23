import { join } from "node:path";
import { createRoleJsonArchive, type AcquireRoleArchiveLock } from "@lotus-yunzai/storage";
import { integer, warpStateDirectory } from "./store.ts";

export const defaultWarpRates = {
  characterFive: 60, characterFour: 510, coneFive: 80, coneFour: 660, featuredFive: null as number | null,
};

export const defaultWarpAllowance = { special: 100, regular: 10, recallSeconds: 30 };

export type WarpRates = typeof defaultWarpRates;
export type WarpAllowance = typeof defaultWarpAllowance;
export type WarpPoolNames = Partial<Record<"characterFive" | "characterFour" | "coneFive" | "coneFour", readonly string[]>>;

export interface WarpSettings {
  enabled: boolean;
  multiple: boolean;
  weeklyBonus: boolean;
  automaticPools: boolean;
  reincarnationMinutes: number;
  allowance: WarpAllowance;
  groups: Record<string, Partial<WarpAllowance>>;
  rates: WarpRates;
  poolNames: WarpPoolNames;
}

export const defaultWarpSettings = (): WarpSettings => ({
  enabled: true, multiple: true, weeklyBonus: true, automaticPools: true, reincarnationMinutes: 120,
  allowance: { ...defaultWarpAllowance }, groups: {}, rates: { ...defaultWarpRates }, poolNames: {},
});

function invalid(): never {
  throw new TypeError("星铁模拟跃迁设置无效。");
}

function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Object.getPrototypeOf(raw) !== Object.prototype) invalid();
  return raw as Record<string, unknown>;
}

export function validWarpPoolName(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && [...value].length >= 1 &&
    [...value].length <= 60 && !/[\u0000-\u001f\u007f]/u.test(value);
}

const allowanceFields = { special: [1, 10_000], regular: [1, 10_000], recallSeconds: [0, 120] } as const;
function allowance(raw: unknown, complete: boolean) {
  const input = record(raw), parsed: Partial<WarpAllowance> = {};
  for (const key of Object.keys(input)) if (!Object.hasOwn(allowanceFields, key)) invalid();
  for (const key of Object.keys(allowanceFields) as (keyof WarpAllowance)[]) {
    if (!complete && !Object.hasOwn(input, key)) continue;
    const [min, max] = allowanceFields[key];
    const value = input[key];
    if (!integer(value, max) || value < min) invalid();
    parsed[key] = value;
  }
  return parsed;
}

export function parseWarpSettings(raw: unknown): WarpSettings {
  const { enabled, multiple, weeklyBonus, automaticPools, reincarnationMinutes, allowance: defaultAllowance,
    groups: rawGroups, rates: rawRates, poolNames: rawPools } = record(raw);
  if (typeof enabled !== "boolean" || typeof multiple !== "boolean" || typeof weeklyBonus !== "boolean" ||
      typeof automaticPools !== "boolean" || !integer(reincarnationMinutes, 1440) || reincarnationMinutes < 1) invalid();
  const groups: WarpSettings["groups"] = {};
  const inputGroups = Object.entries(record(rawGroups));
  if (inputGroups.length > 2048) invalid();
  for (const [group, value] of inputGroups) {
    if (!/^[1-9]\d*$/u.test(group) || !integer(Number(group))) invalid();
    groups[group] = allowance(value, false);
  }
  const { characterFive, characterFour, coneFive, coneFour, featuredFive } = record(rawRates);
  if (!integer(characterFive, 10_000) || !integer(characterFour, 10_000) || !integer(coneFive, 10_000) ||
      !integer(coneFour, 10_000) || (featuredFive !== null && !integer(featuredFive, 100))) invalid();
  const poolNames: WarpPoolNames = {};
  for (const [key, names] of Object.entries(record(rawPools))) {
    if (key !== "characterFive" && key !== "characterFour" && key !== "coneFive" && key !== "coneFour") invalid();
    if (!Array.isArray(names) || !names.length || names.length > (key.endsWith("Five") ? 4 : 20) ||
        !names.every(validWarpPoolName) || new Set(names).size !== names.length) invalid();
    poolNames[key] = names;
  }
  return { enabled, multiple, weeklyBonus, automaticPools, reincarnationMinutes, groups, poolNames,
    allowance: { ...defaultWarpAllowance, ...allowance(defaultAllowance, true) },
    rates: { characterFive, characterFour, coneFive, coneFour, featuredFive } };
}

const id = { qq: "1", uid: "1" } as const;
export function createWarpSettingsStore(lock: AcquireRoleArchiveLock, directory = warpStateDirectory()) {
  const archive = createRoleJsonArchive(join(directory, "settings"), lock, {
    subject: "星铁模拟跃迁设置", lockSuffix: "warp-settings", maxBytes: 512 * 1024, rejectNull: true,
  });
  const decode = (raw: unknown) => raw === null ? defaultWarpSettings() : parseWarpSettings(raw);
  return {
    async read() { return decode(await archive.read(id.qq, id.uid)); },
    async update(change: (current: WarpSettings) => WarpSettings, verify?: () => Promise<void>) {
      return archive.update(id, verify ?? (async () => {}), raw => {
        const document = parseWarpSettings(change(decode(raw)));
        return { document, result: document };
      });
    },
  };
}

export function readWarpAllowance(settings: WarpSettings, group?: string): WarpAllowance {
  return { ...settings.allowance, ...(group && Object.hasOwn(settings.groups, group) ? settings.groups[group] : {}) };
}
