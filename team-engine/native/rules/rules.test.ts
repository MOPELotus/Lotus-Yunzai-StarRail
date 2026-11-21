import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { evaluate, expressionIdents, parse, ExpressionError } from "./expression.ts";
import { getRulebook, type RuleValues } from "./rulebook.ts";
import { bindRuleExpression, compileTemplateExpressions, effectiveSkillLevels, ExpressionCompiler, skillParameterTables } from "./schema.ts";

test("DSL arithmetic, comparisons, strings, ternaries and Python rounding", () => {
  const project = (source: string, context?: RuleValues) => evaluate(parse(source), { context, trace: false }).value;
  expect(project("-(2 ** 2) + (7 // 3) + -5 % 4")).toBe(1);
  expect(project("sum((2, 3)) + max([1, 4, 2])")).toBe(9);
  expect(project("1 // 0.1")).toBe(9);
  expect(project("0.1 % 1")).toBe(0.1);
  expect(project("round(2.675, 2) + round(2.5)")).toBe(4.67);
  expect(project("0 < 2 < 3 && 'x' in ['a', 'x']")).toBe(true);
  expect(project("!2 == 3 ? ($self.atk > 2000 ? 20 : 10) : 30", { self: { atk: 2700 } })).toBe(20);
  expect(project("'a ? and : && if' == 'a ? and : && if'")).toBe(true);
  expect(project("$event.items[-1]", { event: { items: [1, 2] } })).toBe(2);
  expect(project("False && missing || 0")).toBe(0);
});

test("rejects inaccessible and non-DSL operations", () => {
  for (const source of ["eval('1')", "$self._private", "max.call(2)", "x & 1", "lambda: 1", "1 if True else 2",
    "$wrong.value", "dot_kind($target, 'frost')"]) {
    expect(() => parse(source)).toThrow(ExpressionError);
  }
  expect(() => evaluate(parse("$self['constructor']"), { context: { self: {} } })).toThrow(ExpressionError);
  expect(() => evaluate(parse("$self.missing"), { context: { self: {} } })).toThrow(ExpressionError);
});

test("seed injections, traces and zone references use AST order and cache hits", () => {
  const ctx = parse("chance(40) ? boost + boost : other");
  expect(expressionIdents(ctx)).toEqual(["boost", "other"]);
  let calls = 0;
  const result = evaluate(ctx, { rng: () => (++calls, 0.2),
    zoneRefs: { boost: parse("random()", "formula") }, zoneCache: new Map() });
  expect(result.value).toBeCloseTo(0.4);
  expect(result.trace.kind).toBe("IfExp");
  expect(calls).toBe(2);
  expect(evaluate(parse("lookup_table('test', index=2)", "formula"), {
    functions: { lookup_table: (_name: string, named: { index: number }) => named.index + 1 },
  }).value).toBe(3);
});

test("loads every pinned formula and evaluates reference multipliers", async () => {
  const rules = await getRulebook();
  expect(await getRulebook()).toBe(rules);
  expect(Object.keys(rules.zones)).toHaveLength(27);
  expect(Object.keys(rules.formulas)).toHaveLength(13);
  expect(Object.keys(rules.settleGates)).toEqual(["super_break", "elation"]);
  const evaluateZone = (name: string, context: RuleValues) => evaluate(rules.zones[name]!, { context }).value as number;
  expect(evaluateZone("def_multi", { attacker_level: 80, target_def: 1000, def_pen: 0 })).toBe(0.5);
  expect(evaluateZone("res_multi", { target_res: 0.2, res_pen: 0.1 })).toBe(0.9);
  expect(evaluateZone("base_universal_multi", { target_broken: false })).toBe(0.9);
  expect(evaluateZone("base_universal_multi", { target_broken: true })).toBe(1);
  expect(rules.formulaIdents.damage?.slice(0, 4)).toEqual(["ability_multiplier", "dmg_boost_multi", "ind_dmg_boost_multi", "def_multi"]);
});

test("binds actual Feixiao level and parameters once", async () => {
  const path = new URL("../../vendor/data/library/characters/1220_飞霄.yaml", import.meta.url);
  const template = Bun.YAML.parse(await Bun.file(path).text()) as RuleValues;
  const levels = effectiveSkillLevels(template, { basic: 6, ultimate: 10 }, 3);
  expect(levels.basic).toBe(7);
  expect(levels.ultimate).toBe(12);
  const tables = skillParameterTables(template.skill_params);
  const compiler = new ExpressionCompiler();
  const references = { levels, tables, constants: (await getRulebook()).constants };
  const prepared = compiler.compile("param(122004, 1) * $self.atk + const(initial_sp)", references);
  expect(evaluate(prepared, { context: { self: { atk: 2700 } } }).value).toBeCloseTo(2973);
  expect(compiler.compile("param(122004, 1) * $self.atk + const(initial_sp)", references)).toBe(prepared);
  expect(bindRuleExpression("'param(1, 7)'", references)).toBe("'param(1, 7)'");
  expect(() => bindRuleExpression("param(122004, 99)", references)).toThrow();
  expect(compiler.tryCompile("true")).toBeUndefined();
});

test("binds all installed character, equipment, enemy and system template expression fields", async () => {
  const source = new URL("../../vendor/data/library/", import.meta.url);
  const { constants } = await getRulebook();
  const compiler = new ExpressionCompiler();
  let templates = 0;
  let expressions = 0;
  async function scan(directory: URL): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = encodeURIComponent(entry.name);
      if (entry.isDirectory()) await scan(new URL(name + "/", directory));
      else if (entry.name.endsWith(".yaml")) {
        const template = Bun.YAML.parse(await Bun.file(new URL(name, directory)).text()) as RuleValues;
        const binding = { constants, tables: skillParameterTables(template.skill_params), levels: effectiveSkillLevels(template, {}, 0) };
        try {
          expressions += compileTemplateExpressions(template, binding, compiler).length;
        } catch (error) {
          throw new Error(entry.name + " 规则无法编译", { cause: error });
        }
        templates++;
      }
    }
  }
  await scan(source);
  expect(templates).toBe(325);
  expect(expressions).toBeGreaterThan(2_500);
});
