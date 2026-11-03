/**
 * The arbitrary precision evaluator of the expression kinds (roadmap item A7). The verb `bigfloat` compiles a document
 * one time into a tree of closures, as the verb `interval` does. Each call selects a precision in bits. Thus one
 * compiled document operates at each precision. Each call gives an interval `[low, high]` of `BigFloat` values, and the
 * interval contains the exact value.
 *
 * Each operation of `@algebra/bigfloat` rounds correctly. The low end of each node rounds down and the high end rounds
 * up. Thus each end moves outward by less than one unit in the last place. The width of the interval is the error of
 * the result.
 *
 * Each double is exact in a `BigFloat`. At a precision of 53 or more, each end is at or inside the end of the verb
 * `interval`.
 *
 * A result is one of three values:
 *
 * - `{ low, high }`: a claim. The expression has a real value at the point, and the value is in the interval.
 * - `null`: a claim. The point gives no real value, for example a quotient by zero.
 * - `"no claim"`: the evaluator cannot tell. A divisor or a base of a negative power that holds zero gives it. An even
 *   root of a value that can be negative gives it too. A variable that is not finite gives it, and a value past the
 *   range of a `BigFloat` does too.
 *
 * A part without a real value makes the node have no real value, also when another part makes no claim.
 *
 * @packageDocumentation
 */
import * as B from "@algebra/bigfloat";
import type { BigFloat, Context, Rounding } from "@algebra/bigfloat";
import type { Truth } from "./ball.ts";
import { NO_CLAIM } from "./interval-evaluator.ts";
import type { KindName, NodeData } from "./summary.ts";

/** An interval with `BigFloat` ends. */
export interface BigInterval {
  /** The low end. */
  readonly low: BigFloat;
  /** The high end. */
  readonly high: BigFloat;
}

/** The result of a node for the verb `bigfloat`: an interval, `null` for no real value, or `"no claim"`. */
export type BigEnclosure = BigInterval | null | typeof NO_CLAIM;

/** The code of one node: a function of the values of the variables and of the precision in bits. */
export type BigfloatRun = (values: ArrayLike<number>, precision: number) => BigEnclosure;

/** The compiled code of one node. */
export interface BigfloatCell {
  readonly run: BigfloatRun;
}

const point = (x: BigFloat): BigInterval => ({ low: x, high: x });

const ZERO = B.zero();
const ONE = point(B.fromNumber(1));
const TRUE = ONE;
const FALSE = point(ZERO);
const UNKNOWN: BigInterval = { low: ZERO, high: ONE.low };

/** The two contexts of one precision: the low end rounds down, and the high end rounds up. */
interface Ends {
  readonly down: Context;
  readonly up: Context;
}

const endsOf = (precision: number): Ends => ({ down: { precision, rounding: "down" }, up: { precision, rounding: "up" } });

const smaller = (a: BigFloat, b: BigFloat): BigFloat => (B.compare(a, b) <= 0 ? a : b);
const larger = (a: BigFloat, b: BigFloat): BigFloat => (B.compare(a, b) >= 0 ? a : b);

/** This function tells if an interval holds zero. */
const holdsZero = (x: BigInterval): boolean => x.low.sign <= 0 && x.high.sign >= 0;

/** This function tells if an interval is the point zero. */
const isZero = (x: BigInterval): boolean => x.low.sign === 0 && x.high.sign === 0;

/**
 * This function compiles a number literal. A literal is the exact binary value of its float.
 *
 * @param value - The finite float of the literal.
 * @returns The cell of the literal.
 */
export function bigfloatNum(value: number): BigfloatCell {
  const x = point(B.fromNumber(value));
  return { run: () => x };
}

/**
 * This function compiles a variable. A finite number is its exact binary value. A number that is not finite makes no
 * claim.
 *
 * @param index - The position of the variable in the values of a call.
 * @returns The cell of the variable.
 */
