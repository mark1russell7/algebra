/**
 * The static bound of the expression kinds. It closes the items "a static bound" of A3 and "a static interval" of A4.
 * The verb `static` compiles a document one time. Each call takes a box of the variables and makes one walk over the
 * tree. The walk uses no point. The result holds at each point of the box:
 *
 * - `enclosure`: the interval that the verb `interval` gives for the box. It contains the exact value.
 * - `error`: a bound of `|float value - exact value|` for the float program of `compileFloat`.
 *
 * A caller that has this result does not need the running bound of `float` inside the box.
 *
 * The rule of each node is the rule of the verb `float`, with one change. The running bound reads the float value of
 * each operation. The static bound reads a bound `m` of the exact value from the enclosure of the node. A rounded
 * operation has the real result `w`, and `|w| <= m + p` for the propagated bound `p`. So `close(m + p, p)` bounds the
 * error of the node. A list folds from the left, and a whole power uses repeated squares, as the float program does.
 *
 * The same box gives the same operations, so a dependency between two parts is lost. The exact value of `x - x` is
 * zero, and its float value is zero, but the enclosure and the bound use the whole box. The bound is correct and wide.
 *
 * A root of index 3 or more has a true enclosure and the error `Infinity`. The bound of `rootError` reads the float
 * root, and `Math.pow` has no stated accuracy. A walk with no point has no float root to read.
 *
 * @packageDocumentation
 */
import { close, divUp, mulUp } from "./float.ts";
import * as I from "./interval.ts";
import { intervalNode, intervalVar, NO_CLAIM } from "./interval-evaluator.ts";
import type { Enclosure, IntervalInput } from "./interval-evaluator.ts";
import type { KindName, NodeData } from "./summary.ts";

/** The result of the verb `static` for a box. */
export interface StaticBound {
  /**
   * The interval of the exact value at each point of the box. `null` tells that no point gives a real value. `"no
   * claim"` tells that the evaluator cannot tell. The rules are the rules of the verb `interval`.
   */
  readonly enclosure: Enclosure;
  /**
   * The bound of `|value - exact|` at each point of the box, for the value of `compileFloat`. `Infinity` makes no claim.
   * For a comparison, `0` tells that the float and exact truth values are the same at each point. `1` tells that they
   * can differ.
   */
  readonly error: number;
}

/** The code of one node: a function of the box. Each value of the box is a number or an interval. */
export type StaticRun = (box: ArrayLike<IntervalInput>) => StaticBound;

/** The compiled code of one node. */
export interface StaticCell {
  readonly run: StaticRun;
}

/** The interval of a claim. */
type Bounds = readonly [number, number];

/** A result with a real interval. */
interface Claim {
  readonly enclosure: Bounds;
  readonly error: number;
}

/** A bound of the size of an exact value and a bound of the error of its float value. */
interface Term {
  readonly size: number;
  readonly error: number;
}

/** This function gives the largest absolute value of an interval. */
const magnitude = (x: Bounds): number => Math.max(-x[0], x[1]);

/** This function gives the smallest absolute value of an interval. */
const smallest = (x: Bounds): number => (x[0] > 0 ? x[0] : x[1] < 0 ? -x[1] : 0);

/**
 * This function compiles a number literal. A literal is the exact binary value of its float.
 *
 * @param value - The finite float of the literal.
 * @returns The cell of the literal.
 */
export function staticNum(value: number): StaticCell {
  const out: StaticBound = { enclosure: [value, value], error: 0 };
  return { run: () => out };
}

/**
 * This function compiles a variable. The float value of a variable is its exact value, so its error is zero. A number
 * that is not finite makes no claim. An interval follows the rule of `intervalVar`.
 *
 * @param index - The position of the variable in the box.
 * @returns The cell of the variable.
 */
export function staticVar(index: number): StaticCell {
  const value = intervalVar(index);
  return {
    run: (box) => {
      const enclosure = value.run(box);
      return { enclosure, error: enclosure === NO_CLAIM ? Infinity : 0 };
    },
  };
}

/**
 * This function gives the bound of a rounded sum or difference. The propagated term is the sum of the two errors.
 *
 * @param size - The bound of the exact value of the node.
 * @param p - The sum of the errors of the parts.
 * @returns The bound of the node.
 */
function sumBound(size: number, p: number): number {
  return close(size + p, p);
}

/**
 * This function gives the bound of a rounded product. The exact parts `A` and `B` and the float parts `a` and `b` have
 * `|a b - A B| <= |A| eb + |B| ea + ea eb`.
 *
 * @param size - The bound of the exact product.
 * @param a - The first part.
 * @param b - The second part.
 * @returns The bound of the node.
 */
function productBound(size: number, a: Term, b: Term): number {
  const p = mulUp(a.size, b.error) + mulUp(b.size, a.error) + mulUp(a.error, b.error);
  return close(size + p, p);
}

/**
 * This function gives the bound of a rounded quotient. When `eb` is less than the smallest `|B|`, the float divisor `b`
 * is not zero, and `a / b - A / B = ((a - A) + (A / B) (B - b)) / b`. So `|a / b - A / B| <= (ea + |A / B| eb) / (|B| - eb)`.
 * Else the float divisor can be zero, and the bound is `Infinity`.
 *
 * @param size - The bound of the exact quotient.
 * @param ea - The error of the dividend.
 * @param eb - The error of the divisor.
 * @param low - The smallest absolute value of the exact divisor.
 * @returns The bound of the node.
 */
function quotientBound(size: number, ea: number, eb: number, low: number): number {
  const d = low - eb;
  if (!(d > 0)) return Infinity;
  const p = divUp(mulUp(size, eb) + ea, d);
  return close(size + p, p);
}

