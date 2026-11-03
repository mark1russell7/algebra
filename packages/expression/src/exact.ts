/**
 * The exact evaluator of the expression kinds (roadmap item A6). The verb `exact` compiles a document one time into a
 * tree of closures, as the verb `float` does. Each call gives the exact value as a rational of `@mark1russell7/rational`.
 * The error of a rational result is zero.
 *
 * A result is one of three values:
 *
 * - a rational: a claim. It is the exact value of the expression at the point.
 * - `null`: a claim. The expression has no real value at the point, for example a quotient by zero.
 * - `"no claim"`: the evaluator cannot tell. A root that is not rational gives it, for example the square root of 2.
 *   A variable that is not finite gives it too.
 * - A node whose numerator or denominator has more than `EXACT_BITS` bits also gives `"no claim"`. Without this limit,
 *   a few nested powers make rationals of millions of bits, and one call takes minutes.
 *
 * A part without a real value makes the node have no real value, also when another part makes no claim.
 *
 * @packageDocumentation
 */
import * as Q from "@mark1russell7/rational";
import type { Rational } from "@mark1russell7/rational";
import { NO_CLAIM } from "./interval-evaluator.ts";
import type { KindName, NodeData } from "./summary.ts";

/** The largest count of bits of the numerator and of the denominator of a node. A larger node makes no claim. */
export const EXACT_BITS = 4096;
const LIMIT = 1n << BigInt(EXACT_BITS);

/** This function gives the rational, or `"no claim"` when it has more than `EXACT_BITS` bits. */
const capped = (r: Rational): Rational | typeof NO_CLAIM => ((r.n < 0n ? -r.n : r.n) < LIMIT && r.d < LIMIT ? r : NO_CLAIM);

/** The result of a node for the verb `exact`: a rational, `null` for no real value, or `"no claim"`. */
export type ExactResult = Rational | null | typeof NO_CLAIM;

/** The code of one node: a function of the values of the variables. */
export type ExactRun = (values: ArrayLike<number>) => ExactResult;

/** The compiled code of one node. */
export interface ExactCell {
  readonly run: ExactRun;
}

/**
 * This function compiles a number literal. A literal is the exact binary value of its float.
 *
 * @param value - The finite float of the literal.
 * @returns The cell of the literal.
 */
export function exactNum(value: number): ExactCell {
  const r = Q.fromFloat(value);
  return { run: () => r };
}

/**
 * This function compiles a variable. A finite number is its exact binary value. A number that is not finite makes no
 * claim.
 *
 * @param index - The position of the variable in the values of a call.
 * @returns The cell of the variable.
 */
export function exactVar(index: number): ExactCell {
  return {
    run: (values) => {
      const v = values[index] as number;
      return v - v === 0 ? Q.fromFloat(v) : NO_CLAIM;
    },
  };
}

/** This function evaluates the parts of a node, with the rule of `null` and `"no claim"` of the module. */
function runParts(parts: readonly ExactCell[], values: ArrayLike<number>): Rational[] | null | typeof NO_CLAIM {
  const out: Rational[] = [];
  let open = false;
  let none = false;
  for (const part of parts) {
    const r = part.run(values);
    if (r === null) none = true;
    else if (r === NO_CLAIM) open = true;
    else out.push(r);
  }
  return none ? null : open ? NO_CLAIM : out;
}

const truth = (t: boolean): Rational => (t ? Q.ONE : Q.ZERO);

/**
 * The rule of a root. A root is rational only when the numerator and the denominator of the radicand are both
 * `k`-th powers. Each other root makes no claim.
 */
function rootOf(x: Rational, k: number): ExactResult {
  if (Q.sign(x) < 0 && k % 2 === 0) return null;
  return Q.root(x, k) ?? NO_CLAIM;
}

function ruleOf(kind: KindName, data: NodeData): (xs: readonly Rational[]) => ExactResult {
  switch (kind) {
    case "add":
      return (xs) => xs.reduce((a, b) => Q.add(a, b));
    case "sub":
      return ([a, b]) => Q.sub(a as Rational, b as Rational);
    case "mul":
      return (xs) => xs.reduce((a, b) => Q.mul(a, b));
    case "min":
      return (xs) => xs.reduce((a, b) => (Q.compare(a, b) <= 0 ? a : b));
    case "max":
      return (xs) => xs.reduce((a, b) => (Q.compare(a, b) >= 0 ? a : b));
    case "div":
      return ([a, b]) => (Q.sign(b as Rational) === 0 ? null : Q.div(a as Rational, b as Rational));
    case "neg":
      return ([a]) => Q.neg(a as Rational);
    case "pow": {
      const e = data.exp as number;
      return ([a]) => (e < 0 && Q.sign(a as Rational) === 0 ? null : Q.pow(a as Rational, e));
    }
    case "root": {
      const k = data.index as number;
      return ([a]) => rootOf(a as Rational, k);
    }
    case "lt":
      return ([a, b]) => truth(Q.compare(a as Rational, b as Rational) < 0);
    case "le":
      return ([a, b]) => truth(Q.compare(a as Rational, b as Rational) <= 0);
    case "eq":
      return ([a, b]) => truth(Q.compare(a as Rational, b as Rational) === 0);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts. Use exactNum or exactVar.`);
  }
}

/**
 * This function compiles one node from the cells of its parts. It is the rule of each kind for the verb `exact`. A
 * comparison gives `1` for true and `0` for false.
 *
 * @param kind - The kind of the node. It must not be `num` or `var`.
 * @param parts - The cells of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The cell of the node.
 */
export function exactNode(kind: KindName, parts: readonly ExactCell[], data: NodeData = {}): ExactCell {
  if (parts.length === 0) throw new RangeError(`The kind ${kind} needs one part or more.`);
  const rule = ruleOf(kind, data);
  return {
    run: (values) => {
      const xs = runParts(parts, values);
      if (xs === null || xs === NO_CLAIM) return xs;
      const r = rule(xs);
      return r === null || r === NO_CLAIM ? r : capped(r);
    },
  };
}
