import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { alias, abbr } from "./panel-theme/character-alias.js";
import { object, officialArtHosts, text, whole, type PanelAvatar, type PanelSnapshot } from "./panel-model.ts";

const packagedTheme = fileURLToPath(new URL("./panel-theme/", import.meta.url));
const defaultTheme = fileURLToPath(new URL("../../data/starrail/miao-theme", import.meta.url));
const aliases: Readonly<Record<string, string>> = alias;
const shortNames: Readonly<Record<string, string>> = abbr;
const normalizeName = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[·・•\s]/gu, "");
const statTitles: Readonly<Record<string, string>> = {
  hp: "生命值", hpPlus: "生命值", hpPct: "生命值", atk: "攻击力", atkPlus: "攻击力", atkPct: "攻击力",
  def: "防御力", defPlus: "防御力", defPct: "防御力", speed: "速度", cpct: "暴击率", cdmg: "暴击伤害",
  recharge: "能量恢复效率", heal: "治疗量加成", effPct: "效果命中", effDef: "效果抵抗", stance: "击破特攻",
  phy: "物理伤害提高", fire: "火伤害提高", ice: "冰伤害提高", elec: "雷伤害提高", wind: "风伤害提高",
  quantum: "量子伤害提高", imaginary: "虚数伤害提高",
};
const elementDamage: Readonly<Record<string, string>> = {
  物理: "phy", 火: "fire", 冰: "ice", 雷: "elec", 风: "wind", 量子: "quantum", 虚数: "imaginary",
};
const showcaseKeys = ["hp", "atk", "def", "speed", "cpct", "cdmg", "dmg", "stance", "effPct", "effDef", "heal", "joy"];
type Metadata = NonNullable<Awaited<ReturnType<typeof readTheme>>>;
type Json = Record<string, unknown>;
type Stat = PanelAvatar["stats"][number];

function cssFile(path: string) {
  return pathToFileURL(path).href.replaceAll("(", "%28").replaceAll(")", "%29").replaceAll("'", "%27");
}

function safePart(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." && !/[\/\\\p{Cc}]/u.test(value);
}

async function readJson(file: string): Promise<Json> {
  try {
    if ((await stat(file)).size > 8 * 1024 * 1024) return {};
    return object(JSON.parse(await readFile(file, "utf8"))) ?? {};
  } catch {
    return {};
  }
}

export async function readTheme(directory = Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR?.trim() || Bun.env.LOTUS_STAR_RAIL_GACHA_THEME_DIR?.trim() || defaultTheme) {
  const root = resolve(directory);
  const lists = join(root, "meta-sr");
  const [characters, weapons, relics, relicValues, defaultStyle] = await Promise.all([
    readJson(join(lists, "character", "data.json")), readJson(join(lists, "weapon", "data.json")),
    readJson(join(lists, "artifact", "data.json")), readJson(join(lists, "artifact", "meta.json")),
    Bun.file(join(root, "common", "common.css")).exists(),
  ]);
  const relicById = new Map<string, { name: string; asset: readonly string[] }>();
  for (const value of Object.values(relics)) {
    const row = object(value);
    if (!safePart(row?.name)) continue;
    for (const [slot, entry] of Object.entries(object(row?.idxs) ?? {})) {
      const part = object(entry), name = text(part?.name);
      if (!name || !/^[1-6]$/u.test(slot)) continue;
      for (const itemId of Object.keys(object(part?.ids) ?? {})) {
        if (/^[1-9]\d{0,11}$/u.test(String(itemId))) {
          relicById.set(String(itemId), { name, asset: ["artifact", row.name, `arti-${slot}.webp`] });
        }
      }
    }
  }
  return { root, defaultStyle, characters, weapons, relicById, relicValues };
}

function lookup(avatar: PanelAvatar, theme: Metadata) {
  const meta = object(theme.characters[avatar.id]);
  const name = text(meta?.name) || avatar.name;
  return { meta, name, abbr: text(meta?.abbr) || shortNames[name] || shortNames[avatar.name] || name };
}