/** This function gives the term of a rounded product of two terms. The outward product bounds the size. */
function times(a: Term, b: Term): Term {
  const size = (I.mul([a.size, a.size], [b.size, b.size]) as Bounds)[1];
  return { size, error: productBound(size, a, b) };
}

/**
 * This function gives the bound of a whole power. It follows `powCell`: the same squares and the same products in the
 * same order, each with the rule of a product. A negative power is the quotient of one by the positive power.
 *
 * @param base - The base.
 * @param exp - The exponent.
 * @param enclosure - The enclosure of the power.
 * @returns The bound of the node.
 */
function powerBound(base: Claim, exp: number, enclosure: Bounds): number {
  const n = Math.abs(exp);
  if (n === 0) return base.error < Infinity ? 0 : Infinity;
  let b: Term = { size: magnitude(base.enclosure), error: base.error };
  let r: Term | undefined;
  for (let k = n; k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) r = r === undefined ? b : times(r, b);
    if (k > 1) b = times(b, b);
  }
  const e = (r as Term).error;
  return exp > 0 ? e : quotientBound(magnitude(enclosure), 0, e, smallest(I.pow(base.enclosure, n) as Bounds));
}

/**
 * This function gives the bound of a root. `Math.sqrt` is correctly rounded. Let `er` be at most the smallest exact
 * radicand `R`. Then the float radicand `r` is not negative, and `|sqrt(r) - sqrt(R)|` is at most `er / sqrt(R)` and at
 * most `sqrt(er)`. Else the float radicand can be negative, and the bound is `Infinity`. A larger index has the bound
 * `Infinity`, because no stated accuracy of `Math.pow` exists and the walk has no float root to read.
 *
 * @param radicand - The radicand.
 * @param k - The index of the root.
 * @param enclosure - The enclosure of the root.
 * @returns The bound of the node.
 */
function rootBound(radicand: Claim, k: number, enclosure: Bounds): number {
  const er = radicand.error;
  const low = radicand.enclosure[0];
  if (k !== 2 || !(er <= low)) return Infinity;
  const p = er === 0 ? 0 : Math.min(divUp(er, Math.sqrt(low)), Math.sqrt(er));
  return close(magnitude(enclosure) + p, p);
}

/**
 * This function gives the bound of a comparison. Two sides with the error zero compare exactly at each point. Else each
 * side grows by its error, so each interval contains the exact value and the float value. When these intervals decide
 * the comparison, the exact truth value and the float truth value are the same at each point.
 *
 * @param kind - The kind of the comparison.
 * @param a - The left side.
 * @param b - The right side.
 * @returns `0` for the same truth values at each point, `1` when they can differ, and `Infinity` for an open side.
 */
function comparisonBound(kind: "lt" | "le" | "eq", a: Claim, b: Claim): number {
  if (a.error === 0 && b.error === 0) return 0;
  if (!(a.error < Infinity && b.error < Infinity)) return Infinity;
  const grown = (c: Claim): I.Interval => I.add(c.enclosure, [-c.error, c.error]);
  const truth = I[kind](grown(a), grown(b)) as Bounds;
  return truth[0] === truth[1] ? 0 : 1;
}

/** This function gives the bound of one operation from the claims of its parts and its enclosure. */
function boundOf(kind: KindName, parts: readonly Claim[], enclosure: Bounds, data: NodeData): number {
  const [a, b] = parts as readonly [Claim, Claim];
  switch (kind) {
    case "add":
    case "sub":
      return sumBound(magnitude(enclosure), a.error + b.error);
    case "mul":
      return productBound(magnitude(enclosure), { size: magnitude(a.enclosure), error: a.error }, { size: magnitude(b.enclosure), error: b.error });
    case "div":
      return quotientBound(magnitude(enclosure), a.error, b.error, smallest(b.enclosure));
    case "neg":
      return a.error;
    case "min":
    case "max":
      return Math.max(a.error, b.error);
    case "pow":
      return powerBound(a, data.exp as number, enclosure);
    case "root":
      return rootBound(a, data.index as number, enclosure);
    case "lt":
    case "le":
    case "eq":
      return comparisonBound(kind, a, b);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts. Use staticNum or staticVar.`);
  }
}

/** This function gives the result of one operation. The rule of the verb `interval` gives the enclosure. */
function stepOf(kind: KindName, parts: readonly StaticBound[], data: NodeData): StaticBound {
  const cells = parts.map((p) => ({ run: () => p.enclosure }));
  const enclosure = intervalNode(kind, cells, data).run([]);
  if (enclosure === null || enclosure === NO_CLAIM) return { enclosure, error: Infinity };
  return { enclosure, error: boundOf(kind, parts as readonly Claim[], enclosure, data) };
}

/**
 * This function compiles one node from the cells of its parts. It is the rule of each kind for the verb `static`. A list
 * of parts folds from the left, as the float program does. So the bound counts each rounded operation of the program.
 *
 * @param kind - The kind of the node. It must not be `num` or `var`.
 * @param parts - The cells of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The cell of the node.
 */
export function staticNode(kind: KindName, parts: readonly StaticCell[], data: NodeData = {}): StaticCell {
  if (parts.length === 0) throw new RangeError(`The kind ${kind} needs one part or more.`);
  const folds = kind === "add" || kind === "mul" || kind === "min" || kind === "max";
  return {
    run: (box) => {
      const xs = parts.map((p) => p.run(box));
      if (!folds) return stepOf(kind, xs, data);
      return xs.slice(1).reduce((acc, x) => stepOf(kind, [acc, x], data), xs[0] as StaticBound);
    },
  };
}
