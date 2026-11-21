// TypeScript port of the HSR_Nous rulebook loader (MIT, upstream 00185dd).
import { expressionIdents, parse, type PreparedExpression } from "./expression.ts";

export type RuleValues = Readonly<Record<string, unknown>>;
export interface RuleRoute {
  readonly roll: string;
  readonly expected: string;
  readonly settle?: RuleValues;
}
export interface CycleRule {
  readonly first_cycle_av: number;
  readonly subsequent_cycle_av: number;
  readonly reset_on_wave?: boolean;
  readonly initial_energy_ratio?: number;
}
export interface RuleConstants {
  readonly [key: string]: number | readonly number[] | undefined;
  readonly aha_speed_weights?: readonly number[];
}
export interface Rulebook {
  readonly constants: RuleConstants;
  readonly route: Readonly<Record<string, RuleRoute>>;
  readonly zones: Readonly<Record<string, PreparedExpression>>;
  readonly formulas: Readonly<Record<string, PreparedExpression>>;
  readonly breakEffects: Readonly<Record<string, RuleValues>>;
  readonly taunt: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly modes: Readonly<Record<string, CycleRule>>;
  readonly energy: Readonly<Record<string, number>>;
  readonly relicAffixes: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly zoneDecls: Readonly<Record<string, RuleValues>>;
  readonly formulaIdents: Readonly<Record<string, readonly string[]>>;
  readonly settleGates: Readonly<Record<string, PreparedExpression>>;
}

export const rulebookUrl = new URL("../../vendor/rulebook.yaml", import.meta.url);
const cache = new Map<string, Promise<Rulebook>>();
function record(value: unknown, label: string): RuleValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(label + " 应为映射");
  return value as RuleValues;
}
function numbers(value: unknown, label: string): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries(Object.entries(record(value, label)).map(([key, item]) => {
    if (typeof item !== "number" || !Number.isFinite(item)) throw new TypeError(label + "." + key + " 应为有限数值");
    return [key, item];
  })));
}
function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(label + " 应为非空文本");
  return value;
}
function frozenMap<T>(value: unknown, label: string, convert: (item: unknown, key: string) => T): Readonly<Record<string, T>> {
  return Object.freeze(Object.fromEntries(Object.entries(record(value, label)).map(([key, item]) => [key, convert(item, key)])));
}

export function parseRulebook(source: string): Rulebook {
  const raw = record(Bun.YAML.parse(source), "rulebook");
  const zoneDecls: Record<string, RuleValues> = Object.create(null);
  const zones = frozenMap(raw.zones, "zones", (value, key) => {
    if (typeof value === "string") return parse(value, "formula");
    const { expression, ...rest } = record(value, "zones." + key);
    zoneDecls[key] = Object.freeze(rest);
    return parse(string(expression, "zones." + key + ".expression"), "formula");
  });
  const formulas = frozenMap(raw.formulas, "formulas", (value, key) =>
    parse(string(record(value, "formulas." + key).expression, "formulas." + key + ".expression"), "formula"));
  const settleGates: Record<string, PreparedExpression> = Object.create(null);
  const route = frozenMap(raw.route, "route", (value, key): RuleRoute => {
    const heading = "route." + key;
    const entry = record(value, heading);
    const roll = string(entry.roll, heading + ".roll"), expected = string(entry.expected, heading + ".expected");
    for (const formula of [roll, expected]) if (!Object.hasOwn(formulas, formula)) {
      throw new TypeError(heading + " 引用了未知公式 " + formula);
    }
    if (entry.settle === undefined) return Object.freeze({ roll, expected });
    const settle = record(entry.settle, heading + ".settle");
    if (settle.gate !== undefined) {
      const gate = record(settle.gate, heading + ".settle.gate");
      settleGates[key] = parse(string(gate.if, heading + ".settle.gate.if"), "formula");
    }
    return Object.freeze({ roll, expected, settle: Object.freeze(settle) });
  });
  return Object.freeze({
    constants: frozenMap(raw.constants ?? {}, "constants", (value, key) => {
      if (Array.isArray(value) && value.every(item => typeof item === "number" && Number.isFinite(item))) {
        return Object.freeze([...value]) as readonly number[];
      }
      if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("constants." + key + " 应为有限数值或数值数组");
      return value;
    }), route, zones, formulas,
    breakEffects: frozenMap(raw.break_effects ?? {}, "break_effects", (value, key) => record(value, "break_effects." + key)),
    taunt: frozenMap(raw.taunt ?? {}, "taunt", (value, key) => numbers(value, "taunt." + key)),
    modes: frozenMap(raw.modes ?? {}, "modes", (value, key): CycleRule => {
      const mode = record(value, "modes." + key);
      const fields = numbers({ first_cycle_av: mode.first_cycle_av, subsequent_cycle_av: mode.subsequent_cycle_av }, "modes." + key);
      if (fields.first_cycle_av! <= 0 || fields.subsequent_cycle_av! <= 0) throw new TypeError("modes." + key + " 的行动值必须大于零");
      return Object.freeze({ ...mode, first_cycle_av: fields.first_cycle_av!, subsequent_cycle_av: fields.subsequent_cycle_av! });
    }),
    energy: numbers(raw.energy ?? {}, "energy"),
    relicAffixes: frozenMap(raw.relic_affixes ?? {}, "relic_affixes", (value, key) => numbers(value, "relic_affixes." + key)),
    zoneDecls: Object.freeze(zoneDecls),
    formulaIdents: frozenMap(formulas, "formulas", (_value, key) => Object.freeze(expressionIdents(formulas[key]!))),
    settleGates: Object.freeze(settleGates),
  });
}

export function getRulebook(path: string | URL = rulebookUrl): Promise<Rulebook> {
  const file = Bun.file(path);
  const key = file.name ?? String(path);
  let pending = cache.get(key);
  if (!pending) {
    pending = file.text().then(parseRulebook).catch(error => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, pending);
  }
  return pending;
}