export function findPanelAvatar(avatars: readonly PanelAvatar[], name: string, theme: Metadata) {
  const request = normalizeName(name);
  const exact = avatars.find(avatar => request === normalizeName(avatar.name) || request === normalizeName(lookup(avatar, theme).name) || name === avatar.id);
  if (exact) return exact;
  const near = avatars.filter(avatar => {
    const tpl = lookup(avatar, theme);
    const terms = [tpl.abbr, ...(aliases[tpl.name] ?? aliases[avatar.name] ?? "").split(",")].map(normalizeName);
    return terms.includes(request);
  });
  return near.length === 1 ? near[0] : undefined;
}

async function localArt(theme: Metadata, paths: readonly string[]) {
  if (!paths.every(safePart)) return "";
  const file = join(theme.root, "meta-sr", ...paths);
  return (await Bun.file(file).exists()) ? cssFile(file) : "";
}

const maxImageBytes = 768 * 1024;
async function remoteArt(source: string | undefined, signal: AbortSignal) {
  if (!source) return "";
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(4000)]);
  let response: Response | undefined;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || !officialArtHosts.has(url.hostname) || url.username || url.password || url.port) return "";
    response = await fetch(url, { redirect: "error", credentials: "omit", signal: deadline });
    if (!response.ok || response.redirected || !response.body || Number(response.headers.get("Content-Length")) > maxImageBytes) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > maxImageBytes) return "";
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const type = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "webp"
      : bytes[0] === 255 && bytes[1] === 216 ? "jpeg" : "";
    return type ? `data:image/${type};base64,${bytes.toString("base64")}` : "";
  } catch {
    return "";
  } finally {
    void response?.body?.cancel().catch(() => undefined);
  }
}

function preparedModel(theme: Metadata, kind: "list" | "detail", fields: Json) {
  return {
    tplFile: join(packagedTheme, "character", `profile-${kind}.html`),
    elemLayout: join(packagedTheme, "common", "layout", "elem.html"),
    _styles_path: cssFile(resolve(packagedTheme) + sep),
    _theme_path: theme.defaultStyle ? cssFile(theme.root + sep) : "",
    _res_path: "", game: "sr", elem: "sr", bodyClass: theme.defaultStyle ? "original-theme" : "",
    copyright: "Created By miao-plugin · Lotus-Yunzai", sys: { scale: "" },
    groupRank: false, allowRank: false, rankCfg: {}, imgType: "png" as const,
    viewport: { width: 960, height: 900 }, scale: 1,
    ...fields,
  };
}

function formatDate(value: string | undefined) {
  const millis = value && Date.parse(value);
  return millis ? new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(millis)) : "";
}

export async function makePanelListCards(snapshot: PanelSnapshot, theme: Metadata, profileId: number, signal: AbortSignal, updated = false) {
  const avatars = snapshot.avatars.map(avatar => {
    const catalog = lookup(avatar, theme);
    return { avatar, ...catalog, star: avatar.rarity ?? whole(catalog.meta?.star, 5) };
  }).sort((a, b) => (b.star ?? 0) - (a.star ?? 0) || (b.avatar.level ?? 0) - (a.avatar.level ?? 0) || Number(b.avatar.id) - Number(a.avatar.id));
  const pages = [];
  const artSignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  const pageSize = 48;
  for (let start = 0; start < avatars.length; start += pageSize) {
    const chars = [];
    const end = Math.min(start + pageSize, avatars.length);
    for (let offset = start; offset < end; offset += 8) {
      signal.throwIfAborted();
      chars.push(...await Promise.all(avatars.slice(offset, Math.min(offset + 8, end)).map(async ({ avatar, name, abbr, star }) => ({
        face: await localArt(theme, ["character", name, "imgs", "face-q.webp"])
          || await localArt(theme, ["character", name, "imgs", "face.webp"]) || await remoteArt(avatar.face, artSignal),
        abbr, star: star ?? "", cons: avatar.rank ?? "—", isNew: updated,
      }))));
    }
    pages.push(preparedModel(theme, "list", {
      chars, uid: snapshot.uid, profileSuffix: profileId === 1 ? "" : profileId, hasNew: updated,
      msg: updated ? `获取角色面板数据成功，共 ${avatars.length} 位角色` : "",
      updateTime: { profile: formatDate(snapshot.updatedAt) }, servName: fieldsSource(snapshot),
    }));
  }
  return pages;
}

