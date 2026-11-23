import { setTimeout as wait } from "node:timers/promises";
import type { GameRole } from "@lotus-yunzai/account";
import { normalizeStarRailRegion } from "./region.ts";
import { selectStarRailUigf, type StarRailUigfArchive, type StarRailUigfPool } from "./gacha-uigf.ts";

const origin = { hkrpg_cn: "https://public-operation-hkrpg.mihoyo.com", hkrpg_global: "https://public-operation-hkrpg-sg.hoyoverse.com" } as const;
const oldCnOrigin = "https://api-takumi.mihoyo.com";
const relativePath = "/common/gacha_record/api/";
const ordinaryPath = relativePath + "getGachaLog";
const collaborationPath = relativePath + "getLdGachaLog";
const pools = ["1", "2", "11", "12", "21", "22"] as const;
const regions = {
  prod_gf_cn: "hkrpg_cn", prod_qd_cn: "hkrpg_cn", prod_official_usa: "hkrpg_global",
  prod_official_eur: "hkrpg_global", prod_official_asia: "hkrpg_global", prod_official_cht: "hkrpg_global",
} as const;
const pageSize = 20;
const maxPageBytes = 256 * 1024;

type Region = keyof typeof regions;
type LinkRole = { readonly uid: string; readonly region: Region; readonly gameBiz: keyof typeof origin };
type Transport = (url: URL, init: RequestInit) => Promise<Response>;

export class StarRailGachaLinkError extends Error {}

export function checkedStarRailLinkRole(role: GameRole): LinkRole {
  const { uid, gameBiz } = role;
  const region = normalizeStarRailRegion(role.region);
  if (!region || !/^[1-9]\d{8,9}$/u.test(uid) || !Object.hasOwn(regions, region) || regions[region as Region] !== gameBiz) {
    throw new StarRailGachaLinkError("当前档案没有可核验的星铁 UID 和区服，请先同步角色。");
  }
  return { uid, region: region as Region, gameBiz: gameBiz as LinkRole["gameBiz"] };
}

function invalidLink(): never {
  throw new StarRailGachaLinkError("请发送与当前档案一致的完整星铁官方抽卡链接。");
}

function readKey(input: string, role: LinkRole): string {
  const value = input.trim();
  const issuers = role.gameBiz === "hkrpg_cn" ? [origin.hkrpg_cn, oldCnOrigin] : [origin.hkrpg_global];
  if (value.length > 8192 || /[\x00-\x20\x7F]/u.test(value) ||
      !issuers.some(host => value.startsWith(host + ordinaryPath + "?") ||
        value.startsWith(host + collaborationPath + "?"))) invalidLink();
  const url = URL.parse(value);
  if (!url || url.username || url.password || url.hash) invalidLink();
  const param = (name: string) => {
    const values = url.searchParams.getAll(name);
    if (values.length > 1) invalidLink();
    return values[0];
  };
  const suppliedRegion = param("region");
  const suppliedBiz = param("game_biz");
  const version = param("authkey_ver");
  if (suppliedRegion !== undefined && normalizeStarRailRegion(suppliedRegion) !== role.region ||
      suppliedBiz !== undefined && suppliedBiz !== role.gameBiz || version !== undefined && version !== "1") invalidLink();
  for (const field of ["uid", "game_uid"]) {
    const uid = param(field);
    if (uid !== undefined && uid !== role.uid) invalidLink();
  }
  const key = param("authkey");
  if (!key || !/^[\x21-\x7E]{1,4096}$/u.test(key)) invalidLink();
  return key;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function badResponse(): never {
  throw new StarRailGachaLinkError("星铁逐抽服务返回了与本档案不一致或不完整的数据，原档案已保留。");
}

async function responseJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || Number(response.headers.get("Content-Length")) > maxPageBytes) {
    await response.body?.cancel().catch(() => undefined);
    badResponse();
  }
  const reader = response.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxPageBytes) badResponse();
      chunks.push(value);
    }
    signal.throwIfAborted();
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, length)));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function requestUrl(role: LinkRole, key: string, pool: StarRailUigfPool, page: number, cursor: string) {
  const url = new URL(pool === "21" || pool === "22" ? collaborationPath : ordinaryPath, origin[role.gameBiz]);
  url.search = new URLSearchParams({
    authkey_ver: "1", default_gacha_type: "11", lang: "zh-cn", authkey: key, game_biz: role.gameBiz,
    page: String(page), size: String(pageSize), gacha_type: pool, end_id: cursor,
  }).toString();
  return url;
}

