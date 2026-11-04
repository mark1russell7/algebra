/**
 * The writer of the base arm of the bench: the JavaScript source of a function of one document. The function is the
 * code that a person writes by hand for the document. It has one `const` for each node, and it gives the float value
 * only. It does the float operations of the verb `float` of `@mark1russell7/expression` in the same order, so it gives
 * the same value at each point.
 *
 * The bench writes the source into a module file before the run, and each process imports that file. Thus no part of
 * the bench uses `eval` or `new Function`.
 *
 * @packageDocumentation
 */
import type { Expression } from "@mark1russell7/expression";

/** This function gives the source of a float literal. The text of a number gives back the same float. */
function literal(value: number): string {
  return value < 0 ? `(${value})` : String(value);
}

/**
 * This function gives the source of the body of a function of one document. The function takes the values of the
 * variables in the array `v`, in the order of `variables`.
 *
 * @param doc - The document. A comparison is not an expression, so it is not a part of the corpus.
 * @param variables - The names of the variables, in the order of the values.
 * @returns The statements of the body. The last statement gives the value.
 */
export function writtenBody(doc: Expression, variables: readonly string[]): string {
  const lines: string[] = [];
  let next = 0;
  const local = (code: string): string => {
    const name = `t${next++}`;
    lines.push(`  const ${name} = ${code};`);
    return name;
  };
  const position = new Map(variables.map((name, i) => [name, i]));
  const write = (e: Expression): string => {
    switch (e.type) {
      case "num":
        return literal(e.value);
      case "var": {
        const i = position.get(e.value);
        if (i === undefined) throw new RangeError(`The variable ${e.value} has no position.`);
        return `v[${i}]`;
      }
      case "neg":
        return local(`-${write(e.value)}`);
      case "add":
      case "mul":
      case "sub":
      case "div": {
        const op = { add: "+", mul: "*", sub: "-", div: "/" }[e.type];
        const [first, ...rest] = e.value.map(write) as [string, ...string[]];
        return rest.reduce((acc, part) => local(`${acc} ${op} ${part}`), first);
      }
      case "min":
      case "max": {
        const [first, ...rest] = e.value.map(write) as [string, ...string[]];
        return rest.reduce((acc, part) => local(`Math.${e.type}(${acc}, ${part})`), first);
      }
      case "pow":
        return power(write(e.value.base), e.value.exp, local);
      case "root":
        return root(write(e.value.radicand), e.value.index, local);
    }
  };
  const result = write(doc);
  lines.push(`  return ${result};`);
  return lines.join("\n");
}

/** The repeated squares of the verb `float`: the bits of the exponent from the lowest bit. */
function power(base: string, exp: number, local: (code: string) => string): string {
  const n = Math.abs(exp);
  if (n === 0) return "1";
  let square = base;
  let result: string | undefined;
  for (let k = n; k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) result = result === undefined ? square : local(`${result} * ${square}`);
    if (k > 1) square = local(`${square} * ${square}`);
  }
  return exp > 0 ? (result as string) : local(`1 / ${result as string}`);
}

/** The root of the verb `float`: `Math.sqrt`, `Math.cbrt` or `Math.pow`, with the sign rule of an odd index. */
function root(radicand: string, k: number, local: (code: string) => string): string {
  if (k === 2) return local(`Math.sqrt(${radicand})`);
  const f = (m: string): string => (k === 3 ? `Math.cbrt(${m})` : `Math.pow(${m}, ${1 / k})`);
  return k % 2 === 1 ? local(`${radicand} < 0 ? -${f(`-${radicand}`)} : ${f(radicand)}`) : local(f(radicand));
}

/** The value and the bound of a written node: two pieces of source. */
interface Bounded {
  readonly v: string;
  readonly e: string;
}

/**
 * This function gives the source of the body of a function that also computes the bound of the verb `float`. It is the
 * code that a person writes by hand for the same result as `compileFloat`. It uses the rules of `BOUND_RULES`.
 *
 * @param doc - The document.
 * @param variables - The names of the variables, in the order of the values.
 * @returns The statements of the body. The last statement gives the value and the bound.
 */