function fieldsSource(snapshot: PanelSnapshot) {
  return snapshot.source === "miyoushe" ? "米游社" : "本地面板档案";
}

function coneDetails(cone: PanelAvatar["cone"], metadata: Json) {
  const attrs: Record<string, string> = {};
  const level = cone?.level ?? 0;
  const thresholds = [20, 30, 40, 50, 60, 70];
  // A cone at a breakpoint may be pre- or post-ascension. Use the old cached
  // promotion when present. Display only stats supported by the snapshot.
  const promote = cone?.promote ?? (!thresholds.includes(level) ? thresholds.filter(step => level > step).length : undefined);
  const base = promote !== undefined ? object(object(object(metadata.attr)?.[promote])?.attrs) : undefined;
  const growth = object(metadata.growAttr);
  for (const key of ["hp", "atk", "def"]) {
    const start = base?.[key], step = growth?.[key];
    attrs[key] = typeof start === "number" && typeof step === "number" && Number.isFinite(start) && Number.isFinite(step) && level > 0
      ? fmt(start + step * (level - 1), false) : "—";
  }
  const skill = object(metadata.skill);
  const tables = object(skill?.tables);
  const rank = cone?.rank;
  const description = text(skill?.desc, 1600).replace(/<[^>]{1,100}>/gu, "").replace(/\$(\d{1,2})\[(i|f[1-4])\]/gu, (raw, key, format) => {
    const values = tables?.[key];
    const value = rank && Array.isArray(values) ? values[rank - 1] : undefined;
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return format === "i" ? String(Math.round(value)) : String(Number(value.toFixed(Number(format[1]))));
  });
  return { attrs, desc: { desc: cone?.description.replace(/<[^>]{1,100}>/gu, "") || description } };
}

function fmt(value: number, pct: boolean) {
  return `${Number(value.toFixed(pct ? 2 : 1))}${pct ? "%" : ""}`;
}

function showcase(avatar: PanelAvatar, element: string) {
  const map = new Map(avatar.stats.map(stat => [stat.key, stat]));
  const attr: Record<string, string> = {};
  for (const key of showcaseKeys) {
    const stat = map.get(key === "dmg" ? elementDamage[element] ?? "" : key);
    attr[key] = stat?.value || "—";
    if (!stat?.base) continue;
    attr[key + "Base"] = stat.base;
    const ratio = stat.value.endsWith("%");
    if (ratio !== stat.base.endsWith("%")) continue;
    const diff = Number.parseFloat(stat.value) - Number.parseFloat(stat.base);
    if (diff) attr[key + "Plus"] = `${diff > 0 ? "+" : ""}${fmt(diff, ratio)}`;
  }
  return attr;
}

function relicStats(part: PanelAvatar["relics"][number], theme: Metadata) {
  if (!part.legacyMainId || part.rarity === undefined || part.level === undefined) return part;
  // Miao ArtisAttr.js AttrSR calculates the main affix and rolled sub-affixes
  // against the original deployed relic metadata.
  const star = object(object(theme.relicValues.starData)?.[part.rarity]);
  const key = object(object(theme.relicValues.mainIdx)?.[part.slot])?.[part.legacyMainId];
  const mainCfg = typeof key === "string" ? object(object(star?.main)?.[key]) : undefined;
  const value = (key: string, amount: number) => fmt(amount, !["hpPlus", "atkPlus", "defPlus", "speed"].includes(key));
  const valid = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const main = mainCfg && typeof key === "string" && valid(mainCfg.base) && valid(mainCfg.step) ? {
    key, value: value(key, mainCfg.base + mainCfg.step * part.level),
  } : undefined;
  const subs: Stat[] = [];
  for (const entry of part.legacySubIds ?? []) {
    const match = /^(\d{1,3}),(\d{1,2}),(-?\d{1,2})$/u.exec(entry);
    const cfg = match?.[1] && object(object(star?.sub)?.[match[1]]);
    if (!match || !cfg || typeof cfg.key !== "string" || !valid(cfg.base) || !valid(cfg.step)) continue;
    subs.push({ key: cfg.key, value: value(cfg.key, cfg.base * Number(match[2]) + cfg.step * Number(match[3])), times: Number(match[2]) });
  }
  return { ...part, main, subs };
}

