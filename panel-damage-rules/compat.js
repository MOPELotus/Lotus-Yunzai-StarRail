// Compatibility for the vendored MIT calculation modules.
import { attrMap } from "./relic-attributes.js";
export { Format } from "./format.js";

const forEach = (value, callback) => {
  if (value === null || value === undefined) return value;
  for (const [key, entry] of Array.isArray(value) ? value.entries() : Object.entries(value)) {
    if (callback(entry, key, value) === false) break;
  }
  return value;
};

export const Meta = { getMeta: () => ({ attrMap }) };
export default {
  forEach,
  // DmgAttr copies a trusted local tree of AttrItem instances and plain data.
  // It rebuilds AttrItem instances itself after copying.
  merge: (target, source) => Object.assign(target, structuredClone(source)),
  isFunction: value => typeof value === "function",
  isUndefined: value => value === undefined,
};
