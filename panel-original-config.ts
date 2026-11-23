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