export async function makePanelDetailCard(snapshot: PanelSnapshot, avatar: PanelAvatar, theme: Metadata, signal: AbortSignal) {
  const artSignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  const { name, abbr, meta } = lookup(avatar, theme);
  const element = avatar.element || text(meta?.elem) || "物理";
  const path = text(meta?.weapon) || avatar.path;
  const cone = avatar.cone, weapon = cone && object(theme.weapons[cone.id]);
  const weaponName = cone?.name || text(weapon?.name) || (cone ? `光锥 ${cone.id}` : "");
  const weaponType = text(weapon?.type) || path;
  const imgs: Record<string, string> = {};
  const talent: Record<string, { level: number | string }> = {};
  for (const skill of avatar.skills) {
    talent[skill.key] = { level: skill.level };
    imgs[skill.key] = await localArt(theme, ["character", name, "imgs", `talent-${skill.key}.webp`])
      || await remoteArt(skill.icon, artSignal);
  }
  const levels = object(meta?.talentCons);
  for (let i = 1; i <= 6; i++) {
    const oldKey = text(levels?.[i]);
    imgs[`cons${i}`] = (oldKey && imgs[oldKey]) || await localArt(theme, ["character", name, "imgs", `cons-${i}.webp`])
      || await remoteArt(avatar.stars[i - 1]?.image, artSignal);
  }
  imgs.splash = await localArt(theme, ["character", name, "imgs", "splash.webp"]) || await remoteArt(avatar.splash || avatar.face, artSignal);
  const treeData = [];
  const skillOffset = Number(avatar.id) * 100 + 1000;
  for (const trace of avatar.traces) {
    const index = (Number(trace.id) - skillOffset) % 100;
    const image = await remoteArt(trace.icon, artSignal) || (index >= 1 && index <= 4 && await localArt(theme, ["character", name, "imgs", `tree-${index}.webp`])) || "";
    if (image) treeData.push({ img: image, value: trace.active, type: "talent" });
  }
  const artis = [];
  for (const row of avatar.relics) {
    const part = relicStats(row, theme);
    const local = theme.relicById.get(part.id);
    artis.push({
      name: part.name || local?.name || `遗器 ${part.slot}`, level: part.level ?? "",
      img: (local && await localArt(theme, local.asset)) || await remoteArt(part.image, artSignal),
      main: part.main, attrs: part.subs.map(stat => ({ ...stat, upNum: stat.times })),
    });
  }
  const weaponImg = cone && await localArt(theme, ["weapon", weaponType, weaponName, "splash.webp"]) || await remoteArt(cone?.image, artSignal);
  const coneMeta = safePart(weaponType) && safePart(weaponName)
    ? await readJson(join(theme.root, "meta-sr", "weapon", weaponType, weaponName, "data.json")) : {};
  return preparedModel(theme, "detail", {
    mode: "profile", element, uid: snapshot.uid, charWeapon: path, hsr_paths: path,
    data: {
      name, abbr, level: avatar.level ?? "—", cons: avatar.rank ?? "—", imgs, talent, treeData,
      weapon: cone && { name: weaponName, splash: weaponImg, level: cone.level ?? "—", affix: cone.rank ?? "—",
        ...coneDetails(cone, coneMeta) },
      dataSource: fieldsSource(snapshot), updateTime: formatDate(snapshot.updatedAt),
    },
    attr: showcase(avatar, element), artisDetail: { charWeight: {}, artis }, artisKeyTitle: statTitles,
  });
}
