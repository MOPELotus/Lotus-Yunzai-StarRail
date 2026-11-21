// TypeScript port of the HSR_Nous expression contract (MIT, upstream 00185dd).
export class ExpressionError extends Error {}

export type ExpressionLayer = "effect" | "formula";
type Literal = string | number | boolean | null;
type Node =
  | { kind: "Constant"; value: Literal }
  | { kind: "Name"; id: string }
  | { kind: "Attribute"; object: Node; attr: string }
  | { kind: "Subscript"; object: Node; index: Node }
  | { kind: "List" | "Tuple"; items: Node[] }
  | { kind: "Call"; func: string; args: Node[]; keywords: [string, Node][] }
  | { kind: "UnaryOp"; operator: string; operand: Node }
  | { kind: "BinOp" | "BoolOp"; operator: string; left: Node; right: Node }
  | { kind: "Compare"; first: Node; following: [string, Node][] }
  | { kind: "IfExp"; condition: Node; yes: Node; no: Node };

export interface PreparedExpression {
  readonly source: string;
  readonly tree: Readonly<Node>;
}

export interface ExpressionTrace {
  readonly kind?: string;
  readonly value?: unknown;
  readonly children?: readonly ExpressionTrace[];
  readonly op?: string;
  readonly id?: string;
  readonly attr?: string;
  readonly func?: string;
}

export interface EvalOutcome<T = unknown> {
  readonly value: T;
  readonly trace: ExpressionTrace;
}

export interface EvaluateOptions {
  readonly context?: Readonly<Record<string, unknown>>;
  // Named DSL arguments (currently lookup_table's index) are supplied as a final object.
  readonly functions?: Readonly<Record<string, (...args: never[]) => unknown>>;
  readonly rng?: (() => number) | { random(): number };
  readonly trace?: boolean;
  readonly zoneRefs?: Readonly<Record<string, PreparedExpression>>;
  readonly zoneCache?: Map<string, EvalOutcome>;
}

const namespaces = new Set("self resource event target build prev last team it modifier mod snapshot level".split(" "));
export const effectFunctions = new Set(("min max abs round clamp sum chance roll in_zone stacks sum_stacks modifier_duration "
  + "enemies_alive has_modifier modifier_source count count_selected count_modifier unique_sources mechanic_chance "
  + "actor_type_of hp_of max_hp_of toughness_of resource_of dynamic_of count_team stat_of "
  + "has_pending_one_more turn_owner_of position_of side_size position_delta neighbor_of "
  + "base_stat_of controlled action_disabled path_of has_summon in_group element_of who_has character_id monster_id monster_rank monster_unique_id "
  + "elation_of broken_of has_debuff debuff_count dot_count actor_alive weakness_count has_stat_penalty has_shield shielded_count "
  + "damageable_enemies dot_value is_adjacent has_weakness dot_kind summoner_of").split(" "));
export const formulaFunctions = new Set([...effectFunctions, "random", "lookup_table"]);
const elements = "physical fire ice thunder wind quantum imaginary".split(" ");
const vocabularies = new Map([
  ["has_weakness", new Set(elements)],
  ["dot_kind", new Set(["bleed", "burn", "shock", "wind_shear"])],
]);
const disallowedKeys = new Set(["__proto__", "prototype", "constructor"]);
const comparison = new Set(["==", "!=", "<", "<=", ">", ">=", "in", "not in"]);
const binding = new Map([
  ["or", 1], ["and", 2], ...[...comparison].map(operator => [operator, 3] as const),
  ["+", 4], ["-", 4], ["*", 5], ["/", 5], ["//", 5], ["%", 5], ["**", 7],
]);
const operatorLabels: Readonly<Record<string, string>> = {
  "+": "Add", "-": "Sub", "*": "Mult", "/": "Div", "//": "FloorDiv", "%": "Mod", "**": "Pow",
  and: "And", or: "Or", not: "Not", "u+": "UAdd", "u-": "USub",
};

