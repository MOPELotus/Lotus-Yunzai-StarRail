import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readLiteralObjectExport } from "@lotus-yunzai/gacha/literal-exports";
import { renderGachaPoolCard, type GachaPoolCardModel } from "@lotus-yunzai/skia/gacha-pool";
import { readStarRailGachaCatalog, starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { readStarRailGachaSchedule, type StarRailGachaPeriod } from "./gacha-schedule.ts";
import { alias as characterAliases, abbr as characterAbbreviations } from "./panel-theme/character-alias.ts";

const sections = [
  { key: "char5", kind: "characters", star: 5, title: $t("gacha-pool-info.text_6c7911d1da") },
  { key: "char4", kind: "characters", star: 4, title: $t("gacha-pool-info.text_2ae9e8f1f1") },
  { key: "weapon5", kind: "weapons", star: 5, title: $t("gacha-pool-info.text_77eeb23906") },
  { key: "weapon4", kind: "weapons", star: 4, title: $t("gacha-pool-info.text_2388a52b6d") },
] as const;
const version = /^(?:\d+\.)+\d+(?:上半|下半)?$/u;
const legacyReprintCommand = /^#星铁([^\s#\p{Cc}\p{Cf}]{1,60})复刻$/u;
const permanentCharacters = new Set(["姬子", "瓦尔特", "杰帕德", "布洛妮娅", "彦卿", "白露", "克拉拉"]);
const oneDay = 86_400_000;
// First Fate collaboration roster from thisee/xhh at f898ce6d08ee7a09bede98ef6e9f493d770560d0.
// Version 3.4 official update confirms the July 11 opening time (HoYoverse news 157441).
const firstCollaboration: StarRailGachaPeriod = {
  version: $t("gacha-pool-info.text_95629ac9b8"), half: "", from: "2025-07-11 12:00:00", to: $t("gacha-pool-info.text_4d8c1c5b42"),
  char5: ["Saber", "Archer"], weapon5: [$t("gacha-pool-info.text_2045afcf6d"), $t("gacha-pool-info.text_a3005ad0ea")],
};
const help = [$t("gacha-pool-info.text_b8a667f3bf"), $t("gacha-pool-info.text_f91a1a629a"),
  $t("gacha-pool-info.text_9162a352d2"),
  $t("gacha-pool-info.text_17703a2f99")].join("\n");

type Section = typeof sections[number];
type Kind = Section["kind"];
type CardPeriod = GachaPoolCardModel["pools"][number];
type CardItem = CardPeriod["groups"][number]["rows"][number][number];
type CatalogItem = { readonly card: CardItem; readonly aliases: readonly string[]; readonly id: string };
type Catalog = Readonly<Record<Kind, readonly CatalogItem[]>>;
type StringMap = Readonly<Record<string, string>>;

export function parseStarRailPoolInfo(message: string) {
  const request = message.trim().replace(/^#*\*(?:星铁)?/u, "#星铁").replace(/^#+/u, "#");
  if (/^#?星铁卡池(?:帮助)?$/u.test(request)) return { type: "help" } as const;
  const byVersion = /^#?星铁((?:\d+\.)+\d+)(上半|下半)?(?:卡池|跃迁)$/u.exec(request);
  if (byVersion?.[1]) return { type: "version", version: byVersion[1], half: byVersion[2] ?? "" } as const;
  const byItem = /^#?([^#]{1,65}?)(卡池|跃迁)(详情|详细)?$/u.exec(request);
  if (!byItem?.[1] || /^(?:原神|绝区零)/u.test(byItem[1])) return;
  const explicit = byItem[1].startsWith("星铁");
  const item = (explicit ? byItem[1].slice(2) : byItem[1]).trim();
  if (normalized(item) === "联动") return { type: "collaboration", explicit } as const;
  if (item && item.length <= 60 && !version.test(item)) {
    return { type: "item", item, detail: byItem[2] === "跃迁" || !!byItem[3], explicit } as const;
  }
}

type Query = Exclude<NonNullable<ReturnType<typeof parseStarRailPoolInfo>>, { readonly type: "help" }>;

async function readPoolItems(root: string): Promise<Catalog> {
  const [metadata, weaponSource] = await Promise.all([
    readStarRailGachaCatalog(root),
    readFile(join(root, "meta-sr", "weapon", "alias.js"), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return "";
      throw error;
    }),
  ]);
  const weaponAliases = readLiteralObjectExport(weaponSource, "aliasCfg") ?? {};
  const weaponAbbreviations = readLiteralObjectExport(weaponSource, "abbr") ?? {};
  function group(kind: Kind, aliases: StringMap, abbreviations: StringMap) {
    return [...metadata[kind].values()].flatMap(({ id, name, img, abbr, rank }) => rank === 4 || rank === 5 ? [{
      id: String(id), card: { name, abbr: abbreviations[name] || abbr, img: img ?? "", star: rank },
      aliases: [abbreviations[name], abbr, ...(aliases[name] ?? "").split(",")].filter((part): part is string => typeof part === "string" && !!part),
    }] : []);
  }
  return {
    characters: group("characters", characterAliases, characterAbbreviations),
    weapons: group("weapons", weaponAliases, weaponAbbreviations),
  };
}

function normalized(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[·•・,!『』「」\s]/gu, "");
}

function findItem(items: readonly CatalogItem[], name: string) {
  const key = normalized(name);
  const exact = items.find(({ card, id }) => card.name === name || id === key);
  if (exact) return exact;
  const candidates = items.filter(({ card, aliases }) => [card.name, ...aliases].some((term) => normalized(term) === key));
  return candidates.length === 1 ? candidates[0] : undefined;
}

// The 4.7 first-half source spells the cataloged light cone with this variant.
const sourceNames = new Map([["欢迎来的银河城", $t("gacha-pool-info.text_ac54764660")]]);
function fromPeriod(items: readonly CatalogItem[], name: string) {
  return findItem(items, sourceNames.get(name) ?? name);
}

function fromVersion(value: string) {
  return value.split(".").reduce((total, part) => total * 1000 + Number(part), 0);
}

function sortPeriods(list: StarRailGachaPeriod[]) {
  return list.sort((left, right) => {
    if (left === firstCollaboration || right === firstCollaboration) return poolTime(right.from) - poolTime(left.from);
    return fromVersion(right.version) - fromVersion(left.version) || Number(right.half === "下半") - Number(left.half === "下半");
  });
}

function includesFirstCollaboration(version: string) {
  const [major, minor] = version.split(".").map(Number);
  return major! > 3 || major === 3 && minor! >= 4;
}

function withFirstCollaboration(catalog: Catalog): Catalog {
  function append(kind: Kind, names: readonly string[], ids: readonly string[], aliases: StringMap, abbreviations: StringMap = {}) {
    return [...catalog[kind], ...names.flatMap((name, index) => findItem(catalog[kind], name) ? [] : [{
      id: ids[index]!, card: { name, abbr: abbreviations[name] ?? name, star: 5 as const },
      aliases: (aliases[name] ?? "").split(",").filter(Boolean),
    }])];
  }
  return {
    characters: append("characters", firstCollaboration.char5, ["1014", "1015"], characterAliases, characterAbbreviations),
    weapons: append("weapons", firstCollaboration.weapon5, ["23045", "23046"],
      { "没有回报的加冕": $t("gacha-pool-info.text_a01be619e7"), "理想燃烧的地狱": $t("gacha-pool-info.text_41f2c42f94") }),
  };
}

function poolTime(value: string) {
  return Date.parse(`${value.replace(" ", "T")}+08:00`);
}

function reprint(list: readonly StarRailGachaPeriod[], now: number): GachaPoolCardModel["reprint"] {
  let latestEnd = -Infinity;
  let unknownEnd = false;
  for (const { from, to } of list) {
    const start = poolTime(from), end = poolTime(to);
    if (start <= now && now <= end) return { up: true, days: 0, text: $t("gacha-pool-info.text_76977879b7") };
    if (start <= now && !Number.isFinite(end)) unknownEnd = true;
    if (end < now) latestEnd = Math.max(latestEnd, end);
  }
  if (unknownEnd || !Number.isFinite(latestEnd)) return;
  const days = Math.floor((now - latestEnd) / oneDay);
  return { up: false, days, text: $t("gacha-pool-info.text_236a3fcfdf", { "days": days }) };
}

function formatPeriod(period: StarRailGachaPeriod, catalog: Catalog, target?: CatalogItem): CardPeriod {
  const groups = sections.flatMap(({ key, kind, star, title }) => {
    const items = (period[key] ?? []).flatMap((name) => {
      const item = fromPeriod(catalog[kind], name);
      return item ? [item] : [];
    });
    if (!items.length || (target && !items.includes(target))) return [];
    const rows = [];
    for (let start = 0; start < items.length; start += 8) rows.push(items.slice(start, start + 8).map(({ card }) => card));
    return [{ title, star, rows }];
  });
  return { version: period.version, half: period.half, from: period.from, to: period.to, isMix: false, groups };
}

function itemHistory(periods: readonly StarRailGachaPeriod[], catalog: Catalog, item: string, character = item) {
  const role = findItem(catalog.characters, character);
  const target = role ?? findItem(catalog.weapons, item);
  if (!target) return;
  const kind: Kind = role ? "characters" : "weapons";
  const keys = sections.filter(section => section.kind === kind).map(section => section.key);
  const selected = periods.filter(period => keys.some(key => period[key]?.some(name => fromPeriod(catalog[kind], name) === target)));
  return { kind, target, selected };
}

export async function readStarRailPoolInfo(root: string, query: Query, now = Date.now()): Promise<GachaPoolCardModel | undefined> {
  const [periods, items] = await Promise.all([readStarRailGachaSchedule(root), readPoolItems(root)]);
  const catalog = withFirstCollaboration(items);
  if (query.type === "collaboration") return { game: "sr", pools: [formatPeriod(firstCollaboration, catalog)] };
  if (query.type === "version") {
    const selected = sortPeriods(periods.filter((period) => period.version === query.version && (!query.half || period.half === query.half)));
    if (!selected.length) return;
    if (includesFirstCollaboration(query.version)) selected.push(firstCollaboration);
    return { game: "sr", pools: selected.map((period) => formatPeriod(period, catalog)) };
  }
  const history = itemHistory([...periods, firstCollaboration], catalog, query.item);
  if (history?.selected.length) return {
    game: "sr", pools: sortPeriods(history.selected).map(period => formatPeriod(period, catalog, query.detail ? undefined : history.target)),
    reprint: reprint(history.selected, now),
  };
}

export async function readStarRailReprint(root: string, item: string, now = Date.now()) {
  const [periods, catalog] = await Promise.all([readStarRailGachaSchedule(root), readPoolItems(root)]);
  const history = itemHistory(periods, catalog, item, item.replace(/老婆|老公|(18|[1-9])[0-9]{8}/gu, ""));
  if (!history) return $t("gacha-pool-info.text_3a8943e7ca", { "item": item });
  const name = history.target.card.name;
  if (history.kind === "characters" && permanentCharacters.has(name)) return $t("gacha-pool-info.text_169eb52154");
  const ordered = history.selected.sort((a, b) => poolTime(b.from) - poolTime(a.from) || poolTime(a.to) - poolTime(b.to));
  const latest = ordered[0];
  if (!latest) return $t("gacha-pool-info.text_358d1b8102", { "name": name });
  const chinaDay = (time: number) => Math.floor((time + 8 * 3_600_000) / oneDay);
  const today = chinaDay(now);
  const before = chinaDay(poolTime(latest.from)) - today;
  const after = chinaDay(poolTime(latest.to)) - today;
  const status = after < 0 ? $t("gacha-pool-info.text_d7693df1b7", { "value1": -after }) : before > 0 ? $t("gacha-pool-info.text_3a82d6e00c", { "before": before })
    : $t("gacha-pool-info.text_cd98cf1512", { "value1": after ? $t("gacha-pool-info.text_d524130036", { "after": after }) : $t("gacha-pool-info.text_d5f5a7a010") });
  const roster = sections.filter(section => section.kind === history.kind);
  const pools = ordered.map(period => [$t("gacha-pool-info.text_55b639ccd9", { "version": period.version, "half": period.half }),
    ...roster.flatMap(({ key, star }) => {
      const names = period[key]?.map(entry => fromPeriod(catalog[history.kind], entry)?.card.name ?? entry);
      return names?.length ? [`${star === 5 ? $t("gacha-pool-info.text_789a6953ec") : $t("gacha-pool-info.text_1077b809a5")}UP：${names.join("，")}`] : [];
    }), $t("gacha-pool-info.text_a0169e92ef", { "from": period.from }), $t("gacha-pool-info.text_7ed2671010", { "to": period.to })].join("\n"));
  return { type: "forward" as const, nodes: [$t("gacha-pool-info.text_df9624fa97", { "name": name }), status, ...pools] };
}

export async function queryStarRailPoolInfo(message: string, signal: AbortSignal) {
  if (signal.aborted) return;
  const legacy = legacyReprintCommand.exec(message.trim())?.[1];
  if (legacy) {
    const reply = await readStarRailReprint(starRailGachaThemeDirectory(), legacy).catch(() => $t("gacha-pool-info.text_ab8bdabd13"));
    if (!signal.aborted) return reply;
    return;
  }
  const query = parseStarRailPoolInfo(message);
  if (!query) return;
  if (query.type === "help") return help;
  const themeDirectory = starRailGachaThemeDirectory();
  const explicit = query.type === "version" || query.explicit;
  let model;
  try {
    model = await readStarRailPoolInfo(themeDirectory, query);
  } catch {
    if (!signal.aborted && explicit) return $t("gacha-pool-info.text_ab8bdabd13");
  }
  if (signal.aborted) return;
  if (!model) return explicit ? $t("gacha-pool-info.text_006da0c482", { "value1": query.type === "version" ? $t("gacha-pool-info.text_cea61f8f9e", { "version": query.version, "half": query.half }) : query.type === "collaboration" ? $t("gacha-pool-info.text_77c68989a8") : query.item }) : undefined;
  try {
    const { png } = await renderGachaPoolCard(model, { themeDirectory });
    if (!signal.aborted) return { type: "image" as const, file: png };
  } catch {
    if (!signal.aborted) return [model.reprint?.text, ...model.pools.map((period) => {
      const names = period.groups.flatMap((group) => group.rows.flatMap((row) => row.map(({ name }) => name))).join("、");
      const title = [period.version, period.half].filter(Boolean).join(" ");
      return $t("gacha-pool-info.text_cb974a6df3", { "title": title, "from": period.from, "to": period.to, "value4": names ? `\n${names}` : "" });
    })].filter(Boolean).join("\n");
  }
}