export function bigfloatVar(index: number): BigfloatCell {
  return {
    run: (values) => {
      const v = values[index] as number;
      return v - v === 0 ? point(B.fromNumber(v)) : NO_CLAIM;
    },
  };
}

/** This function gives the hull of four rounded results of the ends of two intervals. */
function hull(x: BigInterval, y: BigInterval, f: (a: BigFloat, b: BigFloat, c: Context) => BigFloat, ends: Ends): BigInterval {
  const pairs = [[x.low, y.low], [x.low, y.high], [x.high, y.low], [x.high, y.high]] as const;
  return {
    low: pairs.map(([a, b]) => f(a, b, ends.down)).reduce(smaller),
    high: pairs.map(([a, b]) => f(a, b, ends.up)).reduce(larger),
  };
}

/** The rule of a divisor: the point zero has no real value, and another interval that holds zero makes no claim. */
function quotient(x: BigInterval, y: BigInterval, ends: Ends): BigEnclosure {
  if (isZero(y)) return null;
  return holdsZero(y) ? NO_CLAIM : hull(x, y, B.div, ends);
}

/** This function gives `x^n` for `x >= 0` and `n >= 1` with repeated squares. Each product rounds in one direction. */
function magnitude(x: BigFloat, n: number, c: Context): BigFloat {
  let base = x;
  let result: BigFloat | undefined;
  for (let k = n; k > 0; k = Math.floor(k / 2)) {
    if (k % 2 === 1) result = result === undefined ? base : B.mul(result, base, c);
    if (k > 1) base = B.mul(base, base, c);
  }
  return B.round(result as BigFloat, c);
}

/** This function gives the context with the opposite direction. */
const flip = (c: Context): Context => ({ ...c, rounding: (c.rounding === "down" ? "up" : "down") as Rounding });

/** This function gives `x^n` for an odd `n`. A negative base rounds its size in the opposite direction. */
const oddPower = (x: BigFloat, n: number, c: Context): BigFloat =>
  x.sign < 0 ? B.neg(magnitude(B.neg(x), n, flip(c))) : magnitude(x, n, c);

/** The rule of a power. A negative power of an interval that holds zero is the rule of a divisor. */
function power(x: BigInterval, n: number, ends: Ends): BigEnclosure {
  if (n === 0) return ONE;
  if (n < 0) {
    if (holdsZero(x)) return isZero(x) ? null : NO_CLAIM;
    return quotient(ONE, power(x, -n, ends) as BigInterval, ends);
  }
  if (n % 2 === 1) return { low: oddPower(x.low, n, ends.down), high: oddPower(x.high, n, ends.up) };
  const a = B.abs(x.low);
  const b = B.abs(x.high);
  return {
    low: holdsZero(x) ? ZERO : magnitude(smaller(a, b), n, ends.down),
    high: magnitude(larger(a, b), n, ends.up),
  };
}

/** The rule of a root: an even root of an interval with a negative point and a point of zero or more makes no claim. */
function rootOf(x: BigInterval, k: number, ends: Ends): BigEnclosure {
  if (k % 2 === 0 && x.low.sign < 0) return x.high.sign < 0 ? null : NO_CLAIM;
  return { low: B.root(x.low, k, ends.down), high: B.root(x.high, k, ends.up) };
}

const lessThan = (x: BigInterval, y: BigInterval): BigInterval => {
  if (B.compare(x.high, y.low) < 0) return TRUE;
  return B.compare(x.low, y.high) >= 0 ? FALSE : UNKNOWN;
};

const atMost = (x: BigInterval, y: BigInterval): BigInterval => {
  if (B.compare(x.high, y.low) <= 0) return TRUE;
  return B.compare(x.low, y.high) > 0 ? FALSE : UNKNOWN;
};

const same = (x: BigInterval, y: BigInterval): BigInterval => {
  if (B.equals(x.low, x.high) && B.equals(y.low, y.high) && B.equals(x.low, y.low)) return TRUE;
  return B.compare(x.high, y.low) < 0 || B.compare(y.high, x.low) < 0 ? FALSE : UNKNOWN;
};