type Token = { kind: "number" | "string" | "word" | "operator" | "end"; text: string };
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s+|(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?|"(?:\\[\s\S]|[^"\\\r\n])*"|'(?:\\[\s\S]|[^'\\\r\n])*'|\$?[A-Za-z_]\w*|\*\*|\/\/|<=|>=|!=|==|&&|\|\||[?=:+\-*/%<>()\[\],.!]/gy;
  let cursor = 0;
  while (cursor < source.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(source);
    if (!match) throw new ExpressionError(`表达式第 ${cursor + 1} 字符不受支持：${source}`);
    const text = match[0]!;
    cursor = pattern.lastIndex;
    if (/^\s/u.test(text)) continue;
    const kind = /^\d|^\.\d/u.test(text) ? "number" : /^["']/u.test(text) ? "string"
      : /^[\w$]/u.test(text) ? "word" : "operator";
    tokens.push({ kind, text: text === "&&" ? "and" : text === "||" ? "or" : text === "!" ? "not" : text });
  }
  tokens.push({ kind: "end", text: "" });
  return tokens;
}

function decodeString(raw: string) {
  return raw.slice(1, -1).replace(/\\(?:[ux][0-9a-fA-F]+|[\s\S])/gu, escape => {
    const marker = escape[1]!;
    const controls: Readonly<Record<string, string>> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v",
      "'": "'", '"': '"', "\\": "\\", "\n": "" };
    if (Object.hasOwn(controls, marker)) return controls[marker]!;
    if (marker === "u" || marker === "x") {
      const size = marker === "u" ? 4 : 2;
      if (escape.length < size + 2) throw new ExpressionError("字符串转义不完整");
      return String.fromCharCode(Number.parseInt(escape.slice(2, 2 + size), 16)) + escape.slice(2 + size);
    }
    return escape;
  });
}

class Parser {
  private cursor = 0;
  private readonly tokens: Token[];
  constructor(readonly source: string, private readonly allowed: ReadonlySet<string>) {
    this.tokens = tokenize(source);
  }

  private peek(offset = 0) { return this.tokens[this.cursor + offset] ?? this.tokens.at(-1)!; }
  private take() { return this.tokens[this.cursor++] ?? this.tokens.at(-1)!; }
  private accepts(text: string) { if (this.peek().text !== text) return false; this.take(); return true; }
  private expect(text: string) { if (!this.accepts(text)) this.fail(`需要 ${text}`); }
  private fail(message: string): never { throw new ExpressionError(`${message}：${this.source}`); }

  parse(): Node {
    let node = this.expression();
    if (this.accepts(",")) node = { kind: "Tuple", items: this.items(node, "") };
    if (this.peek().kind !== "end") this.fail(`意外的标记 ${this.peek().text}`);
    return node;
  }

  private items(first: Node, close: string) {
    const items = [first];
    while (this.peek().text !== close) {
      items.push(this.expression());
      if (!this.accepts(",")) break;
    }
    return items;
  }

  private atom(): Node {
    const token = this.take();
    if (token.kind === "number") return { kind: "Constant", value: Number(token.text) };
    if (token.kind === "string") return { kind: "Constant", value: decodeString(token.text) };
    if (token.kind === "word") {
      const name = token.text;
      if (name === "True" || name === "False" || name === "None") {
        return { kind: "Constant", value: name === "None" ? null : name === "True" };
      }
      if (name === "if" || name === "else" || name === "in" || name === "and" || name === "or") this.fail(`无效标识符 ${name}`);
      if (name.startsWith("$") && !namespaces.has(name.slice(1))) this.fail(`未知命名空间 ${name}`);
      return { kind: "Name", id: name === "def" ? "defense" : name.replace(/^\$/u, "") };
    }
    if (token.text === "(" || token.text === "[") {
      const close = token.text === "(" ? ")" : "]";
      const kind = token.text === "(" ? "Tuple" : "List";
      if (this.accepts(close)) return { kind, items: [] };
      const first = this.expression();
      const comma = this.accepts(",");
      const items = comma ? this.items(first, close) : [first];
      this.expect(close);
      return kind === "List" || comma ? { kind, items } : first;
    }
    return this.fail(`意外的标记 ${token.text}`);
  }

