import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readLiteralObjectExport } from "@lotus-yunzai/gacha/literal-exports";
import { renderGachaPoolCard, type GachaPoolCardModel } from "@lotus-yunzai/skia/gacha-pool";
import { readStarRailGachaCatalog, starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { readStarRailGachaSchedule, type StarRailGachaPeriod } from "./gacha-schedule.ts";
import { alias as characterAliases, abbr as characterAbbreviations } from "./panel-theme/character-alias.ts";

const sections = [
  { key: "char5", kind: "characters", star: 5, title: "五星角色" },
  { key: "char4", kind: "characters", star: 4, title: "四星角色" },
  { key: "weapon5", kind: "weapons", star: 5, title: "五星武器" },
  { key: "weapon4", kind: "weapons", star: 4, title: "四星武器" },
] as const;
const version = /^(?:\d+\.)+\d+(?:上半|下半)?$/u;
const legacyReprintCommand = /^#星铁([^\s#\p{Cc}\p{Cf}]{1,60})复刻$/u;
const permanentCharacters = new Set(["姬子", "瓦尔特", "杰帕德", "布洛妮娅", "彦卿", "白露", "克拉拉"]);
const oneDay = 86_400_000;
const help = ["星铁历史卡池", "*3.0卡池 查询整版，*4.1下半卡池 查询单期。",
  "*白厄卡池、*舞舞舞卡池 查看角色或光锥历次入池，末尾加「详情」显示全套卡池。"].join("\n");

type Section = typeof sections[number];
type Kind = Section["kind"];
type CardPeriod = GachaPoolCardModel["pools"][number];
type CardItem = CardPeriod["groups"][number]["rows"][number][number];
type CatalogItem = { readonly card: CardItem; readonly aliases: readonly string[]; readonly id: string };
type Catalog = Readonly<Record<Kind, readonly CatalogItem[]>>;
type StringMap = Readonly<Record<string, string>>;

export function parseStarRailPoolInfo(message: string) {
  const request = message.trim();
  if (/^#星铁卡池(?:帮助)?$/u.test(request)) return { type: "help" } as const;
  const byVersion = /^#星铁((?:\d+\.)+\d+)(上半|下半)?卡池$/u.exec(request);
  if (byVersion?.[1]) return { type: "version", version: byVersion[1], half: byVersion[2] ?? "" } as const;
  const byItem = /^#([^#]{1,65}?)卡池(详情|详细)?$/u.exec(request);
  if (!byItem?.[1] || /^(?:原神|绝区零)/u.test(byItem[1])) return;
  const explicit = byItem[1].startsWith("星铁");
  const item = (explicit ? byItem[1].slice(2) : byItem[1]).trim();
  if (item && item.length <= 60 && !version.test(item)) return { type: "item", item, detail: !!byItem[2], explicit } as const;
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
  return value.normalize("NFKC").toLowerCase().replace(/[·•・\s]/gu, "").replaceAll("『", "「").replaceAll("』", "」");
}

function findItem(items: readonly CatalogItem[], name: string) {
  const key = normalized(name);
  const exact = items.find(({ card, id }) => card.name === name || id === key);
  if (exact) return exact;
  const candidates = items.filter(({ card, aliases }) => [card.name, ...aliases].some((term) => normalized(term) === key));
  return candidates.length === 1 ? candidates[0] : undefined;
}

// The 4.7 first-half source spells the cataloged light cone with this variant.
const sourceNames = new Map([["欢迎来的银河城", "欢迎来到银河城"]]);
function fromPeriod(items: readonly CatalogItem[], name: string) {
  return findItem(items, sourceNames.get(name) ?? name);
}

function fromVersion(value: string) {
  return value.split(".").reduce((total, part) => total * 1000 + Number(part), 0);
}

function sortPeriods(list: StarRailGachaPeriod[]) {
  return list.sort((left, right) => fromVersion(right.version) - fromVersion(left.version) ||
    Number(right.half === "下半") - Number(left.half === "下半"));
}

function poolTime(value: string) {
  return Date.parse(`${value.replace(" ", "T")}+08:00`);
}

function reprint(list: readonly StarRailGachaPeriod[], now: number): GachaPoolCardModel["reprint"] {
  let latestEnd = -Infinity;
  for (const { from, to } of list) {
    const start = poolTime(from), end = poolTime(to);
    if (start <= now && now <= end) return { up: true, days: 0, text: "该角色/武器正在UP" };
    if (end < now) latestEnd = Math.max(latestEnd, end);
  }
  if (!Number.isFinite(latestEnd)) return;
  const days = Math.floor((now - latestEnd) / oneDay);
  return { up: false, days, text: `该角色/武器已 ${days} 天未复刻` };
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
  const [periods, catalog] = await Promise.all([readStarRailGachaSchedule(root), readPoolItems(root)]);
  if (query.type === "version") {
    const selected = sortPeriods(periods.filter((period) => period.version === query.version && (!query.half || period.half === query.half)));
    if (selected.length) return { game: "sr", pools: selected.map((period) => formatPeriod(period, catalog)) };
    return;
  }
  const history = itemHistory(periods, catalog, query.item);
  if (history?.selected.length) return {
    game: "sr", pools: sortPeriods(history.selected).map(period => formatPeriod(period, catalog, query.detail ? undefined : history.target)),
    reprint: reprint(history.selected, now),
  };
}

export async function readStarRailReprint(root: string, item: string, now = Date.now()) {
  const [periods, catalog] = await Promise.all([readStarRailGachaSchedule(root), readPoolItems(root)]);
  const history = itemHistory(periods, catalog, item, item.replace(/老婆|老公|(18|[1-9])[0-9]{8}/gu, ""));
  if (!history) return `未找到 ${item} 的复刻信息。`;
  const name = history.target.card.name;
  if (history.kind === "characters" && permanentCharacters.has(name)) return "常驻角色不支持查询";
  const ordered = history.selected.sort((a, b) => poolTime(b.from) - poolTime(a.from) || poolTime(a.to) - poolTime(b.to));
  const latest = ordered[0];
  if (!latest) return `未找到 ${name} 的复刻信息。`;
  const chinaDay = (time: number) => Math.floor((time + 8 * 3_600_000) / oneDay);
  const today = chinaDay(now);
  const before = chinaDay(poolTime(latest.from)) - today;
  const after = chinaDay(poolTime(latest.to)) - today;
  const status = after < 0 ? `${-after}天未复刻` : before > 0 ? `下期UP，还有${before}天开启卡池`
    : `当期UP，${after ? `还有${after}天` : "今天"}结束卡池`;
  const roster = sections.filter(section => section.kind === history.kind);
  const pools = ordered.map(period => [`所属版本：${period.version} ${period.half}`,
    ...roster.flatMap(({ key, star }) => {
      const names = period[key]?.map(entry => fromPeriod(catalog[history.kind], entry)?.card.name ?? entry);
      return names?.length ? [`${star === 5 ? "五星" : "四星"}UP：${names.join("，")}`] : [];
    }), `开始时间：${period.from}`, `结束时间：${period.to}`].join("\n"));
  return { type: "forward" as const, nodes: [`${name}卡池详情`, status, ...pools] };
}

export async function queryStarRailPoolInfo(message: string, signal: AbortSignal) {
  if (signal.aborted) return;
  const legacy = legacyReprintCommand.exec(message.trim())?.[1];
  if (legacy) {
    const reply = await readStarRailReprint(starRailGachaThemeDirectory(), legacy).catch(() => "星铁历史卡池暂时无法读取，请检查本地卡池资料。");
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
    if (!signal.aborted && explicit) return "星铁历史卡池暂时无法读取，请检查本地卡池资料。";
  }
  if (signal.aborted) return;
  if (!model) return explicit ? `未找到 ${query.type === "version" ? `星铁${query.version}${query.half}` : query.item} 的卡池信息。` : undefined;
  try {
    const { png } = await renderGachaPoolCard(model, { themeDirectory });
    if (!signal.aborted) return { type: "image" as const, file: png };
  } catch {
    if (!signal.aborted) return [model.reprint?.text, ...model.pools.map((period) => {
      const names = period.groups.flatMap((group) => group.rows.flatMap((row) => row.map(({ name }) => name))).join("、");
      return `${period.version} ${period.half} · ${period.from} 至 ${period.to}${names ? `\n${names}` : ""}`;
    })].filter(Boolean).join("\n");
  }
}
