import { builtinResourceDirectory } from "../../lib/builtin-resources.ts";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StarRailGachaDetailOptions } from "./gacha-detail.ts";
import type { StarRailRecordItem, StarRailRecordItemResolver } from "./gacha-record-source.ts";

const defaultTheme = builtinResourceDirectory("games/miao");
const legacyTheme = fileURLToPath(new URL("../../data/starrail/miao-theme", import.meta.url));
const missing = new Set(["ENOENT", "ENOTDIR"]);

export function starRailGachaThemeDirectory() {
  const configured = Bun.env.LOTUS_STAR_RAIL_GACHA_THEME_DIR?.trim();
  if (configured) return configured;
  return existsSync(defaultTheme) || !existsSync(legacyTheme) ? defaultTheme : legacyTheme;
}

function isSegment(value: unknown): value is string {
  return typeof value === "string" && !!value && value !== "." && value !== ".." && !/[\/\\\0]/u.test(value);
}

type ResolveItem = NonNullable<StarRailGachaDetailOptions["resolveItem"]>;
type Item = NonNullable<ReturnType<ResolveItem>> & { readonly rank?: StarRailRecordItem["rank"] };

async function itemCatalog(root: string, category: "character" | "weapon") {
  const filename = join(root, "meta-sr", category, "data.json");
  const result = new Map<string, Item>();
  try {
    const rows: unknown = JSON.parse(await readFile(filename, "utf8"));
    if (!rows || typeof rows !== "object" || Array.isArray(rows)) return result;
    for (const [id, row] of Object.entries(rows)) {
      if (!/^\d+$/u.test(id) || !row || typeof row !== "object") continue;
      const { name, abbr, type, star } = row;
      if (!isSegment(name) || (category === "weapon" && !isSegment(type))) continue;
      result.set(id, {
        id: category === "character" ? Number(id) : id,
        name, abbr: name.length > (category === "character" ? 3 : 4) && typeof abbr === "string" && abbr ? abbr : name,
        rank: star === 3 || star === 4 || star === 5 ? star : undefined,
        img: category === "character" ? `/meta-sr/character/${name}/imgs/face.webp` : `meta-sr/weapon/${type}/${name}/icon.webp`,
      });
    }
  } catch (error) {
    if (!(error instanceof SyntaxError) && !missing.has((error as NodeJS.ErrnoException).code ?? "")) throw error;
  }
  return result;
}

export async function readStarRailGachaCatalog(root: string) {
  const [characters, weapons] = await Promise.all([itemCatalog(root, "character"), itemCatalog(root, "weapon")]);
  return { characters, weapons };
}

type GachaCatalog = Awaited<ReturnType<typeof readStarRailGachaCatalog>>;

export async function readStarRailRecordItems(root: string, catalog?: GachaCatalog): Promise<StarRailRecordItemResolver> {
  const { characters, weapons } = catalog ?? await readStarRailGachaCatalog(root);
  const items = new Map<string, StarRailRecordItem>();
  for (const [entries, kind] of [[characters, "char"], [weapons, "weapon"]] as const) {
    for (const item of entries.values()) {
      const id = String(item.id);
      items.set(id, { ...item, id, img: item.img ?? "", kind });
    }
  }
  return (id) => items.get(id);
}

export async function readStarRailGachaItems(root: string, catalog?: GachaCatalog) {
  const { characters, weapons } = catalog ?? await readStarRailGachaCatalog(root);
  const characterNames = new Map([...characters.values()].map((item) => [item.name, item]));
  const weaponNames = new Map([...weapons.values()].map((item) => [item.name, item]));
  return ({ name, item_type }: Pick<Parameters<ResolveItem>[0], "name" | "item_type">) => {
    const character = item_type === "角色";
    const names = character ? characterNames : weaponNames;
    const exact = names.get(name);
    if (exact) return exact;
    const variants = character ? /[·•・]/u : /[『』「」]/u;
    if (!variants.test(name)) return;
    const normalize = character ? (title: string) => title.replace(/[•・]/gu, "·")
      : (title: string) => title.replaceAll("『", "「").replaceAll("』", "」");
    const requested = normalize(name);
    const candidates = [...names.values()].filter((item) => normalize(item.name) === requested);
    const item = candidates.length === 1 ? candidates[0] : undefined;
    if (item) return { ...item, name, abbr: item.abbr === item.name ? name : item.abbr };
  };
}