  private call(node: Node): Node {
    if (node.kind !== "Name" || !this.allowed.has(node.id)) return this.fail("只允许调用白名单函数");
    const args: Node[] = [];
    const keywords: [string, Node][] = [];
    const names = new Set<string>();
    while (this.peek().text !== ")") {
      if (this.peek().kind === "word" && this.peek(1).text === "=") {
        const key = this.take().text;
        this.take();
        if (names.has(key) || disallowedKeys.has(key) || key.startsWith("$")) this.fail(`非法或重复参数 ${key}`);
        names.add(key);
        keywords.push([key, this.expression()]);
      } else {
        if (keywords.length) this.fail("位置参数必须在关键字参数之前");
        args.push(this.expression());
      }
      if (!this.accepts(",")) break;
    }
    this.expect(")");
    const vocab = vocabularies.get(node.id), arg = args[1];
    if (vocab && arg?.kind === "Constant" && typeof arg.value === "string" && !vocab.has(arg.value.toLowerCase())) {
      this.fail(`${node.id} 不支持值 ${arg.value}`);
    }
    return { kind: "Call", func: node.id, args, keywords };
  }

  private prefix(): Node {
    const operator = this.peek().text;
    if (operator === "not" || operator === "+" || operator === "-") {
      this.take();
      return { kind: "UnaryOp", operator: operator === "not" ? operator : `u${operator}`,
        operand: this.expression(operator === "not" ? 3 : 6) };
    }
    let node = this.atom();
    for (;;) {
      if (this.accepts(".")) {
        const attr = this.take();
        if (attr.kind !== "word" || attr.text.startsWith("_") || attr.text.startsWith("$") || disallowedKeys.has(attr.text)) {
          this.fail(`禁止访问属性 ${attr.text}`);
        }
        node = { kind: "Attribute", object: node, attr: attr.text === "def" ? "defense" : attr.text };
      } else if (this.accepts("[")) {
        const index = this.expression();
        this.expect("]");
        node = { kind: "Subscript", object: node, index };
      } else if (this.accepts("(")) node = this.call(node);
      else return node;
    }
  }

  private binaryOperator() {
    return this.peek().text === "not" && this.peek(1).text === "in" ? "not in" : this.peek().text;
  }

  private expression(minimum = 0): Node {
    let left = this.prefix();
    for (;;) {
      const operator = this.binaryOperator();
      const precedence = binding.get(operator);
      if (precedence === undefined || precedence < minimum) break;
      if (comparison.has(operator)) {
        const following: [string, Node][] = [];
        for (let op = operator; comparison.has(op); op = this.binaryOperator()) {
          this.take();
          if (op === "not in") this.take();
          following.push([op, this.expression(precedence + 1)]);
        }
        left = { kind: "Compare", first: left, following };
      } else {
        this.take();
        const right = this.expression(precedence + (operator === "**" ? 0 : 1));
        left = { kind: precedence < 3 ? "BoolOp" : "BinOp", operator, left, right };
      }
    }
    if (minimum === 0 && this.accepts("?")) {
      const yes = this.expression();
      this.expect(":");
      return { kind: "IfExp", condition: left, yes, no: this.expression() };
    }
    return left;
  }
}

export function parse(source: string, layer: ExpressionLayer = "effect"): PreparedExpression {
  if (layer !== "effect" && layer !== "formula") throw new ExpressionError(`未知表达式层 ${layer}`);
  const tree = new Parser(source, layer === "effect" ? effectFunctions : formulaFunctions).parse();
  return { source, tree };
}

export function expressionIdents(prepared: PreparedExpression): readonly string[] {
  const ids = new Set<string>();
  function visit(node: Readonly<Node>): void {
    switch (node.kind) {
      case "Name": ids.add(node.id); break;
      case "Attribute": visit(node.object); break;
      case "Subscript": visit(node.object); visit(node.index); break;
      case "UnaryOp": visit(node.operand); break;
      case "BinOp": case "BoolOp": visit(node.left); visit(node.right); break;
      case "List": case "Tuple": node.items.forEach(visit); break;
      case "Call": node.args.forEach(visit); node.keywords.forEach(([, value]) => visit(value)); break;
      case "Compare": visit(node.first); node.following.forEach(([, value]) => visit(value)); break;
      case "IfExp": visit(node.condition); visit(node.yes); visit(node.no); break;
      case "Constant": break;
    }
  }
  visit(prepared.tree);
  return [...ids];
}

function truth(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map || value instanceof Set) return value.size > 0;
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null || prototype === Object.prototype) return Object.keys(value).length > 0;
  }
  return Boolean(value);
}

function numeric(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "boolean") throw new ExpressionError("需要数值");
  return Number(value);
}

function values(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [...value];
  if (value instanceof Set) return [...value];
  if (value instanceof Map) return [...value.keys()];
  throw new ExpressionError("需要可迭代的值");
}

