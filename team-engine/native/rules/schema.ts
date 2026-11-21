// Template level and formula binding from HSR_Nous (MIT, upstream 00185dd).
import { evaluate, parse, type EvaluateOptions, type ExpressionLayer, type PreparedExpression } from "./expression.ts";
import type { RuleConstants, RuleValues } from "./rulebook.ts";

export type SkillLevels = Readonly<Record<string, number>>;
export interface SkillParameterTable {
  readonly level_key: string;
  readonly rows: readonly (readonly number[])[];
}

const defaults: SkillLevels = { basic: 6, skill: 10, ultimate: 10, talent: 10, elation_skill: 10,
  memosprite_skill: 6, memosprite_talent: 6 };
const shortSkill = new Set(["basic", "memosprite_skill", "memosprite_talent"]);

export function effectiveSkillLevels(template: RuleValues, base: SkillLevels, eidolon: number): SkillLevels {
  if (!Number.isInteger(eidolon) || eidolon < 0 || eidolon > 6) throw new TypeError("星魂须为 0 至 6 的整数");
  const levels = { ...defaults, ...levelMap(template.skill_levels, "skill_levels"), ...levelMap(base, "member.skill_levels") };
  const ranks = mapping(template.eidolons ?? {}, "eidolons");
  for (let rank = 1; rank <= eidolon; rank++) {
    const entry = mapping(ranks["E" + rank] ?? {}, "eidolons.E" + rank);
    for (const [key, delta] of Object.entries(levelMap(entry.skill_level_overrides, "skill_level_overrides"))) {
      levels[key] = Math.min(shortSkill.has(key) ? 10 : 15, (levels[key] ?? 10) + delta);
    }
  }
  return Object.freeze(levels);
}

function mapping(raw: unknown, name: string): RuleValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError(name + " 应为映射");
  return raw as RuleValues;
}
function levelMap(raw: unknown, name: string): SkillLevels {
  if (raw === undefined || raw === null) return {};
  return Object.fromEntries(Object.entries(mapping(raw, name)).map(([key, value]) => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new TypeError(name + "." + key + " 应为正整数");
    return [key, value];
  }));
}

export function skillParameterTables(raw: unknown): Readonly<Record<string, SkillParameterTable>> {
  if (raw === undefined || raw === null) return {};
  return Object.freeze(Object.fromEntries(Object.entries(mapping(raw, "skill_params")).map(([id, value]) => {
    const heading = "skill_params." + id;
    const { level_key, rows, ...extra } = mapping(value, heading);
    if (Object.keys(extra).length > 0 || typeof level_key !== "string" || !level_key || !Array.isArray(rows) || rows.length < 1) {
      throw new TypeError(heading + " 须提供 level_key 及非空 rows");
    }
    const validated = rows.map((row: unknown) => {
      if (!Array.isArray(row) || !row.length || row.some(item => typeof item !== "number" || !Number.isFinite(item))) {
        throw new TypeError(heading + " 的每档参数须为非空数值数组");
      }
      return Object.freeze([...row]) as readonly number[];
    });
    return [id, Object.freeze({ level_key, rows: Object.freeze(validated) })];
  })));
}

export interface ExpressionBinding {
  readonly constants?: RuleConstants;
  readonly tables?: Readonly<Record<string, SkillParameterTable>>;
  readonly levels?: SkillLevels;
  readonly warn?: (message: string) => void;
}

export function bindRuleExpression(source: string, binding: ExpressionBinding = {}): string {
  // Recognize complete literals first so a literal name such as 'param(1, 2)' remains data.
  const tokens = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\bconst\s*\(\s*([A-Za-z_]\w*)\s*\)|\bparam\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)|\b(?:const|param)\s*\(/gu;
  return source.replace(tokens, (match: string, constant: string | undefined, id: string | undefined, column: string | undefined) => {
    if (match.startsWith('"') || match.startsWith("'")) return match;
    if (constant !== undefined) {
      const value = binding.constants && Object.hasOwn(binding.constants, constant) ? binding.constants[constant] : undefined;
      if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError("未知数值规则常量 " + constant);
      return String(value);
    }
    if (id === undefined || column === undefined) throw new TypeError("参数引用语法无效：" + source);
    const table = binding.tables && Object.hasOwn(binding.tables, id) ? binding.tables[id] : undefined;
    if (!table) throw new TypeError("技能参数表缺失：" + id);
    const level = binding.levels?.[table.level_key] ?? defaults[table.level_key] ?? binding.levels?.ultimate ?? 10;
    if (level > table.rows.length) binding.warn?.("技能 " + id + " 等级 " + level + " 超过表尾，沿用最高档");
    const row = table.rows[Math.min(Math.max(level, 1), table.rows.length) - 1]!;
    const index = Number(column) - 1;
    if (index < 0 || index >= row.length) throw new TypeError("技能参数列越界：" + match);
    return String(row[index]!);
  });
}

export class ExpressionCompiler {
  private readonly cache = new Map<string, PreparedExpression>();

  compile(source: string, binding?: ExpressionBinding, layer: ExpressionLayer = "effect"): PreparedExpression {
    const bound = bindRuleExpression(source, binding);
    const key = layer + "\0" + bound;
    let expression = this.cache.get(key);
    if (!expression) {
      expression = parse(bound, layer);
      this.cache.set(key, expression);
    }
    return expression;
  }

  tryCompile(source: string | undefined | null, binding?: ExpressionBinding, layer: ExpressionLayer = "effect") {
    if (source === undefined || source === null || ["", "true", "True"].includes(source.trim())) return undefined;
    return this.compile(source, binding, layer);
  }

  evaluate<T = unknown>(prepared: PreparedExpression, options: EvaluateOptions = {}): T {
    return evaluate<T>(prepared, options).value;
  }
}

const expressionFields = new Set(["condition", "enable_if", "hit_condition", "available_if",
  "scaling_atk", "scaling_hp", "amount", "dot_ratio_expr", "pool_override", "instances_expr",
  "repeat_scaling_atk", "stacks_value"]);
const expressionMaps = new Set(["stat_exprs", "hit_stat_exprs"]);

export interface BoundTemplateExpression {
  readonly path: readonly string[];
  readonly expression: PreparedExpression;
}

/** Bind the predicate and amount fields shared by character, equipment and enemy templates. */
export function compileTemplateExpressions(template: RuleValues, binding: ExpressionBinding,
  compiler = new ExpressionCompiler()): readonly BoundTemplateExpression[] {
  const expressions: BoundTemplateExpression[] = [];
  function visit(value: unknown, path: readonly string[]) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = [...path, key];
      if (typeof child === "string" && (expressionFields.has(key) || expressionMaps.has(path.at(-1) ?? ""))) {
        try {
          const expression = compiler.tryCompile(child, binding);
          if (expression) expressions.push({ path: childPath, expression });
        } catch (error) {
          throw new Error(childPath.join(".") + " 的表达式无效", { cause: error });
        }
      } else visit(child, childPath);
    }
  }
  visit(template, []);
  return expressions;
}
