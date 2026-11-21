// Compatibility for the vendored MIT calculation modules.
import { attrMap } from "./relic-attributes.ts";
export { Format } from "./format.ts";

type Each = {
  <T>(value: readonly T[], callback: (entry: T, key: number, value: readonly T[]) => unknown): readonly T[];
  <T>(value: Record<string, T> | undefined, callback: (entry: T, key: string, value: Record<string, T>) => unknown): Record<string, T> | undefined;
};
const forEach = ((value: object | undefined, callback: (entry: never, key: never, value: never) => unknown) => {
  if (value === null || value === undefined) return value;
  for (const [key, entry] of Array.isArray(value) ? value.entries() : Object.entries(value)) {
    if (callback(entry as never, key as never, value as never) === false) break;
  }
  return value;
}) as Each;

export const Meta = { getMeta: (() => ({ attrMap })) as (game: string, kind: string) => { attrMap: typeof attrMap } };
export default {
  forEach,
  // DmgAttr copies a trusted local tree of AttrItem instances and plain data.
  // It rebuilds AttrItem instances itself after copying.
  merge: <T extends object, U extends object>(target: T, source: U) => Object.assign(target, structuredClone(source)),
  isFunction: <T>(value: T): value is Extract<T, (...args: never[]) => unknown> => typeof value === "function",
  isUndefined: (value: unknown): value is undefined => value === undefined,
};
