import { readOptionalConfigFile, readOptionalLocalConfig } from "../../lib/config.ts";

export type GridFightRecentCount = 1 | 2 | 3;
const defaultGridFightRecentCount: GridFightRecentCount = 2;

function count(value: unknown): GridFightRecentCount {
  const parsed = typeof value === "string" ? value.trim() : value;
  if (parsed === 1 || parsed === "1") return 1;
  if (parsed === 3 || parsed === "3") return 3;
  return defaultGridFightRecentCount;
}

export async function readGridFightRecentCount(root = new URL("../../", import.meta.url)): Promise<GridFightRecentCount> {
  try {
    const config = await readOptionalLocalConfig(root, "global");
    const section = config?.starrail;
    if (section && typeof section === "object" && Object.hasOwn(section, "grid_fight_recent_count")) {
      return count((section as Record<string, unknown>).grid_fight_recent_count);
    }
    return count((await readOptionalConfigFile(root, "plugins/xhh/config/config.yaml"))?.huobi_num);
  } catch {
    return defaultGridFightRecentCount;
  }
}
