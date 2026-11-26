import { createTranslator as createTextTranslator } from "../../packages/i18n/index.ts";
import messageCatalog from "./i18n/zh-CN.json";
const $t = createTextTranslator("starrail", messageCatalog.messages);
import { readStarRailExtraEidolon } from "./panel-model.ts";
import type { GameRole } from "@lotus-yunzai/account";
import { normalizeStarRailRegion } from "./region.ts";
import { canonicalStarRailPanelCharacter, id, object, readLegacyPanel, whole, type PanelSnapshot, type ShowcaseProvider } from "./panel-model.ts";

const endpoints = {
  mihomo: "https://api.mihomo.me/sr_info/",
  avocado: "https://avocado.wiki/v1/raw/info/",
  enka: "https://enka.network/api/hsr/uid/",
} as const;
export const showcaseProviderNames = { mihomo: "Mihomo", avocado: "Avocado", enka: "EnkaHSR" } as const;
const serverCodes: Readonly<Record<string, ShowcaseProvider>> = { "0": "mihomo", "2": "mihomo", "3": "avocado", "4": "enka" };
const uidRegions: Readonly<Record<string, string>> = {
  "1": "prod_gf_cn", "2": "prod_gf_cn", "3": "prod_gf_cn", "4": "prod_gf_cn", "5": "prod_qd_cn",
  "6": "prod_official_usa", "7": "prod_official_eur", "8": "prod_official_asia", "18": "prod_official_asia", "9": "prod_official_cht",
};
const skillKeys: Readonly<Record<string, string>> = { "001": "a", "002": "e", "003": "q", "004": "t", "007": "z", "301": "me", "302": "mt", "420": "xe" };
type Role = Pick<GameRole, "uid" | "region" | "gameBiz">;
type Transport = (url: URL, init: RequestInit) => Promise<Response>;
const maxBytes = 512 * 1024;

export class ShowcaseError extends Error {
  constructor(message: string, readonly notListed = false) {
    super(message);
  }
}

export function showcaseServerCode(code: string): ShowcaseProvider | undefined {
  return Object.hasOwn(serverCodes, code) ? serverCodes[code] : undefined;
}

export function showcaseTarget(role: Role, config = "0") {
  const uid = role.uid;
  const prefix = /^(?:18|[1-9])\d{8}$/u.test(uid) ? uid.slice(0, -8) : "";
  const region = uidRegions[prefix];
  const regionIndex = region === "prod_gf_cn" ? 0 : region === "prod_qd_cn" ? 1 : 2;
  const biz = regionIndex === 2 ? "hkrpg_global" : "hkrpg_cn";
  if (!region || (role.region && normalizeStarRailRegion(role.region) !== region) || (role.gameBiz && role.gameBiz !== biz)) {
    throw new ShowcaseError($t("panel-showcase.text_3b527fc569"));
  }
  const choice = /^[0-4]{1,3}$/u.test(config) ? config[regionIndex] ?? config[0]! : "";
  const provider = showcaseServerCode(choice);
  if (choice === "1") throw new ShowcaseError($t("panel-showcase.text_d1c8eb0a33"));
  if (!provider) throw new ShowcaseError($t("panel-showcase.text_ba5795a8d5"));
  return { uid, region, provider };
}

async function responseJson(response: Response) {
  if (!response.body) throw new ShowcaseError($t("panel-showcase.text_0c978e0112"));
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel().catch(() => undefined);
    throw new ShowcaseError($t("panel-showcase.text_e88ef73c7b"));
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, content = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new ShowcaseError($t("panel-showcase.text_e88ef73c7b"));
      content += decoder.decode(value, { stream: true });
    }
    return JSON.parse(content + decoder.decode()) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function listed(value: unknown, max: number) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) throw new ShowcaseError($t("panel-showcase.text_4f6a42de0f"));
  return value;
}

function normalizeRelics(value: unknown, avocado: boolean) {
  const relics: Record<string, unknown> = {};
  for (const raw of listed(value, 6)) {
    const row = object(raw);
    const item = id(avocado ? row?.id : row?.tid), slot = whole(row?.type, 6);
    if (!item || !slot || Object.hasOwn(relics, slot)) throw new ShowcaseError($t("panel-showcase.text_0113a4a48f"));
    const attrIds = listed(avocado ? row?.sub_affix_id : row?.subAffixList, 4).flatMap(raw => {
      const sub = object(raw);
      const affix = id(avocado ? sub?.id : sub?.affixId), count = whole(sub?.cnt, 20), step = Number(sub?.step ?? 0);
      return affix && count !== undefined && Number.isInteger(step) && Math.abs(step) <= 50 ? [`${affix},${count},${step}`] : [];
    });
    relics[slot] = { id: item, level: whole(row?.level, 15), star: /^[3-6]\d{4}$/u.test(item) ? Number(item[0]) - 1 : undefined,
      mainId: id(avocado ? row?.main_affix_id : row?.mainAffixId), attrIds };
  }
  return relics;
}