type Rule = (xs: readonly BigInterval[], ends: Ends) => BigEnclosure;

const fold = (f: (x: BigInterval, y: BigInterval, ends: Ends) => BigInterval): Rule => (xs, ends) =>
  xs.reduce((a, b) => f(a, b, ends));

function ruleOf(kind: KindName, data: NodeData): Rule {
  switch (kind) {
    case "add":
      return fold((x, y, e) => ({ low: B.add(x.low, y.low, e.down), high: B.add(x.high, y.high, e.up) }));
    case "sub":
      return fold((x, y, e) => ({ low: B.sub(x.low, y.high, e.down), high: B.sub(x.high, y.low, e.up) }));
    case "mul":
      return fold((x, y, e) => hull(x, y, B.mul, e));
    case "min":
      return fold((x, y) => ({ low: smaller(x.low, y.low), high: smaller(x.high, y.high) }));
    case "max":
      return fold((x, y) => ({ low: larger(x.low, y.low), high: larger(x.high, y.high) }));
    case "div":
      return ([x, y], e) => quotient(x as BigInterval, y as BigInterval, e);
    case "neg":
      return ([x]) => ({ low: B.neg((x as BigInterval).high), high: B.neg((x as BigInterval).low) });
    case "pow":
      return ([x], e) => power(x as BigInterval, data.exp as number, e);
    case "root":
      return ([x], e) => rootOf(x as BigInterval, data.index as number, e);
    case "lt":
      return fold(lessThan);
    case "le":
      return fold(atMost);
    case "eq":
      return fold(same);
    case "num":
    case "var":
      throw new RangeError(`The kind ${kind} has no parts. Use bigfloatNum or bigfloatVar.`);
  }
}

/** This function evaluates the parts of a node. The rule of `null` and `"no claim"` is the rule of the module. */
function runParts(parts: readonly BigfloatCell[], values: ArrayLike<number>, precision: number): BigInterval[] | null | typeof NO_CLAIM {
  const out: BigInterval[] = [];
  let open = false;
  let none = false;
  for (const part of parts) {
    const r = part.run(values, precision);
    if (r === null) none = true;
    else if (r === NO_CLAIM) open = true;
    else out.push(r);
  }
  return none ? null : open ? NO_CLAIM : out;
}

/**
 * This function compiles one node from the cells of its parts. It is the rule of each kind for the verb `bigfloat`. A
 * list of parts folds from the left. A comparison gives the point 1 for true, the point 0 for false, and `[0, 1]` when
 * the intervals do not decide it.
 *
 * @param kind - The kind of the node. It must not be `num` or `var`.
 * @param parts - The cells of the parts, in the order of the value of the node.
 * @param data - The exponent of `pow` or the index of `root`.
 * @returns The cell of the node.
 */
export function bigfloatNode(kind: KindName, parts: readonly BigfloatCell[], data: NodeData = {}): BigfloatCell {
  if (parts.length === 0) throw new RangeError(`The kind ${kind} needs one part or more.`);
  const rule = ruleOf(kind, data);
  return {
    run: (values, precision) => {
      const xs = runParts(parts, values, precision);
      if (xs === null || xs === NO_CLAIM) return xs;
      try {
        return rule(xs, endsOf(precision));
      } catch (error) {
        // only a value past the range of a `BigFloat` comes here: each other case without a value has its own rule
        if (error instanceof RangeError) return NO_CLAIM;
        throw error;
      }
    },
  };
}

/**
 * This function gives the truth value of the result of a comparison document.
 *
 * @param result - The result of a comparison document.
 * @returns `true` for the point 1, `false` for the point 0, and `"undecided"` for each other result.
 */
export function decideBigfloat(result: BigEnclosure): Truth {
  if (result === null || result === NO_CLAIM || !B.equals(result.low, result.high)) return "undecided";
  return result.low.sign !== 0;
}
