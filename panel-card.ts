import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { starRailGachaThemeDirectory } from "./gacha-detail-source.ts";
import { calculateLegacyPanelAttributes, damageAttribute, formatPanelAttribute, isFlatRelicAttribute, leveledAttributes, readLegacyRelicAttributes } from "./panel-attributes.ts";
import { relicAttributeMap, scoreStarRailRelics } from "./relic-score.ts";
import { alias, abbr } from "./panel-theme/character-alias.js";
import { object, officialArtHosts, starRailLegacySkillLevel, text, whole, type PanelAvatar, type PanelSnapshot } from "./panel-model.ts";

const packagedTheme = fileURLToPath(new URL("./panel-theme/", import.meta.url));
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
const showcaseKeys = ["hp", "atk", "def", "speed", "cpct", "cdmg", "dmg", "stance", "effPct", "effDef", "heal", "joy"];
type Metadata = Awaited<ReturnType<typeof readTheme>>;
type Json = Record<string, unknown>;

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

export async function readTheme(directory = Bun.env.LOTUS_STAR_RAIL_PANEL_THEME_DIR?.trim() || starRailGachaThemeDirectory()) {
  const root = resolve(directory);
  const lists = join(root, "meta-sr");
  const [characters, weapons, relics, relicValues, defaultStyle] = await Promise.all([
    readJson(join(lists, "character", "data.json")), readJson(join(lists, "weapon", "data.json")),
    readJson(join(lists, "artifact", "data.json")), readJson(join(lists, "artifact", "meta.json")),
    Bun.file(join(root, "common", "common.css")).exists(),
  ]);
  const relicById = new Map<string, { name: string; asset: readonly [string, string, string] }>();
  const relicSets = new Map<string, { outer: boolean; pieces: Map<string, { id: string; name: string }> }>();
  for (const value of Object.values(relics)) {
    const row = object(value);
    if (!safePart(row?.name)) continue;
    const indices = object(row?.idxs) ?? {};
    const pieces = new Map<string, { id: string; name: string }>();
    for (const [slot, entry] of Object.entries(indices)) {
      const part = object(entry), name = text(part?.name);
      if (!name || !/^[1-6]$/u.test(slot)) continue;
      for (const [itemId, star] of Object.entries(object(part?.ids) ?? {})) {
        if (/^[1-9]\d{0,11}$/u.test(String(itemId))) {
          relicById.set(itemId, { name, asset: ["artifact", row.name, `arti-${slot}.webp`] });
          const key = `${slot}:${star}`;
          if (typeof star === "number" && Number.isInteger(star) && star >= 2 && star <= 5 && !pieces.has(key)) {
            pieces.set(key, { id: itemId, name });
          }
        }
      }
    }
    if (pieces.size) relicSets.set(row.name, { outer: Object.hasOwn(indices, "1"), pieces });
  }
  return { root, defaultStyle, characters, weapons, relicById, relicSets, relicValues };
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

export async function readPanelDamageMetadata(avatar: PanelAvatar, theme: Metadata) {
  const { name } = lookup(avatar, theme);
  const weapon = avatar.cone && object(theme.weapons[avatar.cone.id]);
  const coneName = text(weapon?.name), conePath = text(weapon?.type);
  if (!safePart(name) || (avatar.cone && (!safePart(coneName) || !safePart(conePath)))) return;
  const [character, cone] = await Promise.all([
    readJson(join(theme.root, "meta-sr", "character", name, "data.json")),
    weapon ? readJson(join(theme.root, "meta-sr", "weapon", conePath, coneName, "data.json")) : Promise.resolve<Json>({}),
  ]);
  if (String(character.id) !== avatar.id || (avatar.cone && String(cone.id) !== avatar.cone.id)) return;
  return { character, cone, conePath, relicMetadata: theme.relicValues, setForId: (id: string) => theme.relicById.get(id)?.asset[1] };
}

async function localArt(theme: Metadata, paths: readonly string[]) {
  if (!paths.every(safePart)) return "";
  const file = join(theme.root, "meta-sr", ...paths);
  return (await Bun.file(file).exists()) ? cssFile(file) : "";
}

const maxImageBytes = 768 * 1024;
async function remoteArt(source: string | undefined, signal: AbortSignal) {
  if (!source || signal.aborted) return "";
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

function preparedModel<Fields extends Json>(theme: Metadata, kind: "list" | "detail" | "relics", fields: Fields) {
  return {
    tplFile: join(packagedTheme, "character", kind === "relics" ? "artis-mark.html" : `profile-${kind}.html`),
    elemLayout: join(packagedTheme, "common", "layout", "elem.html"),
    _styles_path: cssFile(resolve(packagedTheme) + sep),
    _theme_path: theme.defaultStyle ? cssFile(theme.root + sep) : "",
    _res_path: "", game: "sr", elem: "sr", bodyClass: theme.defaultStyle ? "original-theme" : "",
    cardBrand: "Lotus-Yunzai · StarRail", sys: { scale: "" },
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
  const attributes = leveledAttributes(metadata, cone?.level, cone?.promote, true) ?? {};
  const attrs: Record<string, string> = {};
  for (const key of ["hp", "atk", "def"]) {
    const value = attributes[key];
    attrs[key] = value === undefined ? "—" : formatPanelAttribute(value, false);
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

function showcase(stats: PanelAvatar["stats"], element: string) {
  const map = new Map(stats.map(stat => [stat.key, stat]));
  const attr: Record<string, string> = {};
  for (const key of showcaseKeys) {
    const stat = map.get(key === "dmg" ? damageAttribute[element] ?? "" : key);
    attr[key] = stat?.value || "—";
    if (!stat?.base) continue;
    attr[key + "Base"] = stat.base;
    const ratio = stat.value.endsWith("%");
    if (ratio !== stat.base.endsWith("%")) continue;
    const diff = Number.parseFloat(stat.value) - Number.parseFloat(stat.base);
    if (diff) attr[key + "Plus"] = `${diff > 0 ? "+" : ""}${formatPanelAttribute(diff, ratio)}`;
  }
  return attr;
}

function relicStats(part: PanelAvatar["relics"][number], theme: Metadata) {
  const result = readLegacyRelicAttributes(part, theme.relicValues);
  if (!result) return part;
  const forDisplay = ({ key, value, rolls }: { key: string; value: number; rolls?: number }) => ({
    key, value: formatPanelAttribute(value, !isFlatRelicAttribute(key)), times: rolls,
  });
  return { ...part, main: forDisplay(result.main), subs: result.sub.map(forDisplay) };
}

async function makeTraceTree(avatar: PanelAvatar, name: string, metadata: Json, theme: Metadata, signal: AbortSignal) {
  const traces = new Map(avatar.traces.map(trace => [trace.id.slice(-3), trace]));
  const treeConfig = object(metadata.tree);
  if (!treeConfig) {
    const images = await Promise.all(avatar.traces.map(async trace => ({
      img: await remoteArt(trace.icon, signal), value: trace.active, type: "talent",
    })));
    return images.filter(item => item.img);
  }
  const config = new Map(Object.entries(treeConfig).map(([id, node]) => [id.slice(-3), object(node)]));
  const groups = new Map<number, { img: string; value: boolean }[]>();
  for (const [idx, pos] of [..."0113355778"].entries()) {
    const id = String(idx + 201);
    const trace = traces.get(id);
    const key = text(config.get(id)?.key) || "cpct";
    const img = await localArt(theme, ["public", "icons", `tree-${key}.webp`]) || await remoteArt(trace?.icon, signal);
    const group = groups.get(Number(pos)) ?? [];
    group.push({ img, value: trace?.active === true });
    groups.set(Number(pos), group);
  }
  const tree: ({ img: string; value: boolean; type: string } | { img: string; value: boolean }[] | undefined)[] =
    Array.from({ length: 9 }, (_entry, idx) => groups.get(idx));
  for (const [idx, pos] of [2, 4, 6].entries()) {
    const trace = traces.get(String(idx + 101));
    const img = await localArt(theme, ["character", name, "imgs", `tree-${idx + 1}.webp`]) || await remoteArt(trace?.icon, signal);
    tree[pos] = { img, value: trace?.active === true, type: "talent" };
  }
  return tree;
}

export async function makePanelDetailCard(
  snapshot: PanelSnapshot, avatar: PanelAvatar, theme: Metadata, signal: AbortSignal,
  { equipmentLabel, skillPreview, localOnly }: { equipmentLabel?: string; skillPreview?: boolean; localOnly?: boolean } = {},
) {
  const artSignal = equipmentLabel || localOnly ? AbortSignal.abort() : AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  const { name, abbr, meta } = lookup(avatar, theme);
  const character = safePart(name) ? await readJson(join(theme.root, "meta-sr", "character", name, "data.json")) : {};
  const element = avatar.element || text(character.elem ?? meta?.elem) || "物理";
  const path = text(meta?.weapon) || avatar.path;
  const cone = avatar.cone, weapon = cone && object(theme.weapons[cone.id]);
  const weaponName = cone?.name || text(weapon?.name) || (cone ? `光锥 ${cone.id}` : "");
  const weaponType = text(weapon?.type) || path;
  const weaponFolder = text(weapon?.name) || weaponName;
  const imgs: Record<string, string> = {};
  const talent: Record<string, { level: number; original?: number }> = {};
  const levels = object(character.talentCons ?? meta?.talentCons);
  for (const skill of avatar.skills) {
    talent[skill.key] = { level: skill.level, original: skill.original };
    const upgrade = levels?.[skill.key];
    if (avatar.legacy && upgrade && skill.original === undefined) {
      const rank = avatar.rank ?? 0;
      talent[skill.key] = { original: skill.level,
        level: starRailLegacySkillLevel(skill.key, skill.level, rank, upgrade) };
    }
    imgs[skill.key] = await localArt(theme, ["character", name, "imgs", `talent-${skill.key}.webp`])
      || await remoteArt(skill.icon, artSignal);
  }
  if (skillPreview) {
    for (const key of ["xe", "me", "mt"]) {
      if (object(character.talent)?.[key]) imgs[key] = await localArt(theme, ["character", name, "imgs", `talent-${key}.webp`]);
    }
  }
  for (let i = 1; i <= 6; i++) {
    const oldKey = text(levels?.[i]);
    imgs[`cons${i}`] = (oldKey && imgs[oldKey]) || await localArt(theme, ["character", name, "imgs", `cons-${i}.webp`])
      || await remoteArt(avatar.stars[i - 1]?.image, artSignal);
  }
  imgs.splash = await localArt(theme, ["character", name, "imgs", "splash.webp"]) || await remoteArt(avatar.splash || avatar.face, artSignal);
  const treeData = await makeTraceTree(avatar, name, character, theme, artSignal);
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
  const weaponImg = cone && (await localArt(theme, ["weapon", weaponType, weaponFolder, "splash.webp"])
    || (weaponFolder !== weaponName && await localArt(theme, ["weapon", weaponType, weaponName, "splash.webp"])))
    || await remoteArt(cone?.image, artSignal);
  const coneMeta = safePart(weaponType) && safePart(weaponFolder)
    ? await readJson(join(theme.root, "meta-sr", "weapon", weaponType, weaponFolder, "data.json")) : {};
  const derived = avatar.stats.length ? undefined : calculateLegacyPanelAttributes(avatar, {
    character, cone: coneMeta, conePath: weaponType, relicMetadata: theme.relicValues,
    setForId: id => theme.relicById.get(id)?.asset[1],
  });
  return preparedModel(theme, "detail", {
    mode: "profile", element, uid: snapshot.uid, charWeapon: path, hsr_paths: path,
    data: {
      name, abbr, level: avatar.level ?? "—", cons: avatar.rank ?? "—", imgs, talent, treeData,
      weapon: cone && { name: weaponName, splash: weaponImg, level: cone.level ?? "—", affix: cone.rank ?? "—",
        ...coneDetails(cone, coneMeta) },
      dataSource: equipmentLabel ?? (derived ? "旧面板静态复算" : fieldsSource(snapshot)), updateTime: formatDate(snapshot.updatedAt),
    },
    attr: showcase(derived ?? avatar.stats, element), artisDetail: { charWeight: {}, artis }, artisKeyTitle: statTitles,
  });
}

export async function makePanelRelicCard(snapshot: PanelSnapshot, avatar: PanelAvatar, theme: Metadata, signal: AbortSignal) {
  const { name, abbr, meta } = lookup(avatar, theme);
  const character = safePart(name) ? await readJson(join(theme.root, "meta-sr", "character", name, "data.json")) : {};
  const element = avatar.element || text(character.elem ?? meta?.elem) || "物理";
  let speed = avatar.stats.find(stat => stat.key === "speed")?.value;
  if (!speed && name === "缇宝" && avatar.legacy) {
    const gear = avatar.cone && object(theme.weapons[avatar.cone.id]);
    const coneName = avatar.cone?.name || text(gear?.name);
    const conePath = text(gear?.type);
    const cone = safePart(conePath) && safePart(coneName)
      ? await readJson(join(theme.root, "meta-sr", "weapon", conePath, coneName, "data.json")) : {};
    speed = calculateLegacyPanelAttributes(avatar, {
      character, cone, conePath, relicMetadata: theme.relicValues, setForId: id => theme.relicById.get(id)?.asset[1],
    })?.find(stat => stat.key === "speed")?.value;
  }
  const score = scoreStarRailRelics(avatar, {
    name, abbr, element, speed: speed === undefined ? undefined : Number.parseFloat(speed),
    base: object(character.baseAttr), relicValues: theme.relicValues,
  });
  if (!score) return;
  const artSignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
  const splash = await localArt(theme, ["character", name, "imgs", "splash.webp"])
    || await remoteArt(avatar.splash || avatar.face, artSignal);
  const parts = await Promise.all(avatar.relics.flatMap(part => {
    const scored = score.artis[part.slot];
    if (!scored) return [];
    return [(async () => {
      const local = theme.relicById.get(part.id);
      const filename = (local && await localArt(theme, local.asset)) || await remoteArt(part.image, artSignal);
      return [part.slot, { ...scored, level: part.level ?? "", name: part.name || local?.name || `遗器 ${part.slot}`, img: filename }];
    })()];
  }));
  signal.throwIfAborted();
  return preparedModel(theme, "relics", {
    uid: snapshot.uid, element, splash, data: { name, elem: element, level: avatar.level ?? "—", cons: avatar.rank ?? "—" },
    charCfg: score.charCfg, artisDetail: { ...score, artis: Object.fromEntries(parts) },
    attrMap: relicAttributeMap, artisKeyTitle: { ...statTitles, ...Object.fromEntries(Object.entries(relicAttributeMap).map(([key, attr]) => [key, attr.title])) },
  });
}