export function boundBody(doc: Expression, variables: readonly string[]): string {
  const lines: string[] = [];
  let next = 0;
  const value = (code: string): string => {
    const name = `t${next++}`;
    lines.push(`  const ${name} = ${code};`);
    return name;
  };
  const bound = (code: string): string => {
    const name = `e${next++}`;
    lines.push(`  const ${name} = ${code};`);
    return name;
  };
  const node = (code: string, error: (name: string) => string): Bounded => {
    const v = value(code);
    return { v, e: bound(error(v)) };
  };
  const position = new Map(variables.map((name, i) => [name, i]));
  const seen = new Map<string, Bounded>();
  const product = (a: Bounded, b: Bounded): Bounded => node(`${a.v} * ${b.v}`, (t) => `mulError(${t}, ${a.v}, ${a.e}, ${b.v}, ${b.e})`);
  const power = (base: Bounded, exp: number): Bounded => {
    const n = Math.abs(exp);
    if (n === 0) return { v: "1", e: `(${base.e} < Infinity ? 0 : Infinity)` };
    let square = base;
    let result: Bounded | undefined;
    for (let k = n; k > 0; k = Math.floor(k / 2)) {
      if (k % 2 === 1) result = result === undefined ? square : product(result, square);
      if (k > 1) square = product(square, square);
    }
    const r = result as Bounded;
    return exp > 0 ? r : node(`1 / ${r.v}`, (t) => `divError(${t}, 0, ${r.v}, ${r.e})`);
  };
  const write = (e: Expression): Bounded => {
    switch (e.type) {
      case "num":
        return { v: literal(e.value), e: "0" };
      case "var": {
        const known = seen.get(e.value);
        if (known !== undefined) return known;
        const i = position.get(e.value);
        if (i === undefined) throw new RangeError(`The variable ${e.value} has no position.`);
        const made = node(`v[${i}]`, (t) => `${t} - ${t} === 0 ? 0 : Infinity`);
        seen.set(e.value, made);
        return made;
      }
      case "neg": {
        const a = write(e.value);
        return { v: value(`-${a.v}`), e: a.e };
      }
      case "add":
      case "sub": {
        const op = e.type === "add" ? "+" : "-";
        const [first, ...rest] = e.value.map(write) as [Bounded, ...Bounded[]];
        return rest.reduce((a, b) => node(`${a.v} ${op} ${b.v}`, (t) => `close(${t}, ${a.e} + ${b.e})`), first);
      }
      case "mul": {
        const [first, ...rest] = e.value.map(write) as [Bounded, ...Bounded[]];
        return rest.reduce(product, first);
      }
      case "div": {
        const [a, b] = e.value.map(write) as [Bounded, Bounded];
        return node(`${a.v} / ${b.v}`, (t) => `divError(${t}, ${a.e}, ${b.v}, ${b.e})`);
      }
      case "min":
      case "max": {
        const [first, ...rest] = e.value.map(write) as [Bounded, ...Bounded[]];
        return rest.reduce((a, b) => node(`Math.${e.type}(${a.v}, ${b.v})`, () => `Math.max(${a.e}, ${b.e})`), first);
      }
      case "pow":
        return power(write(e.value.base), e.value.exp);
      case "root": {
        const r = write(e.value.radicand);
        const k = e.value.index;
        const v = root(r.v, k, value);
        return { v, e: bound(k === 2 ? `sqrtError(${v}, ${r.v}, ${r.e})` : `rootError(${v}, ${r.v}, ${r.e}, ${k})`) };
      }
    }
  };
  const result = write(doc);
  lines.push(`  return { value: ${result.v}, error: ${result.e} };`);
  return lines.join("\n");
}

/** The bound rules of `float.ts`, as a person writes them beside the functions. A test compares each bound. */
const BOUND_RULES = `const U = 2 ** -53;
const MIN = Number.MIN_VALUE;
const NORMAL = 2 ** -1022;
const GROW = 1 + 2 ** -40;
const mulUp = (x, y) => x * y + MIN;
const divUp = (x, y) => x / y + MIN;
function close(v, p) {
  const b = (p + mulUp(U, Math.abs(v)) + NORMAL) * GROW;
  return b <= Infinity ? b : Infinity;
}
function mulError(v, a, ea, b, eb) {
  return close(v, mulUp(Math.abs(a), eb) + mulUp(Math.abs(b), ea) + mulUp(ea, eb));
}
function divError(v, ea, b, eb) {
  const m = Math.abs(b);
  if (!(eb < m)) return Infinity;
  return close(v, divUp(mulUp(Math.abs(v) + MIN, eb) + ea, m - eb));
}
function sqrtError(v, r, er) {
  return !(er <= r) ? Infinity : close(v, er === 0 ? 0 : Math.min(divUp(er, v), Math.sqrt(er)));
}`;

/** One function of the module of the written functions. */
export interface Written {
  readonly name: string;
  readonly document: Expression;
  readonly variables: readonly string[];
}

/**
 * This function gives the source of a module with one written function for each case. The module exports the object
 * `written`, from the name of a case to its function. It also exports `boundedOf`, which takes `rootError` of
 * `@mark1russell7/expression` and gives the functions that also compute the bound.
 *
 * @param cases - The name, the document and the variables of each case.
 * @returns The source of the module.
 */
export function writtenModule(cases: readonly Written[]): string {
  const parts = cases.map((c) => `  ${JSON.stringify(c.name)}: function (v) {\n${writtenBody(c.document, c.variables)}\n  },`);
  const bounded = cases.map((c) => `  ${JSON.stringify(c.name)}: function (v) {\n${boundBody(c.document, c.variables)}\n  },`);
  return [
    "// The written functions of the bench of A3. src/source.ts of @algebra/expression-bench writes this file.",
    BOUND_RULES,
    "export const written = {",
    ...parts,
    "};",
    "export const boundedOf = (rootError) => ({",
    ...bounded,
    "});",
    "",
  ].join("\n");
}