function get(object: unknown, key: unknown): unknown {
  if (object instanceof Map && object.has(key)) return object.get(key);
  if ((typeof object === "string" || Array.isArray(object)) && typeof key === "number" && Number.isInteger(key)) {
    const array = typeof object === "string" ? [...object] : object;
    const index = key >= 0 ? key : array.length + key;
    if (index >= 0 && index < array.length) return array[index];
  }
  if (object && typeof object === "object" && (typeof key === "string" || typeof key === "number")
      && !disallowedKeys.has(String(key)) && Object.hasOwn(object, key)) {
    return (object as Record<PropertyKey, unknown>)[key];
  }
  throw new ExpressionError(`属性或下标 ${String(key)} 不存在`);
}

function equal(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if ((typeof a === "number" || typeof a === "boolean") && (typeof b === "number" || typeof b === "boolean")) {
    return Number(a) === Number(b);
  }
  return a === b;
}

function compare(operator: string, a: unknown, b: unknown): boolean {
  if (operator === "==" || operator === "!=") return equal(a, b) === (operator === "==");
  if (operator === "in" || operator === "not in") {
    const found = typeof b === "string" && typeof a === "string" ? b.includes(a)
      : b instanceof Map || b instanceof Set ? b.has(a)
      : b && typeof b === "object" && !Array.isArray(b) ? typeof a === "string" && Object.hasOwn(b, a)
      : values(b).some(item => equal(a, item));
    return found === (operator === "in");
  }
  if (typeof a === "string" && typeof b === "string") {
    return operator === "<" ? a < b : operator === "<=" ? a <= b : operator === ">" ? a > b : a >= b;
  }
  const left = numeric(a), right = numeric(b);
  return operator === "<" ? left < right : operator === "<=" ? left <= right : operator === ">" ? left > right : left >= right;
}

function arithmetic(operator: string, a: unknown, b: unknown): unknown {
  if (operator === "+") {
    if (typeof a === "string" && typeof b === "string") return a + b;
    if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  }
  const left = numeric(a), right = numeric(b);
  if ((operator === "/" || operator === "//" || operator === "%") && right === 0) throw new ExpressionError("除数不能为零");
  switch (operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return left / right;
    case "//": case "%": {
      const remainder = left % right;
      const adjust = remainder !== 0 && (remainder < 0) !== (right < 0);
      return operator === "%" ? (adjust ? remainder + right : remainder)
        : Math.round((left - remainder) / right) - Number(adjust);
    }
    case "**": return left ** right;
    default: throw new ExpressionError(`未知运算符 ${operator}`);
  }
}

// Match Python's ties-to-even rule using the exact binary64 magnitude before decimal scaling.
function round(value: number, digits = 0): number {
  if (!Number.isInteger(digits)) throw new ExpressionError("round 的位数必须为整数");
  if (!Number.isFinite(value) || value === 0 || digits > 308) return value;
  if (digits < -308) return 0;
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, Math.abs(value));
  const packed = bits.getBigUint64(0);
  const exponent = Number((packed >> 52n) & 0x7ffn);
  let numerator = (packed & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n);
  let denominator = 1n;
  const shift = (exponent || 1) - 1075;
  if (shift < 0) denominator <<= BigInt(-shift);
  else numerator <<= BigInt(shift);
  if (digits < 0) denominator *= 10n ** BigInt(-digits);
  else numerator *= 10n ** BigInt(digits);
  let rounded = numerator / denominator;
  const doubledRemainder = (numerator % denominator) * 2n;
  if (doubledRemainder > denominator || (doubledRemainder === denominator && rounded % 2n === 1n)) rounded++;
  const magnitude = Number(`${rounded}e${-digits}`);
  return value < 0 ? -magnitude : magnitude;
}

