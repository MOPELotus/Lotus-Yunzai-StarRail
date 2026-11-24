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
    throw new ShowcaseError("所选星铁档案的 UID 与区服不一致，无法查询公开展板。");
  }
  const choice = /^[0-4]{1,3}$/u.test(config) ? config[regionIndex] ?? config[0]! : "";
  const provider = showcaseServerCode(choice);
  if (choice === "1") throw new ShowcaseError("旧私有 Token 服务不能用于公开展板，请选择公开展板来源。");
  if (!provider) throw new ShowcaseError("当前区服未配置可用的公开星铁展板来源。");
  return { uid, region, provider };
}

async function responseJson(response: Response) {
  if (!response.body) throw new ShowcaseError("公开星铁展板返回了空响应。");
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel().catch(() => undefined);
    throw new ShowcaseError("公开星铁展板响应超过大小限制。");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, content = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new ShowcaseError("公开星铁展板响应超过大小限制。");
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
  if (!Array.isArray(value) || value.length > max) throw new ShowcaseError("公开星铁展板返回的数据格式不正确。");
  return value;
}

function normalizeRelics(value: unknown, avocado: boolean) {
  const relics: Record<string, unknown> = {};
  for (const raw of listed(value, 6)) {
    const row = object(raw);
    const item = id(avocado ? row?.id : row?.tid), slot = whole(row?.type, 6);
    if (!item || !slot || Object.hasOwn(relics, slot)) throw new ShowcaseError("公开星铁展板返回了无效的遗器。");
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
  if (!row || !/^[1-9]\d{3}$/u.test(original) || !level) throw new ShowcaseError("公开星铁展板返回了无效的角色。");
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
  return { original, id: avatarId, name: `角色 ${avatarId}`, _source: source, level, promote: whole(row.promotion, 6), cons: whole(row.rank, 6) ?? 0, exCons: readStarRailExtraEidolon(row, original),
    weapon: equipId ? { id: equipId, level: whole(equip?.level, 80), promote: whole(equip?.promotion, 6), affix: whole(equip?.rank, 5) } : undefined,
    talent, trees: skillRows.length ? trees : undefined, artis: normalizeRelics(avocado ? row.relics : row.relicList, avocado) };
}

function normalizeShowcase(input: unknown, { uid, region, provider }: ReturnType<typeof showcaseTarget>, started: Date): PanelSnapshot {
  const root = object(input), avocado = provider === "avocado";
  const profile = object(avocado ? root?.playerDetailInfo : root?.detailInfo);
  const claimed = [root?.uid, profile?.uid].filter(value => value !== undefined);
  if (!profile) throw new ShowcaseError("公开星铁展板没有可用角色资料，请检查游戏内展板设置。", true);
  const regions = [root?.region, profile.region, root?.server, profile.server];
  if (!claimed.length || claimed.some(value => id(value) !== uid) || regions.some(value => value !== undefined && normalizeStarRailRegion(value) !== region)) {
    throw new ShowcaseError("公开星铁展板的 UID 或区服不匹配，未保存响应。");
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
  if (!snapshot.avatars.length) throw new ShowcaseError("公开星铁展板没有展示角色，请检查游戏内展板设置。", true);
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
      if (response.status === 429) throw new ShowcaseError("公开星铁展板请求过于频繁，请稍后再试。");
      if (response.status === 404) throw new ShowcaseError("公开星铁展板未找到此角色，请检查游戏内展板设置。", true);
      throw new ShowcaseError("公开星铁展板暂时无法连接。");
    }
    return normalizeShowcase(await responseJson(response), target, started);
  } catch (error) {
    if (signal.aborted || error instanceof ShowcaseError) throw error;
    throw new ShowcaseError("公开星铁展板暂时无法读取。");
  }
}
