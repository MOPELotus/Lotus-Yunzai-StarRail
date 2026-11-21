import { fileURLToPath } from "node:url";
import type { RuleValues } from "../rules/rulebook.ts";
import type { Numbers, TemplateKind, TemplateVersion } from "./types.ts";

export const libraryUrl = new URL("../../vendor/data/library/", import.meta.url);
export const map = (value: unknown): RuleValues =>
  value && typeof value === "object" && !Array.isArray(value) ? value as RuleValues : {};
export const entries = (value: unknown): readonly RuleValues[] => Array.isArray(value) ? value.map(map) : [];
export const numeric = (value: unknown): Numbers => Object.fromEntries(
  Object.entries(map(value)).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])),
);
export const strings = (value: unknown): readonly string[] => Array.isArray(value) ? value.map(String) : [];
export const string = (value: unknown, fallback = ""): string => value == null ? fallback : String(value);
export const number = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export class MissingTemplate extends Error {
  constructor(readonly kind: TemplateKind, readonly id: string, readonly version: TemplateVersion) {
    super(`缺少模板 ${kind}/${id}（${version}）`);
  }
}
export class TemplateLibrary {
  readonly #cache = new Map<string, Promise<RuleValues>>();
  constructor(readonly root = libraryUrl) {}

  read(kind: TemplateKind, id: string, version: TemplateVersion = "enhanced"): Promise<RuleValues> {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new TypeError("无效模板标识");
    if (version !== "enhanced" && version !== "legacy") throw new TypeError("无效模板版本");
    const legacy = version === "legacy";
    const folder = new URL(kind + "/", this.root);
    return this.#read(version + "/" + kind + "/" + id, async () => {
      const names = Array.from(new Bun.Glob(id + "_*.yaml").scanSync({ cwd: fileURLToPath(folder) }))
        .filter(name => name !== id + "_legacy.yaml" && name.endsWith("_legacy.yaml") === legacy);
      if (names.length > 1) throw new TypeError(`模板 ${kind}/${id} 重复`);
      const pathname = names[0] ?? id + (legacy ? "_legacy" : "") + ".yaml";
      const file = Bun.file(new URL(encodeURIComponent(pathname), folder));
      if (!await file.exists()) throw new MissingTemplate(kind, id, version);
      return map(Bun.YAML.parse(await file.text()));
    });
  }

  system(name: string): Promise<RuleValues> {
    if (!/^paths\/[A-Za-z0-9_-]+$/.test(name)) throw new TypeError("无效命途模块标识");
    return this.#read("system/" + name, async () =>
      map(Bun.YAML.parse(await Bun.file(new URL("system/" + name + ".yaml", this.root)).text())));
  }

  #read(key: string, work: () => Promise<RuleValues>): Promise<RuleValues> {
    const cached = this.#cache.get(key);
    if (cached) return cached;
    const pending = work();
    this.#cache.set(key, pending);
    return pending;
  }
}
export const templateLibrary = new TemplateLibrary();
