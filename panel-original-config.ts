import { readOptionalConfigFile, readOptionalLocalConfig } from "../../lib/config.ts";

const legacySettings = ["plugins/StarRail-plugin/config/PanelSetting.yaml", "backup/plugins/StarRail-plugin/config/PanelSetting.yaml"];
export const maxStarRailOriginalRecallSeconds = 120;

export function validStarRailOriginalRecallSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maxStarRailOriginalRecallSeconds;
}

function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export async function readStarRailOriginalSettings(root: URL) {
  const global = await readOptionalLocalConfig(root, "global");
  const raw = global?.starrail;
  const current = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : undefined;
  const currentSeconds = current?.back_call_original_pic_time;
  let legacy: Awaited<ReturnType<typeof readOptionalConfigFile>>;
  if (typeof current?.original_pic !== "boolean" || typeof current?.back_call_original_pic !== "boolean" ||
    !validStarRailOriginalRecallSeconds(currentSeconds)) {
    for (const path of legacySettings) {
      try { legacy = await readOptionalConfigFile(root, path); }
      catch { break; }
      if (legacy !== undefined) break;
    }
  }
  const legacySeconds = legacy?.backCalloriginalPicTime;
  return {
    starrailOriginalEnabled: boolean(current?.original_pic, legacy?.originalPic !== false),
    starrailOriginalRecall: boolean(current?.back_call_original_pic, legacy?.backCalloriginalPic !== false),
    starrailOriginalRecallSeconds: validStarRailOriginalRecallSeconds(currentSeconds) ? currentSeconds :
      validStarRailOriginalRecallSeconds(legacySeconds) ? legacySeconds : 30,
  };
}

const installation = new URL("../../", import.meta.url);
const maxGroups = 1000;

function normalizeGroupIds(values: readonly unknown[]) {
  if (values.length > maxGroups) return;
  const groups = new Set<string>();
  for (const value of values) {
    if (typeof value !== "number" && typeof value !== "string") return;
    const id = String(value).trim();
    if (!/^[1-9]\d{0,15}$/u.test(id) || !Number.isSafeInteger(Number(id))) return;
    groups.add(id);
  }
  return [...groups];
}

export function parseStarRailPortraitGroups(value: unknown) {
  if (typeof value !== "string" || value.length > maxGroups * 18) return;
  return normalizeGroupIds(value.trim().split(/[\s,，、]+/u).filter(Boolean));
}

export async function readStarRailBuiltInPortraitGroups(root = installation) {
  const config = await readOptionalLocalConfig(root, "global");
  const section = config?.starrail;
  const selected = section && typeof section === "object" && !Array.isArray(section)
    ? (section as Record<string, unknown>).built_in_portrait_groups : undefined;
  if (Array.isArray(selected)) {
    const groups = normalizeGroupIds(selected);
    if (groups) return groups;
  }
  for (const path of legacySettings) {
    try {
      const legacy = await readOptionalConfigFile(root, path);
      if (!legacy) continue;
      return Array.isArray(legacy.no_profile) ? normalizeGroupIds(legacy.no_profile) ?? [] : [];
    } catch { break; }
  }
  return [];
}

export async function starRailUsesBuiltInPortrait(context?: { readonly message_type?: string; readonly group_id?: number },
  root = installation) {
  return context?.message_type === "group" && Number.isSafeInteger(context.group_id) &&
    (await readStarRailBuiltInPortraitGroups(root).catch((): string[] => [])).includes(String(context.group_id));
}
