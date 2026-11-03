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

/** One function of the module of the written functions. */
export interface Written {
  readonly name: string;
  readonly document: Expression;
  readonly variables: readonly string[];
}

/**
 * This function gives the source of a module with one written function for each case. The module exports the object
 * `written`, from the name of a case to its function.
 *
 * @param cases - The name, the document and the variables of each case.
 * @returns The source of the module.
 */
export function writtenModule(cases: readonly Written[]): string {
  const parts = cases.map((c) => `  ${JSON.stringify(c.name)}: function (v) {\n${writtenBody(c.document, c.variables)}\n  },`);
  return [
    "// The written functions of the bench of A3. src/source.ts of @algebra/expression-bench writes this file.",
    "export const written = {",
    ...parts,
    "};",
    "",
  ].join("\n");
}