export function evaluate<T = unknown>(prepared: PreparedExpression, options: EvaluateOptions = {}): EvalOutcome<T> {
  const context = options.context ?? {};
  const traced = options.trace !== false;
  const empty: ExpressionTrace = {};
  function uniform(): number {
    if (!options.rng) throw new ExpressionError("此表达式需要随机源");
    return typeof options.rng === "function" ? options.rng() : options.rng.random();
  }
  function builtin(name: string, args: unknown[]): unknown {
    const [first, second, third] = args;
    switch (name) {
      case "min": return Math.min(...(args.length === 1 ? values(first) : args).map(numeric));
      case "max": return Math.max(...(args.length === 1 ? values(first) : args).map(numeric));
      case "sum": return values(first).reduce<number>((sum, n) => sum + numeric(n), second === undefined ? 0 : numeric(second));
      case "abs": return Math.abs(numeric(first));
      case "round": return round(numeric(first), second === undefined ? 0 : numeric(second));
      case "clamp": return Math.max(numeric(second), Math.min(numeric(third), numeric(first)));
      case "chance": return uniform() * 100 < numeric(first);
      case "random": return uniform();
      default: throw new ExpressionError(`函数 ${name} 无宿主实现`);
    }
  }

  function result(kind: string, value: unknown, children?: EvalOutcome[], metadata?: ExpressionTrace): EvalOutcome {
    if (!traced) return { value, trace: empty };
    return { value, trace: { kind, value, ...metadata, ...(children ? { children: children.map(item => item.trace) } : {}) } };
  }

  function visit(node: Readonly<Node>, insideZone = false): EvalOutcome {
    const visitChild = (child: Node) => visit(child, insideZone);
    switch (node.kind) {
      case "Constant": return result(node.kind, node.value);
      case "Name": {
        const zone = !insideZone && options.zoneRefs && Object.hasOwn(options.zoneRefs, node.id) ? options.zoneRefs[node.id] : undefined;
        if (zone) {
          let evaluated = options.zoneCache?.get(node.id);
          if (!evaluated) {
            evaluated = visit(zone.tree, true);
            options.zoneCache?.set(node.id, evaluated);
          }
          return result("ZoneRef", evaluated.value, [evaluated], { id: node.id });
        }
        if (!Object.hasOwn(context, node.id)) throw new ExpressionError(`未定义变量 ${node.id}`);
        return result(node.kind, context[node.id], undefined, { id: node.id });
      }
      case "List": case "Tuple": {
        const children = node.items.map(visitChild);
        return result(node.kind, children.map(child => child.value), children);
      }
      case "Attribute": {
        const child = visitChild(node.object);
        return result(node.kind, get(child.value, node.attr), [child], { attr: node.attr });
      }
      case "Subscript": {
        const object = visitChild(node.object), index = visitChild(node.index);
        return result(node.kind, get(object.value, index.value), [object, index]);
      }
      case "UnaryOp": {
        const child = visitChild(node.operand);
        const value = node.operator === "not" ? !truth(child.value)
          : node.operator === "u-" ? -numeric(child.value) : numeric(child.value);
        return result(node.kind, value, [child], { op: operatorLabels[node.operator] });
      }
      case "BinOp": case "BoolOp": {
        const left = visitChild(node.left);
        const metadata = { op: operatorLabels[node.operator] };
        if (node.kind === "BoolOp" && truth(left.value) === (node.operator === "or")) {
          return result(node.kind, left.value, [left], metadata);
        }
        const right = visitChild(node.right);
        const value = node.kind === "BoolOp" ? right.value : arithmetic(node.operator, left.value, right.value);
        return result(node.kind, value, [left, right], metadata);
      }
      case "Compare": {
        let left = visitChild(node.first);
        const children = [left];
        for (const [operator, expression] of node.following) {
          const right = visitChild(expression);
          children.push(right);
          if (!compare(operator, left.value, right.value)) return result(node.kind, false, children);
          left = right;
        }
        return result(node.kind, true, children);
      }
      case "IfExp": {
        const condition = visitChild(node.condition);
        const picked = visitChild(truth(condition.value) ? node.yes : node.no);
        return result(node.kind, picked.value, [condition, picked]);
      }
      case "Call": {
        const children = node.args.map(visitChild);
        const args = children.map(child => child.value);
        if (node.keywords.length) {
          args.push(Object.fromEntries(node.keywords.map(([key, expression]) => {
            const child = visitChild(expression);
            children.push(child);
            return [key, child.value];
          })));
        }
        const host = options.functions && Object.hasOwn(options.functions, node.func) ? options.functions[node.func] : undefined;
        const value = host ? host(...args as never[]) : builtin(node.func, args);
        return result(node.kind, value, children, { func: node.func });
      }
    }
  }

  try {
    return visit(prepared.tree) as EvalOutcome<T>;
  } catch (error) {
    throw new ExpressionError(`${error instanceof Error ? error.message : String(error)}：${prepared.source}`);
  }
}
