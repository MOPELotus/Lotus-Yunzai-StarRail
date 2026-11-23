import { readFile, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import characterNames from "../challenge-character-names.json";
import { starRailReincarnationThemeDirectory } from "./reincarnation-theme.ts";

export interface WarpIdentity {
  readonly name: string;
  readonly description?: string;
  readonly path?: string;
  readonly allegiance?: string;
}
interface WarpIdentityCatalog {
  readonly characters: readonly WarpIdentity[];
  readonly others: readonly WarpIdentity[];
  readonly colors: Readonly<Record<string, string>>;
}

const fallbackCharacters = [...new Set(Object.values(characterNames))].map(name => ({ name }));
const fallbackOthers: readonly WarpIdentity[] = [
  ["阿基维利", "开拓"], ["纳努克", "毁灭"], ["岚", "巡猎"], ["博识尊", "智识"], ["希佩", "同谐"],
  ["IX", "虚无"], ["克里珀", "存护"], ["药师", "丰饶"], ["阿哈", "欢愉"], ["伊德莉拉", "纯美"],
  ["互", "均衡"], ["末王", "终末"], ["浮黎", "记忆"], ["奥博洛斯", "贪饕"], ["龙", "不朽"], ["太一", "秩序"],
].map(([name, path]) => ({ name: name!, path, allegiance: "星神" }));

function record(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return value as Record<string, unknown>;
}

function label(value: unknown, max = 80): string | undefined {
  if (typeof value === "string" && value.trim() && value.length <= max && !/[\p{Cc}]/u.test(value)) return value.trim();
}

function identity(value: unknown, other: boolean): WarpIdentity | undefined {
  const row = record(value);
  const name = label(row?.name);
  const description = label(row?.desc, 600);
  if (!name || !description || /[/\\]/u.test(name)) return;
  if (!other) return { name, description };
  const path = label(row?.weapon), allegiance = label(row?.allegiance);
  if (path && allegiance && !/[/\\]/u.test(allegiance)) return { name, description, path, allegiance };
}

async function yaml(root: string, name: string) {
  try {
    const filename = await realpath(join(root, "yaml", name));
    if (!filename.startsWith(root + sep)) return;
    const info = await stat(filename);
    if (info.isFile() && info.size <= 64 * 1024) return Bun.YAML.parse(await readFile(filename, "utf8")) as unknown;
  } catch {
    return;
  }
}

export async function readWarpIdentityCatalog(directory = starRailReincarnationThemeDirectory()): Promise<WarpIdentityCatalog> {
  const root = await realpath(directory).catch(() => undefined);
  const inputs = root ? await Promise.all([yaml(root, "identity.yaml"), yaml(root, "other.yaml"), yaml(root, "color.yaml")]) : [];
  function collect(value: unknown, other: boolean, fallback: readonly WarpIdentity[]) {
    if (!Array.isArray(value) || value.length > 256) return fallback;
    const parsed = value.flatMap(raw => {
      const profile = identity(raw, other);
      return profile ? [profile] : [];
    });
    return parsed.length ? parsed : fallback;
  }
  const colors = Object.fromEntries(Object.entries(record(inputs[2]) ?? {}).filter(([, color]) =>
    typeof color === "string" && /^#[0-9a-f]{6}$/iu.test(color))) as Record<string, string>;
  return { characters: collect(inputs[0], false, fallbackCharacters), others: collect(inputs[1], true, fallbackOthers), colors };
}

export function pickWarpIdentity(catalog: WarpIdentityCatalog, random: () => number) {
  const choices = random() < 0.5 ? catalog.others : catalog.characters;
  return choices[Math.floor(random() * choices.length)]!;
}

export async function readWarpAvatar(qq: string, signal: AbortSignal, request: (url: URL, init: RequestInit) => Promise<Response> = fetch): Promise<Uint8Array | undefined> {
  if (!/^[1-9]\d{0,15}$/u.test(qq) || !Number.isSafeInteger(Number(qq)) || signal.aborted) return;
  const maxBytes = 512 * 1024;
  const active = AbortSignal.any([signal, AbortSignal.timeout(2500)]);
  try {
    const url = new URL("https://q2.qlogo.cn/headimg_dl");
    url.search = new URLSearchParams({ dst_uin: qq, spec: "5" }).toString();
    const response = await request(url, { signal: active, redirect: "error", credentials: "omit" });
    if (!response.ok || !response.body || response.redirected ||
        !/^image\/(?:png|jpe?g|webp)\b/iu.test(response.headers.get("Content-Type") ?? "") ||
        Number(response.headers.get("Content-Length")) > maxBytes) {
      await response.body?.cancel().catch(() => {});
      return;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        active.throwIfAborted();
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > maxBytes) return;
        chunks.push(item.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    if (size) return Buffer.concat(chunks, size);
  } catch {
    return;
  }
}