function normalizeAvatar(input: unknown, provider: ShowcaseProvider) {
  const row = object(input);
  const original = id(row?.avatarId ?? row?.AvatarID), level = whole(row?.level ?? row?.Level, 80);
  if (!row || !/^[1-9]\d{3}$/u.test(original) || !level) throw new ShowcaseError($t("panel-showcase.text_a44b2217ef"));
  const avatarId = canonicalStarRailPanelCharacter(original, whole(row.enhancedId, 1) === 1);
  const avocado = provider === "avocado";
  const source = provider === "mihomo" ? "homo" : provider === "enka" ? "EnkaHSR" : "avocado.wiki";
  const talent: Record<string, number> = {}, trees: string[] = [];
  const points = new RegExp(`^1?${original}`);
  const skillRows = listed(avocado ? row.behaviorList : row.skillTreeList, 32);
  for (const raw of skillRows) {
    const item = object(raw);
    const point = id(avocado ? item?.id : item?.pointId), skill = whole(item?.level, 25);
    if (!point || !skill) continue;
    const key = skillKeys[point.replace(points, "")];
    if (key) talent[key] = skill;
    else trees.push(avatarId !== original && point.startsWith(`1${original}`) ? avatarId + point.slice(5) : point);
  }
  const equip = object(row.equipment);
  const equipId = id(avocado ? equip?.id : equip?.tid);
  return { original, id: avatarId, name: $t("panel-showcase.text_c4a7b73faf", { "avatarId": avatarId }), _source: source, level, promote: whole(row.promotion, 6), cons: whole(row.rank, 6) ?? 0, exCons: readStarRailExtraEidolon(row, original),
    weapon: equipId ? { id: equipId, level: whole(equip?.level, 80), promote: whole(equip?.promotion, 6), affix: whole(equip?.rank, 5) } : undefined,
    talent, trees: skillRows.length ? trees : undefined, artis: normalizeRelics(avocado ? row.relics : row.relicList, avocado) };
}

function matchesShowcaseRegion(value: unknown, expected: string) {
  if (value === undefined) return true;
  if (normalizeStarRailRegion(value) === expected) return true;
  if (typeof value !== "string") return false;
  const region = value.toUpperCase();
  if (region === "CN") return expected === "prod_gf_cn" || expected === "prod_qd_cn";
  const aliases: Readonly<Record<string, string>> = {
    USA: "prod_official_usa", US: "prod_official_usa", EU: "prod_official_eur",
    EUR: "prod_official_eur", ASIA: "prod_official_asia", CHT: "prod_official_cht",
  };
  return aliases[region] === expected;
}

function normalizeShowcase(input: unknown, { uid, region, provider }: ReturnType<typeof showcaseTarget>, started: Date): PanelSnapshot {
  const root = object(input), avocado = provider === "avocado";
  const profile = object(avocado ? root?.playerDetailInfo : root?.detailInfo);
  const claimed = [root?.uid, profile?.uid].filter(value => value !== undefined);
  if (!profile) throw new ShowcaseError($t("panel-showcase.text_d96b3bfb80"), true);
  const regions = [root?.region, profile.region, root?.server, profile.server];
  if (!claimed.length || claimed.some(value => id(value) !== uid) || regions.some(value => !matchesShowcaseRegion(value, region))) {
    throw new ShowcaseError($t("panel-showcase.text_eda86548e9"));
  }
  const assist = avocado ? (profile.assistAvatar ? [profile.assistAvatar] : [])
    : provider === "enka" && profile.assistAvatarDetail ? [profile.assistAvatarDetail] : listed(profile.assistAvatarList, 12);
  const shown = profile.isDisplayAvatar === false ? [] : listed(avocado ? profile.displayAvatars : profile.avatarDetailList, 12);
  const display = new Map<string, ReturnType<typeof normalizeAvatar>>();
  for (const raw of [...assist, ...shown]) {
    const row = normalizeAvatar(raw, provider);
    display.set(row.original, row);
  }
  const avatars = Object.fromEntries([...display.values()].map(row => [row.id, row]));
  const snapshot = readLegacyPanel(uid, { uid, avatars });
  if (!snapshot.avatars.length) throw new ShowcaseError($t("panel-showcase.text_fbf3ad7e7f"), true);
  return { ...snapshot, source: provider, updatedAt: started.toISOString(), showcaseTtl: Math.max(60, whole(root?.ttl, 86_400) ?? 60) };
}

export async function fetchStarRailShowcase(target: ReturnType<typeof showcaseTarget>, signal: AbortSignal,
  transport: Transport = fetch, started = new Date()): Promise<PanelSnapshot> {
  try {
    signal.throwIfAborted();
    const response = await transport(new URL(target.uid, endpoints[target.provider]), {
      method: "GET", credentials: "omit", redirect: "error", headers: { Accept: "application/json", "User-Agent": "Lotus-Yunzai" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok || response.redirected) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 429) throw new ShowcaseError($t("panel-showcase.text_7f4ad197e7"));
      if (response.status === 404) throw new ShowcaseError($t("panel-showcase.text_41c3a4793b"), true);
      throw new ShowcaseError($t("panel-showcase.text_ce645452a0"));
    }
    return normalizeShowcase(await responseJson(response), target, started);
  } catch (error) {
    if (signal.aborted || error instanceof ShowcaseError) throw error;
    throw new ShowcaseError($t("panel-showcase.text_9adcf00329"));
  }
}