export async function readStarRailGachaLink(input: string, role: LinkRole, signal: AbortSignal,
  verifyProfile: () => Promise<void>, { transport = fetch, intervalMs = 500, maxPages = 400 }: {
    readonly transport?: Transport; readonly intervalMs?: number; readonly maxPages?: number;
  } = {}): Promise<StarRailUigfArchive> {
  const key = readKey(input, role);
  const encodedKey = encodeURIComponent(key);
  let requested = 0;
  let timezone: number | undefined;
  const seen = new Set<string>();
  const rows: unknown[] = [];
  for (const pool of pools) {
    let cursor = "0";
    for (let page = 1; ; page++) {
      if (requested >= maxPages) throw new StarRailGachaLinkError("星铁逐抽达到分页上限，本次未写入。");
      if (requested++ && intervalMs) await wait(intervalMs, undefined, { signal });
      await verifyProfile();
      signal.throwIfAborted();
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
      let response: Response;
      try {
        response = await transport(requestUrl(role, key, pool, page, cursor), {
          method: "GET", headers: { Accept: "application/json" }, credentials: "omit",
          redirect: "error", referrerPolicy: "no-referrer", signal: requestSignal,
        });
      } catch {
        throw new StarRailGachaLinkError("星铁逐抽请求未完成，请稍后重试。");
      }
      if (!response.ok || response.redirected) {
        await response.body?.cancel().catch(() => undefined);
        if (response.status === 401 || response.status === 403) throw new StarRailGachaLinkError("星铁抽卡链接已失效，请在官方客户端重新获取。");
        if (response.status === 429) throw new StarRailGachaLinkError("星铁逐抽请求频繁，请稍后重试。");
        throw new StarRailGachaLinkError("星铁逐抽服务暂时不可用，原档案已保留。");
      }
      const payload = await responseJson(response, requestSignal).catch(badResponse);
      if (!object(payload)) badResponse();
      if (payload.retcode === -100 || payload.retcode === -101) throw new StarRailGachaLinkError("星铁抽卡链接已失效，请在官方客户端重新获取。");
      if (payload.retcode === -110) throw new StarRailGachaLinkError("星铁逐抽请求频繁，请稍后重试。");
      if ([1034, 10035, 10041].some(code => code === payload.retcode)) {
        throw new StarRailGachaLinkError("星铁逐抽服务要求验证，请在官方客户端处理后再试。");
      }
      const data = payload.data;
      if (payload.retcode !== 0 || !object(data) || !Array.isArray(data.list) || data.list.length > pageSize ||
          data.region !== undefined && normalizeStarRailRegion(data.region) !== role.region ||
          data.uid !== undefined && String(data.uid) !== role.uid) badResponse();
      if (data.region_time_zone !== undefined) {
        const offset = data.region_time_zone;
        if (typeof offset !== "number" || !Number.isInteger(offset) || offset < -12 || offset > 14 ||
            timezone !== undefined && timezone !== offset) badResponse();
        timezone = offset;
      }
      if (!data.list.length) break;
      for (const row of data.list) {
        if (!object(row) || String(row.uid) !== role.uid || String(row.gacha_type) !== pool ||
            typeof row.id !== "string" || !/^[1-9]\d{0,18}$/u.test(row.id) ||
            seen.has(row.id) || (cursor !== "0" && BigInt(row.id) >= BigInt(cursor))) badResponse();
        for (const field of ["name", "item_type"]) {
          const text = row[field];
          if (text !== undefined && (typeof text !== "string" || text.length > 120 ||
              /[\p{Cc}\p{Cf}]/u.test(text) || text.includes(key) || text.includes(encodedKey))) badResponse();
        }
        cursor = row.id;
        seen.add(cursor);
        rows.push(row);
      }
    }
  }
  await verifyProfile();
  signal.throwIfAborted();
  if (!rows.length) throw new StarRailGachaLinkError("官方链接暂无可核验的星铁逐抽记录，原档案已保留。");
  if (timezone === undefined) badResponse();
  try {
    return selectStarRailUigf({ info: { version: "v4.2" }, hkrpg: [{ uid: role.uid, timezone, lang: "zh-cn", list: rows }] }, { uid: role.uid });
  } catch {
    badResponse();
  }
}
